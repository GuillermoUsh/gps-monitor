import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  VehicleDto,
  VehicleDocumentDto,
  MaintenanceDto,
  DriverProfileDto,
  FleetDashboardDto,
} from './api.types';

@Injectable({ providedIn: 'root' })
export class FleetService {
  private readonly http = inject(HttpClient);

  private get base(): string {
    return environment.apiUrl;
  }

  // Vehicles
  getVehicles(filters?: { estado?: string; search?: string }): Observable<VehicleDto[]> {
    const params: Record<string, string> = {};
    if (filters?.estado) params['estado'] = filters.estado;
    if (filters?.search) params['search'] = filters.search;
    return this.http
      .get<{ data: VehicleDto[] }>(`${this.base}/fleet/vehicles`, { params })
      .pipe(map(res => res.data));
  }

  createVehicle(data: Partial<VehicleDto>): Observable<VehicleDto> {
    return this.http
      .post<{ data: VehicleDto }>(`${this.base}/fleet/vehicles`, data)
      .pipe(map(res => res.data));
  }

  updateVehicle(id: string, data: Partial<VehicleDto>): Observable<VehicleDto> {
    return this.http
      .patch<{ data: VehicleDto }>(`${this.base}/fleet/vehicles/${id}`, data)
      .pipe(map(res => res.data));
  }

  deleteVehicle(id: string): Observable<void> {
    return this.http
      .delete<{ data: null }>(`${this.base}/fleet/vehicles/${id}`)
      .pipe(map(() => undefined));
  }

  getDashboard(): Observable<FleetDashboardDto> {
    return this.http
      .get<{ data: FleetDashboardDto }>(`${this.base}/fleet/vehicles/dashboard`)
      .pipe(map(res => res.data));
  }

  assignDriver(vehicleId: string, driverId: string): Observable<void> {
    return this.http
      .post<{ data: unknown }>(`${this.base}/fleet/vehicles/${vehicleId}/assign`, { driverId })
      .pipe(map(() => undefined));
  }

  unassignDriver(vehicleId: string): Observable<void> {
    return this.http
      .post<{ data: null }>(`${this.base}/fleet/vehicles/${vehicleId}/unassign`, {})
      .pipe(map(() => undefined));
  }

  // Documents
  getDocuments(vehicleId: string): Observable<VehicleDocumentDto[]> {
    return this.http
      .get<{ data: VehicleDocumentDto[] }>(`${this.base}/fleet/vehicles/${vehicleId}/documents`)
      .pipe(map(res => res.data));
  }

  createDocument(vehicleId: string, data: Partial<VehicleDocumentDto>): Observable<VehicleDocumentDto> {
    return this.http
      .post<{ data: VehicleDocumentDto }>(`${this.base}/fleet/vehicles/${vehicleId}/documents`, data)
      .pipe(map(res => res.data));
  }

  updateDocument(id: string, data: Partial<VehicleDocumentDto>): Observable<VehicleDocumentDto> {
    return this.http
      .patch<{ data: VehicleDocumentDto }>(`${this.base}/fleet/documents/${id}`, data)
      .pipe(map(res => res.data));
  }

  deleteDocument(id: string): Observable<void> {
    return this.http
      .delete<{ data: null }>(`${this.base}/fleet/documents/${id}`)
      .pipe(map(() => undefined));
  }

  // Maintenances
  getMaintenances(vehicleId: string): Observable<MaintenanceDto[]> {
    return this.http
      .get<{ data: MaintenanceDto[] }>(`${this.base}/fleet/vehicles/${vehicleId}/maintenances`)
      .pipe(map(res => res.data));
  }

  createMaintenance(vehicleId: string, data: Partial<MaintenanceDto>): Observable<MaintenanceDto> {
    return this.http
      .post<{ data: MaintenanceDto }>(`${this.base}/fleet/vehicles/${vehicleId}/maintenances`, data)
      .pipe(map(res => res.data));
  }

  // Drivers
  getDriverProfiles(): Observable<DriverProfileDto[]> {
    return this.http
      .get<{ data: DriverProfileDto[] }>(`${this.base}/fleet/drivers`)
      .pipe(map(res => res.data));
  }

  upsertDriverProfile(userId: string, data: Partial<DriverProfileDto>): Observable<DriverProfileDto> {
    return this.http
      .put<{ data: DriverProfileDto }>(`${this.base}/fleet/drivers/${userId}`, data)
      .pipe(map(res => res.data));
  }
}
