import { AsyncLocalStorage } from 'async_hooks';
import { TenantContext } from '../shared/types';
import { TenantContextMissingError } from '../shared/errors/app.error';

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext {
  const store = tenantStorage.getStore();
  if (!store) {
    throw new TenantContextMissingError();
  }
  return store;
}
