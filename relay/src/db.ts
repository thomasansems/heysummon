import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "path";

const DB_PATH = process.env.RELAY_DB_PATH || path.join(__dirname, "../data/relay.db");

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS relay_sessions (
      id TEXT PRIMARY KEY,
      ref_code TEXT UNIQUE NOT NULL,
      consumer_public_key TEXT,
      provider_public_key TEXT,
      server_public_key TEXT NOT NULL,
      server_private_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      encrypted_messages TEXT,
      encrypted_response TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_ref_code ON relay_sessions(ref_code);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON relay_sessions(status);
  `);
}

export function closeDb() {
  if (db) db.close();
}
