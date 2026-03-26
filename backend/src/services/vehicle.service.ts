import { VehicleRepository }         from '../repositories/vehicle.repository';
import { VehicleDocumentRepository }  from '../repositories/vehicle-document.repository';
import { MaintenanceRepository }      from '../repositories/maintenance.repository';
import { VehicleAssignmentRepository } from '../repositories/vehicle-assignment.repository';
import { NotFoundError, ValidationError } from '../shared/errors/app.error';

const vehicleRepository    = new VehicleRepository();
const documentRepository   = new VehicleDocumentRepository();
const maintenanceRepository = new MaintenanceRepository();
const assignmentRepository = new VehicleAssignmentRepository();

export const VehicleService = {
  async list(filters?: { estado?: string; search?: string }) {
    return vehicleRepository.findAll(filters);
  },

  async getById(id: string) {
    const vehicle = await vehicleRepository.findById(id);
    if (!vehicle) throw new NotFoundError('Vehículo no encontrado');
    return vehicle;
  },

  async create(data: {
    marca: string;
    modelo: string;
    patente: string;
    anio?: number | null;
    vin?: string | null;
    numero_motor?: string | null;
    tipo?: string | null;
    color?: string | null;
    capacidad_pasajeros?: number | null;
    estado?: string;
    kilometraje?: number;
    notas?: string | null;
  }) {
    if (!data.patente.trim()) throw new ValidationError('La patente no puede estar vacía');
    return vehicleRepository.create(data);
  },

  async update(id: string, data: {
    marca?: string;
    modelo?: string;
    patente?: string;
    anio?: number | null;
    vin?: string | null;
    numero_motor?: string | null;
    tipo?: string | null;
    color?: string | null;
    capacidad_pasajeros?: number | null;
    estado?: string;
    kilometraje?: number;
    notas?: string | null;
  }) {
    const vehicle = await vehicleRepository.findById(id);
    if (!vehicle) throw new NotFoundError('Vehículo no encontrado');
    return vehicleRepository.update(id, data);
  },

  async delete(id: string): Promise<void> {
    const vehicle = await vehicleRepository.findById(id);
    if (!vehicle) throw new NotFoundError('Vehículo no encontrado');
    await vehicleRepository.delete(id);
  },

  async getDashboardStats() {
    const [countsByEstado, expiringDocuments, pendingMaintenances] = await Promise.all([
      vehicleRepository.countByEstado(),
      documentRepository.findExpiringWithin(30),
      maintenanceRepository.findPendingServices(),
    ]);

    return { countsByEstado, expiringDocuments, pendingMaintenances };
  },

  async assign(vehicleId: string, driverId: string, notes?: string) {
    const vehicle = await vehicleRepository.findById(vehicleId);
    if (!vehicle) throw new NotFoundError('Vehículo no encontrado');

    const currentAssignment = await assignmentRepository.findCurrentByVehicle(vehicleId);
    if (currentAssignment) {
      await assignmentRepository.unassign(vehicleId);
    }

    return assignmentRepository.assign(vehicleId, driverId, notes);
  },

  async unassign(vehicleId: string) {
    const vehicle = await vehicleRepository.findById(vehicleId);
    if (!vehicle) throw new NotFoundError('Vehículo no encontrado');

    const assignment = await assignmentRepository.unassign(vehicleId);
    if (!assignment) throw new NotFoundError('No hay asignación activa para este vehículo');
    return assignment;
  },
};
