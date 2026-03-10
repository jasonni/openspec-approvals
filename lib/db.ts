import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '@/lib/config';
import type { ApprovalDecision, ArtifactType } from '@/lib/types';

const globalForDb = globalThis as unknown as { db?: Database.Database };

function initDb(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      change_id TEXT NOT NULL,
      artifact_type TEXT NOT NULL,
      path TEXT NOT NULL,
      content TEXT NOT NULL,
      headings TEXT NOT NULL,
      embedding TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(change_id, artifact_type, path)
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
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
      change_id TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_documents_change_id ON documents(change_id);
    CREATE INDEX IF NOT EXISTS idx_approvals_change_id ON approvals(change_id);
    CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);
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

export function upsertDocument(input: {
  changeId: string;
  artifactType: ArtifactType;
  path: string;
  content: string;
  headings: string[];
  embedding: number[];
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO documents(change_id, artifact_type, path, content, headings, embedding, updated_at)
    VALUES(@changeId, @artifactType, @path, @content, @headings, @embedding, @updatedAt)
    ON CONFLICT(change_id, artifact_type, path)
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

export function clearDocumentsForChange(changeId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM documents WHERE change_id = ?').run(changeId);
}

export function replaceAllDocuments(changeIdRows: Array<{ changeId: string }>): void {
  const db = getDb();
  const ids = new Set(changeIdRows.map((r) => r.changeId));
  const rows = db.prepare('SELECT DISTINCT change_id AS changeId FROM documents').all() as Array<{ changeId: string }>;
  for (const row of rows) {
    if (!ids.has(row.changeId)) {
      db.prepare('DELETE FROM documents WHERE change_id = ?').run(row.changeId);
    }
  }
}

export function listIndexedDocuments(): Array<{ changeId: string; artifactType: ArtifactType; path: string; content: string; embedding: string }> {
  const db = getDb();
  return db.prepare('SELECT change_id AS changeId, artifact_type AS artifactType, path, content, embedding FROM documents').all() as Array<{ changeId: string; artifactType: ArtifactType; path: string; content: string; embedding: string }>;
}

export function createApproval(input: {
  id: string;
  changeId: string;
  artifactType: ArtifactType;
  decision: ApprovalDecision;
  comment: string;
  reviewer: string;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO approvals(id, change_id, artifact_type, decision, comment, reviewer, created_at, sync_status)
    VALUES(@id, @changeId, @artifactType, @decision, @comment, @reviewer, @createdAt, 'pending')
  `).run({ ...input, createdAt: new Date().toISOString() });
}

export function listApprovals(changeId?: string): Array<{
  id: string;
  changeId: string;
  artifactType: ArtifactType;
  decision: ApprovalDecision;
  comment: string;
  reviewer: string;
  createdAt: string;
  syncStatus: 'pending' | 'synced' | 'failed';
}> {
  const db = getDb();
  const stmt = changeId
    ? db.prepare(`SELECT id, change_id AS changeId, artifact_type AS artifactType, decision, comment, reviewer, created_at AS createdAt, sync_status AS syncStatus
      FROM approvals WHERE change_id = ? ORDER BY created_at DESC`)
    : db.prepare(`SELECT id, change_id AS changeId, artifact_type AS artifactType, decision, comment, reviewer, created_at AS createdAt, sync_status AS syncStatus
      FROM approvals ORDER BY created_at DESC`);
  return (changeId ? stmt.all(changeId) : stmt.all()) as Array<{
    id: string;
    changeId: string;
    artifactType: ArtifactType;
    decision: ApprovalDecision;
    comment: string;
    reviewer: string;
    createdAt: string;
    syncStatus: 'pending' | 'synced' | 'failed';
  }>;
}

export function latestDecisionByChange(): Record<string, ApprovalDecision> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT a.change_id AS changeId, a.decision
    FROM approvals a
    JOIN (
      SELECT change_id, MAX(created_at) AS max_created_at
      FROM approvals
      GROUP BY change_id
    ) latest
      ON latest.change_id = a.change_id
      AND latest.max_created_at = a.created_at
  `).all() as Array<{ changeId: string; decision: ApprovalDecision }>;

  return rows.reduce<Record<string, ApprovalDecision>>((acc, row) => {
    acc[row.changeId] = row.decision;
    return acc;
  }, {});
}

export function createSyncJob(changeId: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO sync_jobs(change_id, status, attempts, created_at, updated_at) VALUES(?, ?, 0, ?, ?)'
  ).run(changeId, 'pending', now, now);
}

export function listPendingSyncJobs(limit = 5): Array<{ id: number; changeId: string; attempts: number }> {
  const db = getDb();
  return db
    .prepare('SELECT id, change_id AS changeId, attempts FROM sync_jobs WHERE status IN (\'pending\', \'retrying\') ORDER BY updated_at ASC LIMIT ?')
    .all(limit) as Array<{ id: number; changeId: string; attempts: number }>;
}

export function updateSyncJob(id: number, status: 'done' | 'retrying' | 'failed', error = ''): void {
  const db = getDb();
  db.prepare(`
    UPDATE sync_jobs
    SET status = ?, attempts = attempts + 1, last_error = ?, updated_at = ?
    WHERE id = ?
  `).run(status, error, new Date().toISOString(), id);
}

export function markApprovalsSynced(changeId: string): void {
  const db = getDb();
  db.prepare('UPDATE approvals SET sync_status = ? WHERE change_id = ?').run('synced', changeId);
}

export function markApprovalsFailed(changeId: string): void {
  const db = getDb();
  db.prepare('UPDATE approvals SET sync_status = ? WHERE change_id = ?').run('failed', changeId);
}
