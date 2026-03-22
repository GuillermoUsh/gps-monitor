import { getTenantContext, tenantStorage } from './tenant.context';
import { TenantContextMissingError } from '../shared/errors/app.error';

describe('TenantContext', () => {
  it('lanza TenantContextMissingError cuando se llama fuera de AsyncLocalStorage.run()', () => {
    expect(() => getTenantContext()).toThrow(TenantContextMissingError);
  });

  it('retorna el contexto cuando está dentro de AsyncLocalStorage.run()', () => {
    const context = { schema: 'agency_test', agencyId: 'uuid-123', slug: 'test' };

    tenantStorage.run(context, () => {
      const result = getTenantContext();
      expect(result).toEqual(context);
    });
  });

  it('contextos distintos no se interfieren entre sí', async () => {
    const ctx1 = { schema: 'agency_rimatur', agencyId: 'id-1', slug: 'rimatur' };
    const ctx2 = { schema: 'agency_patagonia', agencyId: 'id-2', slug: 'patagonia' };

    const results: string[] = [];

    await Promise.all([
      new Promise<void>((resolve) =>
        tenantStorage.run(ctx1, async () => {
          await new Promise((r) => setTimeout(r, 10));
          results.push(getTenantContext().schema);
          resolve();
        }),
      ),
      new Promise<void>((resolve) =>
        tenantStorage.run(ctx2, async () => {
          await new Promise((r) => setTimeout(r, 5));
          results.push(getTenantContext().schema);
          resolve();
        }),
      ),
    ]);

    expect(results).toContain('agency_rimatur');
    expect(results).toContain('agency_patagonia');
    expect(results).toHaveLength(2);
  });
});
