// Database layer. SQLite stands in for the HighLevel AI Studio Cloud database.
// Every user-owned query in this app goes through helpers that filter by the
// signed-in user's id. See docs/highlevel-rls.sql for the equivalent
// Postgres row-level-security policies to apply in the Cloud database.
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','owner')),
  marketing_opt_in INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

-- Compliance tables -------------------------------------------------------
CREATE TABLE IF NOT EXISTS consent_records (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  user_id TEXT,
  choice TEXT NOT NULL CHECK (choice IN ('accept_all','reject_all','custom')),
  categories TEXT NOT NULL,
  banner_version TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  region TEXT NOT NULL,
  gpc INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  user_agent TEXT
);
CREATE TRIGGER IF NOT EXISTS consent_records_no_update BEFORE UPDATE ON consent_records
BEGIN SELECT RAISE(ABORT, 'consent_records is append-only'); END;
CREATE TRIGGER IF NOT EXISTS consent_records_no_delete BEFORE DELETE ON consent_records
BEGIN SELECT RAISE(ABORT, 'consent_records is append-only'); END;

CREATE TABLE IF NOT EXISTS signup_consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  marketing_opt_in INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS data_requests (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('access','delete','correct')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','done')),
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS email_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_addr TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Product tables (all owned by user_id) -----------------------------------
CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS label_scans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  serving TEXT,
  added_sugar REAL NOT NULL,
  fiber REAL NOT NULL,
  protein REAL NOT NULL,
  total_carbs REAL NOT NULL,
  fat REAL NOT NULL DEFAULT 0,
  ingredients TEXT NOT NULL DEFAULT '',
  score INTEGER NOT NULL,
  result TEXT NOT NULL,
  photo_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS plates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  items TEXT NOT NULL,
  totals TEXT NOT NULL,
  tips TEXT NOT NULL,
  photo_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS food_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date TEXT NOT NULL,
  meal TEXT NOT NULL,
  label TEXT NOT NULL,
  emoji TEXT,
  protein REAL NOT NULL DEFAULT 0,
  fiber REAL NOT NULL DEFAULT 0,
  added_sugar REAL NOT NULL DEFAULT 0,
  carbs REAL NOT NULL DEFAULT 0,
  fat REAL NOT NULL DEFAULT 0,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS food_logs_user_date ON food_logs(user_id, log_date);
CREATE TABLE IF NOT EXISTS targets (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  protein REAL NOT NULL DEFAULT 90,
  fiber REAL NOT NULL DEFAULT 25,
  added_sugar REAL NOT NULL DEFAULT 25
);
CREATE TABLE IF NOT EXISTS meal_plans (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start TEXT NOT NULL,
  slots TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, week_start)
);
CREATE TABLE IF NOT EXISTS checkins (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  energy INTEGER CHECK (energy BETWEEN 1 AND 5),
  mood INTEGER CHECK (mood BETWEEN 1 AND 5),
  cravings INTEGER CHECK (cravings BETWEEN 1 AND 5),
  sleep INTEGER CHECK (sleep BETWEEN 1 AND 5),
  period TEXT CHECK (period IN ('none','spotting','period')),
  symptoms TEXT NOT NULL DEFAULT '[]',
  note TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, day)
);
CREATE TABLE IF NOT EXISTS labs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  value REAL NOT NULL,
  value2 REAL,
  taken_on TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS labs_user ON labs(user_id, kind, taken_on);
CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, lesson_id)
);
`);

// Small migrations for columns added after first release.
const userCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
if (!userCols.includes('focus')) db.exec("ALTER TABLE users ADD COLUMN focus TEXT NOT NULL DEFAULT 'pcos'");

module.exports = { db, DATA_DIR };
