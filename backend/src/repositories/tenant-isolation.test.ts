/**
 * Integration test: verifica que queries ejecutadas en contexto de tenant A
 * no devuelven datos del tenant B.
 *
 * Requiere PostgreSQL real — se ejecuta con `npm run test:integration`
 * Saltear en CI si no hay DB disponible.
 */

// Skip if no real DB available (requires Docker / npm run test:integration)
const INTEGRATION = process.env.RUN_INTEGRATION === 'true';

import { pool } from '../config/database';
import { tenantStorage } from '../tenant/tenant.context';
import { runTenantMigrations } from '../db/migrate';
import { UserRepository } from './user.repository';
import crypto from 'crypto';

const SCHEMA_A = 'agency_test_isolation_a';
const SCHEMA_B = 'agency_test_isolation_b';

async function setupSchema(schema: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.query(`CREATE SCHEMA ${schema}`);
  } finally {
    client.release();
  }
  await runTenantMigrations(schema);
}

async function teardownSchema(schema: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  } finally {
    client.release();
  }
}

const describeIntegration = INTEGRATION ? describe : describe.skip;

describeIntegration('Tenant isolation (integration)', () => {
  beforeAll(async () => {
    await setupSchema(SCHEMA_A);
    await setupSchema(SCHEMA_B);
  });

  afterAll(async () => {
    await teardownSchema(SCHEMA_A);
    await teardownSchema(SCHEMA_B);
    await pool.end();
  });

  it('usuario creado en schema A no aparece en schema B', async () => {
    const userRepo = new UserRepository();
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Crear usuario en schema A
    await new Promise<void>((resolve, reject) => {
      tenantStorage.run({ schema: SCHEMA_A, agencyId: 'id-a', slug: 'test-a' }, async () => {
        try {
          await userRepo.create({
            email: 'usuario-a@test.com',
            passwordHash: 'hash',
            verificationToken: token,
            verificationTokenExpires: expires,
          });
          resolve();
        } catch (e) { reject(e); }
      });
    });

    // Buscar ese usuario en schema B — debe retornar null
    let foundInB: unknown = 'NOT_CHECKED';
    await new Promise<void>((resolve, reject) => {
      tenantStorage.run({ schema: SCHEMA_B, agencyId: 'id-b', slug: 'test-b' }, async () => {
        try {
          foundInB = await userRepo.findByEmail('usuario-a@test.com');
          resolve();
        } catch (e) { reject(e); }
      });
    });

    expect(foundInB).toBeNull();
  });
});
