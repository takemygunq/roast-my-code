import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { dataDir } from "../paths";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle> | null = null;

export function db() {
  if (_db) return _db;
  const dir = dataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const sqlite = new Database(path.join(dir, "roast.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      encrypted_key TEXT NOT NULL DEFAULT '',
      base_url TEXT,
      models TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS roasts (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'pending',
      input_type TEXT NOT NULL,
      input_source TEXT,
      code TEXT NOT NULL DEFAULT '',
      code_snapshot TEXT,
      selected_roasters TEXT NOT NULL DEFAULT '[]',
      model_assignments TEXT NOT NULL DEFAULT '{}',
      results TEXT NOT NULL DEFAULT '[]',
      overall_score INTEGER,
      error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS roast_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roast_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    );
  `);
  _db = drizzle(sqlite, { schema });
  return _db;
}
