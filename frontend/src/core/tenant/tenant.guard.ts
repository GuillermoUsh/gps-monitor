import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TenantService } from './tenant.service';

export const tenantGuard: CanActivateFn = () => {
  const tenantService = inject(TenantService);
  const router        = inject(Router);

  if (tenantService.agencySlug()) {
    return true;
  }

  return router.createUrlTree(['/setup']);
};
