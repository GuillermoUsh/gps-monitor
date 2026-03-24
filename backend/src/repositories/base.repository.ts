import { QueryResultRow } from 'pg';
import { pool } from '../config/database';

export class BaseRepository {
  protected async query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    const client = await pool.connect();
    try {
      const result = await client.query<T>(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  protected async queryOne<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }
}
