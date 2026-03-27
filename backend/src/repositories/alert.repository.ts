import { BaseRepository } from './base.repository';
import { AlertItem } from '../shared/types';

export class AlertRepository extends BaseRepository {
  async findExpiring(days: number): Promise<AlertItem[]> {
    const rows = await this.query<any>(
      `SELECT
         vd.id,
         'vehicle_document' AS tipo,
         COALESCE(v.alias, v.patente) AS entidad,
         v.id AS entidad_id,
         vd.tipo AS subtipo,
         vd.fecha_vencimiento,
         vd.fecha_vencimiento::date - CURRENT_DATE AS dias_restantes,
         vd.codigo
       FROM vehicle_documents vd
       JOIN vehicles v ON v.id = vd.vehicle_id
       WHERE vd.fecha_vencimiento <= CURRENT_DATE + ($1 || ' days')::interval

       UNION ALL

       SELECT
         dd.id,
         'driver_document' AS tipo,
         COALESCE(dp.nombre || ' ' || dp.apellido, u.email) AS entidad,
         dp.id AS entidad_id,
         dd.tipo AS subtipo,
         dd.fecha_vencimiento,
         dd.fecha_vencimiento::date - CURRENT_DATE AS dias_restantes,
         NULL AS codigo
       FROM driver_documents dd
       JOIN driver_profiles dp ON dp.id = dd.driver_id
       JOIN users u ON u.id = dp.user_id
       WHERE dd.fecha_vencimiento <= CURRENT_DATE + ($1 || ' days')::interval

       UNION ALL

       SELECT
         m.id,
         'turno_mecanico' AS tipo,
         COALESCE(v.alias, v.patente) AS entidad,
         v.id AS entidad_id,
         COALESCE(m.turno_descripcion, 'Turno mecánico') AS subtipo,
         m.turno_fecha AS fecha_vencimiento,
         m.turno_fecha::date - CURRENT_DATE AS dias_restantes,
         NULL AS codigo
       FROM maintenances m
       JOIN vehicles v ON v.id = m.vehicle_id
       WHERE m.turno_fecha IS NOT NULL
         AND m.turno_fecha >= CURRENT_DATE
         AND m.turno_fecha <= CURRENT_DATE + ($1 || ' days')::interval

       ORDER BY dias_restantes ASC`,
      [days],
    );

    return rows.map((r: any) => ({
      ...r,
      dias_restantes: parseInt(r.dias_restantes, 10),
    }));
  }
}
