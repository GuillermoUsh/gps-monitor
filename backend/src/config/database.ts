import { Pool } from 'pg';
import { env } from './env';

export const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  if (env.NODE_ENV !== 'test') {
    console.log('[db] Connected to PostgreSQL');
  }
});

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client:', err);
  process.exit(1);
});

export async function closeDatabase(): Promise<void> {
  await pool.end();
  console.log('[db] Connection pool closed');
}
