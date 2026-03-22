import { BaseRepository } from './base.repository';
import { AgencyRow, AgencyStatus } from '../shared/types';

interface CreateAgencyData {
  name: string;
  slug: string;
  status?: AgencyStatus;
}

export class AgencyRepository extends BaseRepository {
  async findBySlug(slug: string): Promise<AgencyRow | null> {
    return this.querySharedOne<AgencyRow>(
      'SELECT * FROM shared.agencies WHERE slug = $1',
      [slug],
    );
  }

  async create(data: CreateAgencyData): Promise<AgencyRow> {
    const rows = await this.queryShared<AgencyRow>(
      `INSERT INTO shared.agencies (name, slug, status)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.name, data.slug, data.status ?? 'active'],
    );
    return rows[0];
  }

  async findById(id: string): Promise<AgencyRow | null> {
    return this.querySharedOne<AgencyRow>(
      'SELECT * FROM shared.agencies WHERE id = $1',
      [id],
    );
  }
}
