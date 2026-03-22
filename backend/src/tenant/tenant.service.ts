import { pool } from '../config/database';
import { runTenantMigrations } from '../db/migrate';

export class TenantService {
  async provisionSchema(slug: string): Promise<void> {
    const schema = `agency_${slug}`;
    const client = await pool.connect();
    try {
      // Validate slug to prevent SQL injection (only alphanumeric + hyphens allowed)
      if (!/^[a-z0-9-]+$/.test(slug)) {
        throw new Error(`Invalid slug format: ${slug}`);
      }
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    } finally {
      client.release();
    }
    await runTenantMigrations(schema);
  }
}
