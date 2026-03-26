import { BaseRepository } from './base.repository';
import { VehicleDocumentRow } from '../shared/types';

interface CreateDocumentData {
  vehicle_id:       string;
  tipo:             string;
  descripcion?:     string | null;
  fecha_vencimiento: string;
}

interface UpdateDocumentData {
  tipo?:             string;
  descripcion?:      string | null;
  fecha_vencimiento?: string;
}

interface ExpiringDocumentRow extends VehicleDocumentRow {
  vehicle_patente: string;
  vehicle_marca:   string;
  vehicle_modelo:  string;
}

export class VehicleDocumentRepository extends BaseRepository {
  async findByVehicleId(vehicleId: string): Promise<VehicleDocumentRow[]> {
    return this.query<VehicleDocumentRow>(
      `SELECT * FROM vehicle_documents WHERE vehicle_id = $1 ORDER BY fecha_vencimiento ASC`,
      [vehicleId],
    );
  }

  async findExpiringWithin(days: number): Promise<ExpiringDocumentRow[]> {
    return this.query<ExpiringDocumentRow>(
      `SELECT vd.*, v.patente AS vehicle_patente, v.marca AS vehicle_marca, v.modelo AS vehicle_modelo
       FROM vehicle_documents vd
       JOIN vehicles v ON v.id = vd.vehicle_id
       WHERE vd.fecha_vencimiento <= NOW() + ($1 || ' days')::INTERVAL
         AND vd.fecha_vencimiento >= NOW()
       ORDER BY vd.fecha_vencimiento ASC`,
      [days],
    );
  }

  async create(data: CreateDocumentData): Promise<VehicleDocumentRow> {
    const rows = await this.query<VehicleDocumentRow>(
      `INSERT INTO vehicle_documents (vehicle_id, tipo, descripcion, fecha_vencimiento)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        data.vehicle_id,
        data.tipo,
        data.descripcion ?? null,
        data.fecha_vencimiento,
      ],
    );
    return rows[0];
  }

  async update(id: string, data: UpdateDocumentData): Promise<VehicleDocumentRow | null> {
    const fields  = Object.keys(data) as (keyof UpdateDocumentData)[];
    if (fields.length === 0) return this.queryOne<VehicleDocumentRow>('SELECT * FROM vehicle_documents WHERE id = $1', [id]);

    const setClauses = fields.map((key, i) => `${key} = $${i + 2}`).join(', ');
    const values     = fields.map(key => data[key]);

    const rows = await this.query<VehicleDocumentRow>(
      `UPDATE vehicle_documents SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values],
    );
    return rows[0] ?? null;
  }

  async delete(id: string): Promise<void> {
    await this.query('DELETE FROM vehicle_documents WHERE id = $1', [id]);
  }
}
