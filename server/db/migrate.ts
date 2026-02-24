import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function migrate(): void {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');

  try {
    db.exec(sql);
    console.log('[DB] Schema migration complete');
  } catch (err: any) {
    console.error('[DB] Migration failed:', err.message);
    throw err;
  }
}
