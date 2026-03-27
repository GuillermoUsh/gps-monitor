import bcrypt from 'bcryptjs';
import { pool } from '../config/database';
import { DriverProfileRepository } from '../repositories/driver-profile.repository';
import { NotFoundError } from '../shared/errors/app.error';

const driverProfileRepository = new DriverProfileRepository();

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export const DriverProfileService = {
  async create(data: {
    nombre: string;
    apellido: string;
    email: string;
    telefono?: string | null;
    licencia?: string | null;
    vencimiento_licencia?: string | null;
  }) {
    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userResult = await client.query<{ id: string }>(
        `INSERT INTO users (email, password_hash, role, verified, must_change_password)
         VALUES ($1, $2, 'driver', true, true)
         RETURNING id`,
        [data.email, passwordHash],
      );
      const userId = userResult.rows[0].id;

      const profileResult = await client.query(
        `INSERT INTO driver_profiles (user_id, nombre, apellido, telefono, licencia, vencimiento_licencia)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          userId,
          data.nombre,
          data.apellido,
          data.telefono ?? null,
          data.licencia ?? null,
          data.vencimiento_licencia ?? null,
        ],
      );

      await client.query('COMMIT');

      return {
        driver: { ...profileResult.rows[0], email: data.email },
        password,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async list() {
    return driverProfileRepository.findAll();
  },

  async upsert(userId: string, data: {
    licencia?:             string | null;
    vencimiento_licencia?: string | null;
    telefono?:             string | null;
    nombre?:               string | null;
    apellido?:             string | null;
    curso_puerto?:         boolean;
    notas?:                string | null;
  }) {
    return driverProfileRepository.upsert(userId, data);
  },

  async getByUserId(userId: string) {
    const profile = await driverProfileRepository.findByUserId(userId);
    if (!profile) throw new NotFoundError('Perfil de conductor no encontrado');
    return profile;
  },
};
