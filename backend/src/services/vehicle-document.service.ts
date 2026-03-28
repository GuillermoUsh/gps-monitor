import { VehicleDocumentRepository } from '../repositories/vehicle-document.repository';
import { NotFoundError } from '../shared/errors/app.error';

const vehicleDocumentRepository = new VehicleDocumentRepository();

export const VehicleDocumentService = {
  async listByVehicle(vehicleId: string) {
    return vehicleDocumentRepository.findByVehicleId(vehicleId);
  },

  async create(vehicleId: string, data: {
    tipo:              string;
    descripcion?:      string | null;
    codigo?:           string | null;
    fecha_vencimiento: string;
  }) {
    return vehicleDocumentRepository.create({
      vehicle_id:        vehicleId,
      tipo:              data.tipo,
      descripcion:       data.descripcion,
      codigo:            data.codigo,
      fecha_vencimiento: data.fecha_vencimiento,
    });
  },

  async update(id: string, data: {
    tipo?:              string;
    descripcion?:       string | null;
    codigo?:            string | null;
    fecha_vencimiento?: string;
  }) {
    const updated = await vehicleDocumentRepository.update(id, data);
    if (!updated) throw new NotFoundError('Documento no encontrado');
    return updated;
  },

  async delete(id: string): Promise<void> {
    await vehicleDocumentRepository.delete(id);
  },
};
