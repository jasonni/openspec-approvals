import fs from 'node:fs';
import path from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import { clearDocumentsForChange, replaceAllDocuments, upsertDocument } from '@/lib/db';
import { embed } from '@/lib/embed';
import { emitStreamEvent } from '@/lib/events';
import { requireProject } from '@/lib/projects';
import type { Artifact, ArtifactType, ChangeDetail, ChangeSummary } from '@/lib/types';

const ARTIFACT_FILES: Array<{ type: ArtifactType; filename: string }> = [
  { type: 'proposal', filename: 'proposal.md' },
  { type: 'design', filename: 'design.md' },
  { type: 'tasks', filename: 'tasks.md' },
];

const CHANGE_ID_RE = /^[A-Za-z0-9._-]+$/;

const globalState = globalThis as unknown as {
  watchers?: Map<string, FSWatcher>;
  reindexTimers?: Map<string, NodeJS.Timeout>;
};

function readFileSafe(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function headingsFromMarkdown(content: string): string[] {
  return content
    .split('\n')
    .filter((line) => line.startsWith('#'))
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .filter(Boolean);
}

function findSpecFiles(specDir: string): string[] {
  if (!fs.existsSync(specDir)) return [];
  const out: string[] = [];
  const stack = [specDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
      } else if (entry.isFile() && entry.name === 'spec.md') {
        out.push(abs);
      }
    }
  }
  return out;
}

function collectArtifacts(changeDir: string): Artifact[] {
  const artifacts: Artifact[] = [];
  for (const { type, filename } of ARTIFACT_FILES) {
    const fullPath = path.join(changeDir, filename);
    const content = readFileSafe(fullPath);
    if (!content) continue;
    artifacts.push({
      type,
      path: fullPath,
      content,
      headings: headingsFromMarkdown(content),
    });
  }

  const specRoot = path.join(changeDir, 'specs');
  const specFiles = findSpecFiles(specRoot);
  for (const file of specFiles) {
    const content = readFileSafe(file);
    if (!content) continue;
    // Extract specId from path: specs/<specId>/spec.md
    const relative = path.relative(specRoot, file);
    const specId = path.dirname(relative).split(path.sep)[0] || path.basename(path.dirname(file));
    artifacts.push({
      type: 'spec',
      path: file,
      content,
      headings: headingsFromMarkdown(content),
      specId,
    });
  }

  return artifacts;
}

function changeTitle(changeId: string, artifacts: Artifact[]): string {
  const proposal = artifacts.find((artifact) => artifact.type === 'proposal');
  if (!proposal) return changeId;
  const h1 = proposal.content
    .split('\n')
    .find((line) => line.startsWith('# '))
    ?.replace(/^#\s*/, '')
    .trim();
  return h1 || changeId;
}

function changesDirForProject(projectId: string): string {
  const project = requireProject(projectId);
  return path.join(project.openspecRoot, 'changes');
}

function resolveChangeDir(projectId: string, changeId: string): string | null {
  if (!CHANGE_ID_RE.test(changeId)) return null;
  const base = path.resolve(changesDirForProject(projectId));
  const resolved = path.resolve(base, changeId);
  if (resolved === base || !resolved.startsWith(`${base}${path.sep}`)) return null;
  return resolved;
}

export function listChanges(projectId: string): ChangeSummary[] {
  const changesDir = changesDirForProject(projectId);
  if (!fs.existsSync(changesDir)) return [];

  const out: ChangeSummary[] = [];
  for (const entry of fs.readdirSync(changesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const id = entry.name;
    if (id === 'archive') continue;
    if (!CHANGE_ID_RE.test(id)) continue;

    const abs = resolveChangeDir(projectId, id);
    if (!abs) continue;

    const artifacts = collectArtifacts(abs);
    let updatedAt = new Date(0);
    for (const artifact of artifacts) {
      const stat = fs.statSync(artifact.path);
      if (stat.mtime > updatedAt) updatedAt = stat.mtime;
    }

    out.push({
      projectId,
      id,
      title: changeTitle(id, artifacts),
      path: abs,
      updatedAt: updatedAt.toISOString(),
      artifactCount: artifacts.length,
    });
  }

  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getChangeDetail(projectId: string, changeId: string): ChangeDetail | null {
  const changeDir = resolveChangeDir(projectId, changeId);
  if (!changeDir || !fs.existsSync(changeDir)) return null;

  const artifacts = collectArtifacts(changeDir);
  let updatedAt = new Date(0);
  for (const artifact of artifacts) {
    const stat = fs.statSync(artifact.path);
    if (stat.mtime > updatedAt) updatedAt = stat.mtime;
  }

  return {
    projectId,
    id: changeId,
    title: changeTitle(changeId, artifacts),
    path: changeDir,
    updatedAt: updatedAt.toISOString(),
    artifactCount: artifacts.length,
    artifacts,
  };
}

export function reindexAll(projectId: string): number {
  const changes = listChanges(projectId);
  for (const change of changes) {
    clearDocumentsForChange(projectId, change.id);
    const detail = getChangeDetail(projectId, change.id);
    if (!detail) continue;

    for (const artifact of detail.artifacts) {
      upsertDocument({
        projectId,
        changeId: detail.id,
        artifactType: artifact.type,
        path: artifact.path,
        content: artifact.content,
        headings: artifact.headings,
        embedding: embed(artifact.content),
      });
    }
  }

  replaceAllDocuments(
    projectId,
    changes.map((change) => ({ changeId: change.id }))
  );

  emitStreamEvent({
    projectId,
    type: 'indexed',
    message: `Indexed ${changes.length} changes`,
    payload: { count: changes.length },
  });

  return changes.length;
}

function scheduleReindex(projectId: string): void {
  if (!globalState.reindexTimers) {
    globalState.reindexTimers = new Map();
  }
  const previous = globalState.reindexTimers.get(projectId);
  if (previous) {
    clearTimeout(previous);
  }
  const timer = setTimeout(() => {
    reindexAll(projectId);
    globalState.reindexTimers?.delete(projectId);
  }, 150);
  globalState.reindexTimers.set(projectId, timer);
}

export function startWatcher(projectId: string): void {
  if (!globalState.watchers) {
    globalState.watchers = new Map();
  }
  if (globalState.watchers.has(projectId)) return;

  const target = changesDirForProject(projectId);
  if (!fs.existsSync(target)) return;

  const watcher = chokidar.watch(target, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 200,
      pollInterval: 100,
    },
  });

  const handle = (changedPath: string) => {
    emitStreamEvent({
      projectId,
      type: 'artifact_updated',
      message: `Detected change in ${path.basename(changedPath)}`,
      payload: { path: changedPath },
    });
    scheduleReindex(projectId);
  };

  watcher.on('add', handle);
  watcher.on('change', handle);
  watcher.on('unlink', handle);
  watcher.on('addDir', handle);
  watcher.on('unlinkDir', handle);

  globalState.watchers.set(projectId, watcher);
}
