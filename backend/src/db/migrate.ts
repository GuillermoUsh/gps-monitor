import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';

const SHARED_MIGRATIONS_DIR = path.join(__dirname, '../../../db/migrations/shared');
const TENANT_MIGRATIONS_DIR = path.join(__dirname, '../../../db/migrations/tenant');

export async function runSharedMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS shared');

    const files = fs
      .readdirSync(SHARED_MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(SHARED_MIGRATIONS_DIR, file), 'utf8');
      await client.query(sql);
      console.log(`[migrate] shared: ${file} ✓`);
    }
  } finally {
    client.release();
  }
}

export async function runTenantMigrations(schema: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);

    const files = fs
      .readdirSync(TENANT_MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(TENANT_MIGRATIONS_DIR, file), 'utf8');
      await client.query(`SET search_path = ${schema}, public`);
      await client.query(sql);
      console.log(`[migrate] ${schema}: ${file} ✓`);
    }
  } finally {
    client.release();
  }
}

// Run when executed directly
if (require.main === module) {
  runSharedMigrations()
    .then(() => {
      console.log('[migrate] All shared migrations complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[migrate] Failed:', err);
      process.exit(1);
    });
}
