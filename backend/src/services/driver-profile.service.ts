import { DriverProfileRepository } from '../repositories/driver-profile.repository';
import { NotFoundError } from '../shared/errors/app.error';

const driverProfileRepository = new DriverProfileRepository();

export const DriverProfileService = {
  async list() {
    return driverProfileRepository.findAll();
  },

  async upsert(userId: string, data: {
    licencia:              string;
    vencimiento_licencia?: string | null;
    telefono?:             string | null;
  }) {
    return driverProfileRepository.upsert(userId, data);
  },

  async getByUserId(userId: string) {
    const profile = await driverProfileRepository.findByUserId(userId);
    if (!profile) throw new NotFoundError('Perfil de conductor no encontrado');
    return profile;
  },
};
