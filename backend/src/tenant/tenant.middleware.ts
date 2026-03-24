import { Request, Response, NextFunction } from 'express';
import { AgencyRepository } from '../repositories/agency.repository';
import { tenantStorage } from './tenant.context';

export async function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const hostname = req.hostname;
  const parts = hostname.split('.');

  // Try subdomain first (fria.localhost or fria.domain.com)
  const isLocalhostDev = parts.length === 2 && parts[1] === 'localhost';
  const hasSubdomain = (parts.length === 3 || isLocalhostDev) && parts[0] !== 'www';

  // Fallback: X-Agency-Slug header (for ngrok / single-domain deployments)
  const headerSlug = req.headers['x-agency-slug'] as string | undefined;

  const slug = hasSubdomain ? parts[0] : headerSlug?.trim();

  if (!slug) {
    res.status(400).json({ status: 'error', message: 'Subdominio de agencia requerido' });
    return;
  }

  const agencyRepository = new AgencyRepository();
  const agency = await agencyRepository.findBySlug(slug).catch(() => null);

  if (!agency) {
    res.status(404).json({ status: 'error', message: 'Agencia no encontrada' });
    return;
  }

  const context = {
    schema: `agency_${slug}`,
    agencyId: agency.id,
    slug,
  };

  tenantStorage.run(context, next);
}
