import { BaseRepository } from './base.repository';
import { VehicleRow } from '../shared/types';

interface CreateVehicleData {
  marca: string;
  modelo: string;
  anio?: number | null;
  patente: string;
  vin?: string | null;
  numero_motor?: string | null;
  tipo?: string | null;
  color?: string | null;
  capacidad_pasajeros?: number | null;
  estado?: string;
  kilometraje?: number;
  notas?: string | null;
}

interface UpdateVehicleData extends Partial<CreateVehicleData> {}

export interface EstadoCount {
  disponible:        number;
  en_uso:            number;
  en_mantenimiento:  number;
  fuera_de_servicio: number;
}

export class VehicleRepository extends BaseRepository {
  async findAll(filters?: { estado?: string; search?: string }): Promise<VehicleRow[]> {
    const conditions: string[] = [];
    const params: unknown[]    = [];

    if (filters?.estado) {
      params.push(filters.estado);
      conditions.push(`estado = $${params.length}`);
    }

    if (filters?.search) {
      params.push(`%${filters.search}%`);
      const idx = params.length;
      conditions.push(`(marca ILIKE $${idx} OR modelo ILIKE $${idx} OR patente ILIKE $${idx})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return this.query<VehicleRow>(
      `SELECT * FROM vehicles ${where} ORDER BY created_at DESC`,
      params,
    );
  }

  async findById(id: string): Promise<VehicleRow | null> {
    return this.queryOne<VehicleRow>(
      'SELECT * FROM vehicles WHERE id = $1',
      [id],
    );
  }

  async create(data: CreateVehicleData): Promise<VehicleRow> {
    const rows = await this.query<VehicleRow>(
      `INSERT INTO vehicles (marca, modelo, anio, patente, vin, numero_motor, tipo, color, capacidad_pasajeros, estado, kilometraje, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        data.marca,
        data.modelo,
        data.anio ?? null,
        data.patente,
        data.vin ?? null,
        data.numero_motor ?? null,
        data.tipo ?? null,
        data.color ?? null,
        data.capacidad_pasajeros ?? null,
        data.estado ?? 'disponible',
        data.kilometraje ?? 0,
        data.notas ?? null,
      ],
    );
    return rows[0];
  }

  async update(id: string, data: UpdateVehicleData): Promise<VehicleRow | null> {
    const fields  = Object.keys(data) as (keyof UpdateVehicleData)[];
    if (fields.length === 0) return this.findById(id);

    const setClauses = fields.map((key, i) => `${key} = $${i + 2}`).join(', ');
    const values     = fields.map(key => data[key]);

    const rows = await this.query<VehicleRow>(
      `UPDATE vehicles SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values],
    );
    return rows[0] ?? null;
  }

  async delete(id: string): Promise<void> {
    await this.query('DELETE FROM vehicles WHERE id = $1', [id]);
  }

  async countByEstado(): Promise<EstadoCount> {
    const rows = await this.query<{ estado: string; count: string }>(
      `SELECT estado, COUNT(*)::int AS count FROM vehicles GROUP BY estado`,
    );

    const result: EstadoCount = {
      disponible:        0,
      en_uso:            0,
      en_mantenimiento:  0,
      fuera_de_servicio: 0,
    };

    for (const row of rows) {
      const key = row.estado as keyof EstadoCount;
      if (key in result) result[key] = Number(row.count);
    }

    return result;
  }
}
