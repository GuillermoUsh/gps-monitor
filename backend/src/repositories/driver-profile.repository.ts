import { BaseRepository } from './base.repository';
import { DriverProfileRow } from '../shared/types';

export interface DriverProfileWithEmail extends DriverProfileRow {
  email: string;
}

interface UpsertDriverProfileData {
  licencia:             string;
  vencimiento_licencia?: string | null;
  telefono?:            string | null;
}

export class DriverProfileRepository extends BaseRepository {
  async findAll(): Promise<DriverProfileWithEmail[]> {
    return this.query<DriverProfileWithEmail>(
      `SELECT dp.*, u.email
       FROM driver_profiles dp
       JOIN users u ON u.id = dp.user_id
       ORDER BY dp.created_at DESC`,
    );
  }

  async findByUserId(userId: string): Promise<DriverProfileWithEmail | null> {
    return this.queryOne<DriverProfileWithEmail>(
      `SELECT dp.*, u.email
       FROM driver_profiles dp
       JOIN users u ON u.id = dp.user_id
       WHERE dp.user_id = $1`,
      [userId],
    );
  }

  async upsert(userId: string, data: UpsertDriverProfileData): Promise<DriverProfileRow> {
    const rows = await this.query<DriverProfileRow>(
      `INSERT INTO driver_profiles (user_id, licencia, vencimiento_licencia, telefono)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
         SET licencia             = EXCLUDED.licencia,
             vencimiento_licencia = EXCLUDED.vencimiento_licencia,
             telefono             = EXCLUDED.telefono,
             updated_at           = NOW()
       RETURNING *`,
      [
        userId,
        data.licencia,
        data.vencimiento_licencia ?? null,
        data.telefono ?? null,
      ],
    );
    return rows[0];
  }
}
