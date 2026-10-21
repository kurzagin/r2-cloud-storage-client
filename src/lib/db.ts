import { createClient, type Client } from '@libsql/client';
import path from 'path';

let client: Client | null = null;

export function getDb(): Client {
  if (!client) {
    const dbUrl = process.env.DATABASE_URL || 'file:./storage.db';
    client = createClient({
      url: dbUrl,
    });
    // Initialize schema synchronously on first connection
    initSchema(client);
  }
  return client;
}

let schemaInitialized = false;

export async function initSchema(db: Client) {
  if (schemaInitialized) return;
  schemaInitialized = true;

  await db.batch([
    `CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      color TEXT DEFAULT '#c49368',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      is_starred INTEGER DEFAULT 0,
      is_trashed INTEGER DEFAULT 0,
      FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      folder_id TEXT,
      name TEXT NOT NULL,
      r2_key TEXT NOT NULL,
      size INTEGER NOT NULL,
      content_type TEXT NOT NULL,
      public_url TEXT,
      etag TEXT,
      is_starred INTEGER DEFAULT 0,
      is_trashed INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );`
  ]);
}
