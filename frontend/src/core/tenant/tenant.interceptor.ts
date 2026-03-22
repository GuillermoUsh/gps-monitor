import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TenantService } from './tenant.service';

export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  const tenantService = inject(TenantService);
  const slug = tenantService.agencySlug();

  const headers: Record<string, string> = {
    'bypass-tunnel-reminder': 'true',
  };

  // Only add slug header when not using subdomain routing
  const isSubdomainRouting = req.url.includes(`${slug}.localhost`);
  if (slug && slug !== 'demo' && !isSubdomainRouting) {
    headers['X-Agency-Slug'] = slug;
  }

  req = req.clone({ setHeaders: headers });
  return next(req);
};
