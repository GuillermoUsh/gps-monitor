import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TenantService {

  private resolveSlug(): string {
    // 1. Subdomain: fria.localhost or fria.domain.com
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    if (parts.length >= 2 && parts[0] !== 'localhost' && parts[0] !== 'www') {
      return parts[0];
    }
    // 2. Query param: ?agency=fria
    const params = new URLSearchParams(window.location.search);
    const qp = params.get('agency');
    if (qp) {
      localStorage.setItem('agency_slug', qp);
      return qp;
    }
    // 3. Persisted
    return localStorage.getItem('agency_slug') ?? '';
  }

  agencySlug(): string {
    return this.resolveSlug();
  }

  getApiBase(): string {
    const slug = this.resolveSlug();

    // Relative URL (Docker/single-domain): use as-is, slug goes via header
    if (environment.apiUrl.startsWith('/')) {
      return environment.apiUrl;
    }

    // Subdomain routing only when browser is already on a subdomain
    const hostname = window.location.hostname;
    const onSubdomain = hostname.split('.').length >= 2 && hostname !== 'localhost';
    if (onSubdomain && slug && slug !== 'demo') {
      return environment.apiUrl.replace('://localhost', `://${slug}.localhost`);
    }

    // Plain localhost: use header (tenantInterceptor adds X-Agency-Slug)
    return environment.apiUrl;
  }
}
