import fs from 'node:fs';
import path from 'node:path';
import chokidar from 'chokidar';
import { config } from '@/lib/config';
import { upsertDocument, clearDocumentsForChange, replaceAllDocuments } from '@/lib/db';
import { embed } from '@/lib/embed';
import { events } from '@/lib/events';
import type { Artifact, ArtifactType, ChangeDetail, ChangeSummary } from '@/lib/types';

const ARTIFACT_FILES: Array<{ type: ArtifactType; filename: string }> = [
  { type: 'proposal', filename: 'proposal.md' },
  { type: 'design', filename: 'design.md' },
  { type: 'tasks', filename: 'tasks.md' },
];

const globalState = globalThis as unknown as { watcherStarted?: boolean };

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

function toChangeId(changeDir: string): string {
  return path.basename(changeDir);
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
    artifacts.push({
      type: 'spec',
      path: file,
      content,
      headings: headingsFromMarkdown(content),
    });
  }

  return artifacts;
}

function changeTitle(changeId: string, artifacts: Artifact[]): string {
  const proposal = artifacts.find((a) => a.type === 'proposal');
  if (!proposal) return changeId;
  const h1 = proposal.content
    .split('\n')
    .find((line) => line.startsWith('# '))
    ?.replace(/^#\s*/, '')
    .trim();
  return h1 || changeId;
}

export function listChanges(): ChangeSummary[] {
  const changesDir = path.join(config.openspecRoot, 'changes');
  if (!fs.existsSync(changesDir)) return [];

  const out: ChangeSummary[] = [];
  for (const entry of fs.readdirSync(changesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const id = entry.name;
    if (id === 'archive') continue;
    const abs = path.join(changesDir, id);
    const artifacts = collectArtifacts(abs);

    let updatedAt = new Date(0);
    for (const artifact of artifacts) {
      const stat = fs.statSync(artifact.path);
      if (stat.mtime > updatedAt) updatedAt = stat.mtime;
    }

    out.push({
      id,
      title: changeTitle(id, artifacts),
      path: abs,
      updatedAt: updatedAt.toISOString(),
      artifactCount: artifacts.length,
    });
  }

  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getChangeDetail(changeId: string): ChangeDetail | null {
  const changeDir = path.join(config.openspecRoot, 'changes', changeId);
  if (!fs.existsSync(changeDir)) return null;
  const artifacts = collectArtifacts(changeDir);
  let updatedAt = new Date(0);
  for (const artifact of artifacts) {
    const stat = fs.statSync(artifact.path);
    if (stat.mtime > updatedAt) updatedAt = stat.mtime;
  }

  return {
    id: changeId,
    title: changeTitle(changeId, artifacts),
    path: changeDir,
    updatedAt: updatedAt.toISOString(),
    artifactCount: artifacts.length,
    artifacts,
  };
}

export function reindexAll(): number {
  const changes = listChanges();
  for (const change of changes) {
    clearDocumentsForChange(change.id);
    const detail = getChangeDetail(change.id);
    if (!detail) continue;

    for (const artifact of detail.artifacts) {
      upsertDocument({
        changeId: detail.id,
        artifactType: artifact.type,
        path: artifact.path,
        content: artifact.content,
        headings: artifact.headings,
        embedding: embed(artifact.content),
      });
    }
  }

  replaceAllDocuments(changes.map((c) => ({ changeId: c.id })));

  events.emit('stream', {
    type: 'indexed',
    message: `Indexed ${changes.length} changes`,
    payload: { count: changes.length },
  });

  return changes.length;
}

export function startWatcher(): void {
  if (globalState.watcherStarted) return;
  globalState.watcherStarted = true;

  const target = path.join(config.openspecRoot, 'changes');
  if (!fs.existsSync(target)) {
    return;
  }

  const watcher = chokidar.watch(target, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 200,
      pollInterval: 100,
    },
  });

  const handle = () => {
    reindexAll();
  };

  watcher.on('add', handle);
  watcher.on('change', handle);
  watcher.on('unlink', handle);
  watcher.on('addDir', handle);
  watcher.on('unlinkDir', handle);
}
