import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '@/lib/config';
import { listProjects } from '@/lib/projects';
import type { ApprovalDecision, ArtifactType, InlineComment, ReviewSession } from '@/lib/types';

const globalForDb = globalThis as unknown as { db?: Database.Database };

type TableInfoRow = { name: string };

function hasColumn(db: Database.Database, tableName: string, columnName: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as TableInfoRow[];
  return rows.some((row) => row.name === columnName);
}

function defaultProjectId(): string {
  return listProjects()[0]?.id ?? 'default';
}

function migrateLegacySchema(db: Database.Database): void {
  const fallbackProjectId = defaultProjectId();
  if (!hasColumn(db, 'documents', 'project_id')) {
    db.exec('DROP TABLE IF EXISTS documents');
    db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        change_id TEXT NOT NULL,
        artifact_type TEXT NOT NULL,
        path TEXT NOT NULL,
        content TEXT NOT NULL,
        headings TEXT NOT NULL,
        embedding TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(project_id, change_id, artifact_type, path)
      );
    `);
  }
  if (!hasColumn(db, 'approvals', 'project_id')) {
    db.exec('ALTER TABLE approvals ADD COLUMN project_id TEXT');
  }
  db.prepare('UPDATE approvals SET project_id = ? WHERE project_id IS NULL OR project_id = \'\'').run(fallbackProjectId);
  if (!hasColumn(db, 'sync_jobs', 'project_id')) {
    db.exec('ALTER TABLE sync_jobs ADD COLUMN project_id TEXT');
  }
  db.prepare('UPDATE sync_jobs SET project_id = ? WHERE project_id IS NULL OR project_id = \'\'').run(fallbackProjectId);
}

function initDb(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      change_id TEXT NOT NULL,
      artifact_type TEXT NOT NULL,
      path TEXT NOT NULL,
      content TEXT NOT NULL,
      headings TEXT NOT NULL,
      embedding TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, change_id, artifact_type, path)
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      change_id TEXT NOT NULL,
      artifact_type TEXT NOT NULL,
      decision TEXT NOT NULL,
      comment TEXT NOT NULL,
      reviewer TEXT NOT NULL,
      created_at TEXT NOT NULL,
      sync_status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      change_id TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inline_comments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      change_id TEXT NOT NULL,
      artifact_type TEXT NOT NULL,
      paragraph_id TEXT NOT NULL,
      selected_text TEXT NOT NULL,
      author TEXT NOT NULL,
      body TEXT NOT NULL,
      parent_id TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      resolved_by TEXT,
      resolved_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS review_sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      change_id TEXT NOT NULL,
      reviewer TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      decision TEXT,
      body TEXT NOT NULL DEFAULT '',
      submitted_at TEXT,
      created_at TEXT NOT NULL
    );
  `);

  migrateLegacySchema(db);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_documents_project_change_id ON documents(project_id, change_id);
    CREATE INDEX IF NOT EXISTS idx_approvals_project_change_id ON approvals(project_id, change_id);
    CREATE INDEX IF NOT EXISTS idx_sync_jobs_project_status ON sync_jobs(project_id, status, updated_at);
    CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status, updated_at);
    CREATE INDEX IF NOT EXISTS idx_inline_comments_change ON inline_comments(project_id, change_id, artifact_type);
    CREATE INDEX IF NOT EXISTS idx_review_sessions_change ON review_sessions(project_id, change_id);
  `);
}

export function getDb(): Database.Database {
  if (!globalForDb.db) {
    fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
    const db = new Database(config.dbPath);
    initDb(db);
    globalForDb.db = db;
  }
  return globalForDb.db;
}

// ─── documents ────────────────────────────────────────────────────────────

export function upsertDocument(input: {
  projectId: string;
  changeId: string;
  artifactType: ArtifactType;
  path: string;
  content: string;
  headings: string[];
  embedding: number[];
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO documents(project_id, change_id, artifact_type, path, content, headings, embedding, updated_at)
    VALUES(@projectId, @changeId, @artifactType, @path, @content, @headings, @embedding, @updatedAt)
    ON CONFLICT(project_id, change_id, artifact_type, path)
    DO UPDATE SET
      content=excluded.content,
      headings=excluded.headings,
      embedding=excluded.embedding,
      updated_at=excluded.updated_at
  `).run({
    ...input,
    headings: JSON.stringify(input.headings),
    embedding: JSON.stringify(input.embedding),
    updatedAt: new Date().toISOString(),
  });
}

export function clearDocumentsForChange(projectId: string, changeId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM documents WHERE project_id = ? AND change_id = ?').run(projectId, changeId);
}

