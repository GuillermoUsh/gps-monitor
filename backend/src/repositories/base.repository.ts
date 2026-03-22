import { QueryResultRow } from 'pg';
import { pool } from '../config/database';
import { getTenantContext } from '../tenant/tenant.context';

export class BaseRepository {
  protected async query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    const { schema } = getTenantContext();
    const client = await pool.connect();
    try {
      await client.query(`SET search_path = ${schema}, public`);
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

  protected async queryShared<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    const client = await pool.connect();
    try {
      await client.query('SET search_path = shared, public');
      const result = await client.query<T>(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  protected async querySharedOne<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.queryShared<T>(sql, params);
    return rows[0] ?? null;
  }
}
