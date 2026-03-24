import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';

const MIGRATIONS_DIR = path.join(__dirname, '../../../db/migrations');

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query(sql);
      console.log(`[migrate] ${file} ✓`);
    }
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => { console.log('[migrate] Done'); process.exit(0); })
    .catch(err => { console.error('[migrate] Failed:', err); process.exit(1); });
}
