import { AgencyRepository } from '../repositories/agency.repository';
import { TenantService } from '../tenant/tenant.service';
import { AuthService } from './auth.service';
import { ConflictError } from '../shared/errors/app.error';
import { tenantStorage } from '../tenant/tenant.context';

const agencyRepository = new AgencyRepository();
const tenantService = new TenantService();

function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export const AgencyService = {
  async create(
    name: string,
    slug: string,
    adminEmail: string,
    adminPassword: string,
  ): Promise<{ agencyId: string }> {
    const sanitizedSlug = sanitizeSlug(slug);

    if (sanitizedSlug.length < 3 || sanitizedSlug.length > 30) {
      throw new ConflictError('El slug debe tener entre 3 y 30 caracteres');
    }

    const existing = await agencyRepository.findBySlug(sanitizedSlug);
    if (existing) {
      throw new ConflictError('El slug ya está en uso');
    }

    const agency = await agencyRepository.create({
      name,
      slug: sanitizedSlug,
      status: 'active',
    });

    await tenantService.provisionSchema(sanitizedSlug);

    const schema = `agency_${sanitizedSlug}`;
    await new Promise<void>((resolve, reject) => {
      tenantStorage.run(
        { schema, agencyId: agency.id, slug: sanitizedSlug },
        async () => {
          try {
            await AuthService.register(adminEmail, adminPassword);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
      );
    });

    return { agencyId: agency.id };
  },

  sanitizeSlug,
};
