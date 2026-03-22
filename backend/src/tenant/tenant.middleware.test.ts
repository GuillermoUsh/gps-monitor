import request from 'supertest';
import express from 'express';
import { tenantMiddleware } from './tenant.middleware';

// ===== MOCK FUNCTIONS (must start with 'mock' for Jest hoisting) =====
const mockFindBySlug = jest.fn();

jest.mock('../repositories/agency.repository', () => ({
  AgencyRepository: jest.fn().mockImplementation(() => ({
    findBySlug: mockFindBySlug,
  })),
}));

function makeTestApp() {
  const app = express();
  app.use(tenantMiddleware);
  app.get('/test', (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe('TenantMiddleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna 400 cuando no hay subdominio (dominio raíz)', async () => {
    const app = makeTestApp();
    const res = await request(app)
      .get('/test')
      .set('Host', 'gpsmonitor.com');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/subdominio/i);
  });

  it('retorna 404 cuando el subdominio no corresponde a ninguna agencia', async () => {
    mockFindBySlug.mockResolvedValue(null);

    const app = makeTestApp();
    const res = await request(app)
      .get('/test')
      .set('Host', 'inexistente.gpsmonitor.com');

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/agencia/i);
  });

  it('pasa al siguiente middleware cuando el subdominio es válido', async () => {
    mockFindBySlug.mockResolvedValue({
      id: 'agency-uuid',
      name: 'Rimatur',
      slug: 'rimatur',
      status: 'active',
      created_at: new Date(),
    });

    const app = makeTestApp();
    const res = await request(app)
      .get('/test')
      .set('Host', 'rimatur.gpsmonitor.com');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