export function replaceAllDocuments(projectId: string, changeIdRows: Array<{ changeId: string }>): void {
  const db = getDb();
  const ids = new Set(changeIdRows.map((row) => row.changeId));
  const rows = db.prepare('SELECT DISTINCT change_id AS changeId FROM documents WHERE project_id = ?').all(projectId) as Array<{ changeId: string }>;
  for (const row of rows) {
    if (!ids.has(row.changeId)) {
      db.prepare('DELETE FROM documents WHERE project_id = ? AND change_id = ?').run(projectId, row.changeId);
    }
  }
}

export function listIndexedDocuments(projectId: string): Array<{ changeId: string; artifactType: ArtifactType; path: string; content: string; embedding: string }> {
  const db = getDb();
  return db.prepare('SELECT change_id AS changeId, artifact_type AS artifactType, path, content, embedding FROM documents WHERE project_id = ?').all(projectId) as Array<{ changeId: string; artifactType: ArtifactType; path: string; content: string; embedding: string }>;
}

// ─── approvals ────────────────────────────────────────────────────────────

export function createApproval(input: {
  id: string;
  projectId: string;
  changeId: string;
  artifactType: ArtifactType;
  decision: ApprovalDecision;
  comment: string;
  reviewer: string;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO approvals(id, project_id, change_id, artifact_type, decision, comment, reviewer, created_at, sync_status)
    VALUES(@id, @projectId, @changeId, @artifactType, @decision, @comment, @reviewer, @createdAt, 'pending')
  `).run({ ...input, createdAt: new Date().toISOString() });
}

export function listApprovals(projectId: string, changeId?: string): Array<{
  id: string; projectId: string; changeId: string; artifactType: ArtifactType;
  decision: ApprovalDecision; comment: string; reviewer: string; createdAt: string;
  syncStatus: 'pending' | 'synced' | 'failed';
}> {
  const db = getDb();
  const stmt = changeId
    ? db.prepare(`SELECT id, project_id AS projectId, change_id AS changeId, artifact_type AS artifactType, decision, comment, reviewer, created_at AS createdAt, sync_status AS syncStatus FROM approvals WHERE project_id = ? AND change_id = ? ORDER BY created_at DESC`)
    : db.prepare(`SELECT id, project_id AS projectId, change_id AS changeId, artifact_type AS artifactType, decision, comment, reviewer, created_at AS createdAt, sync_status AS syncStatus FROM approvals WHERE project_id = ? ORDER BY created_at DESC`);
  return (changeId ? stmt.all(projectId, changeId) : stmt.all(projectId)) as Array<{ id: string; projectId: string; changeId: string; artifactType: ArtifactType; decision: ApprovalDecision; comment: string; reviewer: string; createdAt: string; syncStatus: 'pending' | 'synced' | 'failed'; }>;
}

export function latestDecisionByChange(projectId: string): Record<string, ApprovalDecision> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT a.change_id AS changeId, a.decision
    FROM approvals a
    JOIN (
      SELECT project_id, change_id, MAX(created_at) AS max_created_at
      FROM approvals WHERE project_id = ? GROUP BY project_id, change_id
    ) latest
      ON latest.project_id = a.project_id AND latest.change_id = a.change_id AND latest.max_created_at = a.created_at
    WHERE a.project_id = ?
  `).all(projectId, projectId) as Array<{ changeId: string; decision: ApprovalDecision }>;
  return rows.reduce<Record<string, ApprovalDecision>>((acc, row) => { acc[row.changeId] = row.decision; return acc; }, {});
}

// ─── sync_jobs ────────────────────────────────────────────────────────────

export function createSyncJob(projectId: string, changeId: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO sync_jobs(project_id, change_id, status, attempts, created_at, updated_at) VALUES(?, ?, ?, 0, ?, ?)').run(projectId, changeId, 'pending', now, now);
}

export function listPendingSyncJobs(limit = 5, projectId?: string): Array<{ id: number; projectId: string; changeId: string; attempts: number }> {
  const db = getDb();
  const query = projectId
    ? db.prepare(`SELECT id, project_id AS projectId, change_id AS changeId, attempts FROM sync_jobs WHERE project_id = ? AND status IN ('pending', 'retrying') ORDER BY updated_at ASC LIMIT ?`)
    : db.prepare(`SELECT id, project_id AS projectId, change_id AS changeId, attempts FROM sync_jobs WHERE status IN ('pending', 'retrying') ORDER BY updated_at ASC LIMIT ?`);
  return (projectId ? query.all(projectId, limit) : query.all(limit)) as Array<{ id: number; projectId: string; changeId: string; attempts: number }>;
}

export function updateSyncJob(id: number, status: 'done' | 'retrying' | 'failed', error = ''): void {
  const db = getDb();
  db.prepare(`UPDATE sync_jobs SET status = ?, attempts = attempts + 1, last_error = ?, updated_at = ? WHERE id = ?`).run(status, error, new Date().toISOString(), id);
}

