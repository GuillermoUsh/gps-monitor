import { BaseRepository } from './base.repository';
import { DriverDocumentRow } from '../shared/types';

export class DriverDocumentRepository extends BaseRepository {
  async findByDriverId(driverId: string): Promise<DriverDocumentRow[]> {
    return this.query<DriverDocumentRow>(
      'SELECT * FROM driver_documents WHERE driver_id = $1 ORDER BY fecha_vencimiento ASC',
      [driverId],
    );
  }

  async create(data: {
    driver_id: string;
    tipo: string;
    descripcion?: string | null;
    fecha_vencimiento: string;
  }): Promise<DriverDocumentRow> {
    const rows = await this.query<DriverDocumentRow>(
      `INSERT INTO driver_documents (driver_id, tipo, descripcion, fecha_vencimiento)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.driver_id, data.tipo, data.descripcion ?? null, data.fecha_vencimiento],
    );
    return rows[0];
  }

  async delete(id: string): Promise<void> {
    await this.query('DELETE FROM driver_documents WHERE id = $1', [id]);
  }
}
