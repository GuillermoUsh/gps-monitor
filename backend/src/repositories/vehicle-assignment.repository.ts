import { BaseRepository } from './base.repository';
import { VehicleAssignmentRow } from '../shared/types';

export class VehicleAssignmentRepository extends BaseRepository {
  async findCurrentByVehicle(vehicleId: string): Promise<VehicleAssignmentRow | null> {
    return this.queryOne<VehicleAssignmentRow>(
      `SELECT * FROM vehicle_assignments WHERE vehicle_id = $1 AND unassigned_at IS NULL`,
      [vehicleId],
    );
  }

  async findCurrentByDriver(driverId: string): Promise<VehicleAssignmentRow | null> {
    return this.queryOne<VehicleAssignmentRow>(
      `SELECT * FROM vehicle_assignments WHERE driver_id = $1 AND unassigned_at IS NULL`,
      [driverId],
    );
  }

  async assign(vehicleId: string, driverId: string, notes?: string): Promise<VehicleAssignmentRow> {
    const rows = await this.query<VehicleAssignmentRow>(
      `INSERT INTO vehicle_assignments (vehicle_id, driver_id, notes)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [vehicleId, driverId, notes ?? null],
    );
    return rows[0];
  }

  async unassign(vehicleId: string): Promise<VehicleAssignmentRow | null> {
    const rows = await this.query<VehicleAssignmentRow>(
      `UPDATE vehicle_assignments
       SET unassigned_at = NOW()
       WHERE vehicle_id = $1 AND unassigned_at IS NULL
       RETURNING *`,
      [vehicleId],
    );
    return rows[0] ?? null;
  }
}