export function markApprovalsSynced(projectId: string, changeId: string): void {
  const db = getDb();
  db.prepare('UPDATE approvals SET sync_status = ? WHERE project_id = ? AND change_id = ?').run('synced', projectId, changeId);
}

export function markApprovalsFailed(projectId: string, changeId: string): void {
  const db = getDb();
  db.prepare('UPDATE approvals SET sync_status = ? WHERE project_id = ? AND change_id = ?').run('failed', projectId, changeId);
}

// ─── inline_comments ──────────────────────────────────────────────────────

const COMMENT_SELECT = `id, project_id AS projectId, change_id AS changeId, artifact_type AS artifactType,
  paragraph_id AS paragraphId, selected_text AS selectedText, author, body, parent_id AS parentId,
  status, resolved_by AS resolvedBy, resolved_at AS resolvedAt, created_at AS createdAt, updated_at AS updatedAt`;

export function createInlineComment(input: {
  id: string;
  projectId: string;
  changeId: string;
  artifactType: ArtifactType;
  paragraphId: string;
  selectedText: string;
  author: string;
  body: string;
  parentId?: string | null;
}): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO inline_comments(id, project_id, change_id, artifact_type, paragraph_id, selected_text, author, body, parent_id, status, created_at, updated_at)
    VALUES(@id, @projectId, @changeId, @artifactType, @paragraphId, @selectedText, @author, @body, @parentId, 'open', @now, @now)
  `).run({ ...input, parentId: input.parentId ?? null, now });
}

export function listInlineComments(projectId: string, changeId: string, artifactType?: ArtifactType): InlineComment[] {
  const db = getDb();
  const stmt = artifactType
    ? db.prepare(`SELECT ${COMMENT_SELECT} FROM inline_comments WHERE project_id=? AND change_id=? AND artifact_type=? ORDER BY created_at ASC`)
    : db.prepare(`SELECT ${COMMENT_SELECT} FROM inline_comments WHERE project_id=? AND change_id=? ORDER BY created_at ASC`);
  return (artifactType ? stmt.all(projectId, changeId, artifactType) : stmt.all(projectId, changeId)) as InlineComment[];
}

export function resolveInlineComment(id: string, resolvedBy: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`UPDATE inline_comments SET status='resolved', resolved_by=?, resolved_at=?, updated_at=? WHERE id=?`).run(resolvedBy, now, now, id);
}

export function reopenInlineComment(id: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`UPDATE inline_comments SET status='open', resolved_by=NULL, resolved_at=NULL, updated_at=? WHERE id=?`).run(now, id);
}

export function countOpenCommentsByArtifact(projectId: string, changeId: string): Record<string, number> {
  const db = getDb();
  const rows = db.prepare(`SELECT artifact_type AS artifactType, COUNT(*) AS cnt FROM inline_comments WHERE project_id=? AND change_id=? AND status='open' GROUP BY artifact_type`).all(projectId, changeId) as Array<{ artifactType: string; cnt: number }>;
  return rows.reduce<Record<string, number>>((acc, r) => { acc[r.artifactType] = r.cnt; return acc; }, {});
}

// ─── review_sessions ──────────────────────────────────────────────────────

const SESSION_SELECT = `id, project_id AS projectId, change_id AS changeId, reviewer, status, decision, body, submitted_at AS submittedAt, created_at AS createdAt`;

export function getOrCreateReviewSession(projectId: string, changeId: string, reviewer: string): ReviewSession {
  const db = getDb();
  const existing = db.prepare(`SELECT ${SESSION_SELECT} FROM review_sessions WHERE project_id=? AND change_id=? AND reviewer=? AND status='draft'`).get(projectId, changeId, reviewer) as ReviewSession | undefined;
  if (existing) return existing;
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO review_sessions(id, project_id, change_id, reviewer, status, body, created_at) VALUES(?,?,?,?,'draft','',?)`).run(id, projectId, changeId, reviewer, now);
  return db.prepare(`SELECT ${SESSION_SELECT} FROM review_sessions WHERE id=?`).get(id) as ReviewSession;
}

export function updateReviewSessionDraft(id: string, body: string, decision: string | null): void {
  const db = getDb();
  db.prepare(`UPDATE review_sessions SET body=?, decision=? WHERE id=? AND status='draft'`).run(body, decision, id);
}

export function submitReviewSession(id: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`UPDATE review_sessions SET status='submitted', submitted_at=? WHERE id=?`).run(now, id);
}

export function listReviewSessions(projectId: string, changeId: string): ReviewSession[] {
  const db = getDb();
  return db.prepare(`SELECT ${SESSION_SELECT} FROM review_sessions WHERE project_id=? AND change_id=? ORDER BY created_at DESC`).all(projectId, changeId) as ReviewSession[];
}
