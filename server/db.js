import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const JOBS_DIR = path.join(DATA_DIR, 'jobs');
fs.mkdirSync(JOBS_DIR, { recursive: true });

export const db = new DatabaseSync(process.env.DB_PATH || path.join(DATA_DIR, 'codearena.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  banned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS problems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  tags TEXT NOT NULL DEFAULT '',
  statement TEXT NOT NULL DEFAULT '',
  input_spec TEXT NOT NULL DEFAULT '',
  output_spec TEXT NOT NULL DEFAULT '',
  constraints TEXT NOT NULL DEFAULT '',
  time_limit_ms INTEGER NOT NULL DEFAULT 1000,
  memory_limit_mb INTEGER NOT NULL DEFAULT 256,
  visibility TEXT NOT NULL DEFAULT 'public',
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS test_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  input TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  is_sample INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  contest_id INTEGER REFERENCES contests(id) ON DELETE SET NULL,
  mode TEXT NOT NULL DEFAULT 'submit',
  language TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  verdict TEXT,
  message TEXT,
  time_ms INTEGER,
  memory_kb INTEGER,
  score INTEGER DEFAULT 0,
  tests_passed INTEGER DEFAULT 0,
  tests_total INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  judged_at INTEGER
);

CREATE TABLE IF NOT EXISTS submission_tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  verdict TEXT NOT NULL,
  time_ms INTEGER,
  memory_kb INTEGER,
  message TEXT
);

CREATE TABLE IF NOT EXISTS contests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS contest_problems (
  contest_id INTEGER NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 1,
  score INTEGER NOT NULL DEFAULT 100,
  PRIMARY KEY (contest_id, problem_id)
);

CREATE TABLE IF NOT EXISTS contest_registrations (
  contest_id INTEGER NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registered_at INTEGER NOT NULL,
  PRIMARY KEY (contest_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sub_user ON submissions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sub_problem ON submissions(problem_id, verdict);
CREATE INDEX IF NOT EXISTS idx_test_problem ON test_cases(problem_id, position);
`);

export function get(sql, ...params) {
  return db.prepare(sql).get(...params);
}
export function all(sql, ...params) {
  return db.prepare(sql).all(...params);
}
export function run(sql, ...params) {
  return db.prepare(sql).run(...params);
}
export function tx(fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
export const now = () => Date.now();
