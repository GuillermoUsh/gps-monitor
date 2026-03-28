import { MaintenanceRepository } from '../repositories/maintenance.repository';
import { NotFoundError } from '../shared/errors/app.error';

const maintenanceRepository = new MaintenanceRepository();

export const MaintenanceService = {
  async listByVehicle(vehicleId: string) {
    return maintenanceRepository.findByVehicleId(vehicleId);
  },

  async update(id: string, data: {
    tipo?:                 string;
    descripcion?:          string | null;
    fecha?:                string;
    kilometraje?:          number | null;
    proximo_service_km?:   number | null;
    proximo_service_fecha?: string | null;
  }) {
    const updated = await maintenanceRepository.update(id, data);
    if (!updated) throw new NotFoundError('Mantenimiento no encontrado');
    return updated;
  },

  async create(vehicleId: string, data: {
    tipo:                  string;
    descripcion?:          string | null;
    fecha:                 string;
    kilometraje?:          number | null;
    proximo_service_km?:   number | null;
    proximo_service_fecha?: string | null;
  }) {
    return maintenanceRepository.create({
      vehicle_id:            vehicleId,
      tipo:                  data.tipo,
      descripcion:           data.descripcion,
      fecha:                 data.fecha,
      kilometraje:           data.kilometraje,
      proximo_service_km:    data.proximo_service_km,
      proximo_service_fecha: data.proximo_service_fecha,
    });
  },
};
