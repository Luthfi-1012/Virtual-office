import type Database from 'better-sqlite3';

export function migrate(db: Database.Database) {
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  const version = db.pragma('user_version', { simple: true });
  if (version === 2) return;
  if (version !== 0 && version !== 1) throw new Error('Versi database tidak didukung.');
  db.transaction(() => {
    if (version === 0) db.exec(`
      CREATE TABLE jobs (id TEXT PRIMARY KEY, version INTEGER NOT NULL, status TEXT NOT NULL, brief TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE runs (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id), version INTEGER NOT NULL, source TEXT NOT NULL, input TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE UNIQUE INDEX run_version ON runs(job_id, version);
      CREATE TABLE steps (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL REFERENCES jobs(id), run_id TEXT NOT NULL REFERENCES runs(id), stage TEXT NOT NULL, status TEXT NOT NULL, summary TEXT NOT NULL, next_owner TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE artifacts (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL REFERENCES jobs(id), run_id TEXT NOT NULL REFERENCES runs(id), version INTEGER NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL);
      CREATE UNIQUE INDEX artifact_version ON artifacts(job_id, version, kind);
      CREATE TABLE approvals (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL REFERENCES jobs(id), run_id TEXT NOT NULL REFERENCES runs(id), version INTEGER NOT NULL, decision TEXT NOT NULL, actor TEXT NOT NULL, scope TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE operations (key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, result TEXT NOT NULL);
      CREATE TABLE audit (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL REFERENCES jobs(id), run_id TEXT NOT NULL REFERENCES runs(id), version INTEGER NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE controls (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id), action TEXT NOT NULL, state TEXT NOT NULL, created_at TEXT NOT NULL);
    `);
    db.exec(`
      CREATE TABLE native_requests (fingerprint TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, run_id TEXT UNIQUE, created_at TEXT NOT NULL);
      PRAGMA user_version = 2;
    `);
  }).immediate();
}
