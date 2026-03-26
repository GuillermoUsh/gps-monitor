import { BaseRepository } from './base.repository';
import { MaintenanceRow } from '../shared/types';

interface CreateMaintenanceData {
  vehicle_id:           string;
  tipo:                 string;
  descripcion?:         string | null;
  fecha:                string;
  kilometraje?:         number | null;
  proximo_service_km?:  number | null;
  proximo_service_fecha?: string | null;
}

export interface PendingServiceRow extends MaintenanceRow {
  vehicle_patente: string;
  vehicle_marca:   string;
  vehicle_modelo:  string;
  vehicle_kilometraje: number;
}

export class MaintenanceRepository extends BaseRepository {
  async findByVehicleId(vehicleId: string): Promise<MaintenanceRow[]> {
    return this.query<MaintenanceRow>(
      `SELECT * FROM maintenances WHERE vehicle_id = $1 ORDER BY fecha DESC`,
      [vehicleId],
    );
  }

  async create(data: CreateMaintenanceData): Promise<MaintenanceRow> {
    const rows = await this.query<MaintenanceRow>(
      `INSERT INTO maintenances (vehicle_id, tipo, descripcion, fecha, kilometraje, proximo_service_km, proximo_service_fecha)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.vehicle_id,
        data.tipo,
        data.descripcion ?? null,
        data.fecha,
        data.kilometraje ?? null,
        data.proximo_service_km ?? null,
        data.proximo_service_fecha ?? null,
      ],
    );
    return rows[0];
  }

  async findPendingServices(): Promise<PendingServiceRow[]> {
    return this.query<PendingServiceRow>(
      `SELECT DISTINCT ON (m.vehicle_id)
         m.*,
         v.patente  AS vehicle_patente,
         v.marca    AS vehicle_marca,
         v.modelo   AS vehicle_modelo,
         v.kilometraje AS vehicle_kilometraje
       FROM maintenances m
       JOIN vehicles v ON v.id = m.vehicle_id
       WHERE (
         m.proximo_service_fecha IS NOT NULL
         AND m.proximo_service_fecha <= NOW() + INTERVAL '30 days'
       ) OR (
         m.proximo_service_km IS NOT NULL
         AND v.kilometraje >= m.proximo_service_km
       )
       ORDER BY m.vehicle_id, m.fecha DESC`,
    );
  }
}
