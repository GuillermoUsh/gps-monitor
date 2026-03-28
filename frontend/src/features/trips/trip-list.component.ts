import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageService, ConfirmationService } from 'primeng/api';

import { TripService } from '../../core/api/trip.service';
import { RouteService } from '../../core/api/route.service';
import { UserService, UserDto } from '../../core/api/user.service';
import { FleetService } from '../../core/api/fleet.service';
import { VehicleDto } from '../../core/api/api.types';
import {
  TripDto,
  RouteDto,
  TripTipo,
  DisponibilidadDto,
  ScheduleTripInput,
  UpdateScheduleTripInput,
} from '../../core/api/api.types';

@Component({
  selector: 'app-trip-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TableModule,
    ToastModule,
    ConfirmDialogModule,
    DialogModule,
    SelectModule,
    TagModule,
    DatePickerModule,
    InputNumberModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './trip-list.component.html',
  styleUrl: './trip-list.component.scss',
})
export class TripListComponent implements OnInit {
  private readonly tripService = inject(TripService);
  private readonly routeService = inject(RouteService);
  private readonly userService = inject(UserService);
  private readonly fleetService = inject(FleetService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  goBack(): void { this.location.back(); }

  trips = signal<TripDto[]>([]);
  routes = signal<RouteDto[]>([]);
  drivers = signal<UserDto[]>([]);
  vehicles = signal<VehicleDto[]>([]);
  loading = signal(false);
  showNewTripDialog = signal(false);
  starting = signal(false);

  // Shared dialog fields
  selectedRouteId: string | null = null;
  selectedDriverId: string | null = null;
  selectedVehicleId: string | null = null;
  cantidadPasajeros: number | null = null;

  // Edit mode
  editingTripId: string | null = null;
  editingTrip: TripDto | null = null;

  // Modo: gps | programado
  modoViaje: 'gps' | 'programado' = 'gps';

  readonly modoOptions = [
    { label: 'GPS en tiempo real', value: 'gps' },
    { label: 'Viaje programado', value: 'programado' },
  ];

  // Scheduled-trip specific fields
  selectedTipoViaje: TripTipo = 'ida_vuelta';

  readonly tipoViajeOptions = [
    { label: 'Ida y vuelta (libre entre viajes)', value: 'ida_vuelta' },
    { label: 'Con espera (chofer espera en destino)', value: 'espera' },
  ];

  scheduledDeparture: Date | null = null;
  scheduledReturn: Date | null = null;
  duracionActividad: number | null = null;

  private readonly _disponibilidadPreview = signal<DisponibilidadDto | null>(null);
  readonly disponibilidadPreview = this._disponibilidadPreview.asReadonly();

  ngOnInit(): void {
    this.loadTrips();
  }

  async loadTrips(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(this.tripService.getTrips());
      this.trips.set(data);
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudieron cargar los viajes',
      });
    } finally {
      this.loading.set(false);
    }
  }

  async openEditDialog(trip: TripDto): Promise<void> {
    this.editingTripId = trip.id;
    this.editingTrip = trip;
    this.selectedTipoViaje = trip.tipoViaje ?? 'ida_vuelta';
    this.scheduledDeparture = trip.scheduledDeparture ? new Date(trip.scheduledDeparture as any) : null;
    this.scheduledReturn = trip.scheduledReturn ? new Date(trip.scheduledReturn as any) : null;
    this.duracionActividad = trip.duracionActividadMinutos ?? null;
    this.cantidadPasajeros = trip.cantidadPasajeros ?? null;
    this._disponibilidadPreview.set(null);

    await this.loadDialogData();
    this.selectedRouteId = trip.routeId;
    this.recalcularDisponibilidad();
    this.showNewTripDialog.set(true);
  }

  async openNewTripDialog(): Promise<void> {
    this.editingTripId = null;
    this.editingTrip = null;
    this.selectedRouteId = null;
    this.selectedDriverId = null;
    this.selectedVehicleId = null;
    this.cantidadPasajeros = null;
    this.modoViaje = 'gps';
    this.selectedTipoViaje = 'ida_vuelta';
    this.scheduledDeparture = null;
    this.scheduledReturn = null;
    this.duracionActividad = null;
    this._disponibilidadPreview.set(null);
    this.showNewTripDialog.set(true);
    await this.loadDialogData();
  }

  private async loadDialogData(): Promise<void> {
    const [routes, users, vehicles] = await Promise.allSettled([
      this.routes().length === 0
        ? firstValueFrom(this.routeService.getRoutes())
        : Promise.resolve(this.routes()),
      this.drivers().length === 0
        ? firstValueFrom(this.userService.getUsers())
        : Promise.resolve(this.drivers()),
      this.vehicles().length === 0
        ? firstValueFrom(this.fleetService.getVehicles({ estado: 'disponible' }))
        : Promise.resolve(this.vehicles()),
    ]);
    if (routes.status === 'fulfilled') this.routes.set(routes.value);
    if (users.status === 'fulfilled') this.drivers.set(users.value.filter(u => u.role === 'driver'));
    if (vehicles.status === 'fulfilled') this.vehicles.set(vehicles.value);
  }

  onRouteChange(): void {
    this._disponibilidadPreview.set(null);
    this.recalcularDisponibilidad();
  }

  onTipoViajeChange(): void {
    this.scheduledReturn = null;
    this.duracionActividad = null;
    this._disponibilidadPreview.set(null);
    this.recalcularDisponibilidad();
  }

  recalcularDisponibilidad(): void {
    this._disponibilidadPreview.set(this.calcDisponibilidad());
  }

  private calcDisponibilidad(): DisponibilidadDto | null {
    if (this.modoViaje !== 'programado' || !this.scheduledDeparture) return null;

    const duracion = this.selectedRouteDuracion();
    if (!duracion) return null;

    const departure = this.scheduledDeparture;

    if (this.selectedTipoViaje === 'ida_vuelta') {
      if (!this.scheduledReturn) return null;
      const libreDesde = new Date(departure.getTime() + duracion * 60_000);
      const libreHasta = new Date(this.scheduledReturn.getTime() - duracion * 60_000);
      if (libreDesde >= libreHasta) return null;
      return {
        tipo: 'libre',
        desde: libreDesde.toISOString(),
        hasta: libreHasta.toISOString(),
      };
    }

    if (this.selectedTipoViaje === 'espera') {
      const durActividad = this.duracionActividad ?? 0;
      const regresaAprox = new Date(
        departure.getTime() + (2 * duracion + durActividad) * 60_000,
      );
      return {
        tipo: 'ocupado_espera',
        regresaAprox: regresaAprox.toISOString(),
      };
    }

    return null;
  }

  selectedRouteDuracion(): number | null {
    const route = this.routes().find(r => r.id === this.selectedRouteId);
    return route?.duracionMinutos ?? null;
  }

  async startTrip(): Promise<void> {
    if (!this.selectedRouteId || !this.selectedDriverId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Requerido',
        detail: 'Seleccioná una ruta y un chofer para iniciar el viaje',
      });
      return;
    }

    this.starting.set(true);
    try {
      const trip = await firstValueFrom(
        this.tripService.startTrip(
          this.selectedRouteId,
          this.selectedDriverId ?? undefined,
          this.selectedVehicleId ?? undefined,
          this.cantidadPasajeros ?? undefined,
        ),
      );
      this.trips.update(list => [trip, ...list]);
      this.showNewTripDialog.set(false);
      this.messageService.add({
        severity: 'success',
        summary: 'Viaje iniciado',
        detail: 'El viaje fue creado exitosamente',
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo iniciar el viaje',
      });
    } finally {
      this.starting.set(false);
    }
  }

  async updateTrip(): Promise<void> {
    if (!this.editingTripId || !this.scheduledDeparture) {
      this.messageService.add({ severity: 'warn', summary: 'Requerido', detail: 'Completá la fecha de salida' });
      return;
    }
    if (this.selectedTipoViaje === 'ida_vuelta' && !this.scheduledReturn) {
      this.messageService.add({ severity: 'warn', summary: 'Requerido', detail: 'Indicá la hora de regreso a buscar pasajeros' });
      return;
    }

    const input: UpdateScheduleTripInput = {
      tipoViaje: this.selectedTipoViaje,
      scheduledDeparture: this.scheduledDeparture.toISOString(),
      scheduledReturn:
        this.selectedTipoViaje === 'ida_vuelta' && this.scheduledReturn
          ? this.scheduledReturn.toISOString()
          : null,
      duracionActividadMinutos:
        this.selectedTipoViaje === 'espera' ? this.duracionActividad : null,
      cantidadPasajeros: this.cantidadPasajeros,
    };

    this.starting.set(true);
    try {
      const trip = await firstValueFrom(this.tripService.rescheduleTrip(this.editingTripId, input));
      this.trips.update(list => list.map(t => (t.id === trip.id ? trip : t)));
      this.showNewTripDialog.set(false);
      this.messageService.add({ severity: 'success', summary: 'Actualizado', detail: 'El viaje fue reprogramado' });
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: err?.error?.error ?? 'No se pudo actualizar el viaje',
      });
    } finally {
      this.starting.set(false);
    }
  }

  async scheduleTrip(): Promise<void> {
    if (!this.selectedRouteId || !this.selectedDriverId || !this.scheduledDeparture) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Requerido',
        detail: 'Completá ruta, chofer y fecha de salida',
      });
      return;
    }

    if (this.selectedTipoViaje === 'ida_vuelta' && !this.scheduledReturn) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Requerido',
        detail: 'Indicá la hora programada para ir a buscar a los pasajeros',
      });
      return;
    }

    const input: ScheduleTripInput = {
      routeId: this.selectedRouteId,
      driverId: this.selectedDriverId,
      vehicleId: this.selectedVehicleId,
      tipoViaje: this.selectedTipoViaje,
      scheduledDeparture: this.scheduledDeparture.toISOString(),
      scheduledReturn:
        this.selectedTipoViaje === 'ida_vuelta' && this.scheduledReturn
          ? this.scheduledReturn.toISOString()
          : null,
      duracionActividadMinutos:
        this.selectedTipoViaje === 'espera' ? this.duracionActividad : null,
      cantidadPasajeros: this.cantidadPasajeros,
    };

    this.starting.set(true);
    try {
      const trip = await firstValueFrom(this.tripService.scheduleTrip(input));
      this.trips.update(list => [trip, ...list]);
      this.showNewTripDialog.set(false);
      this.messageService.add({
        severity: 'success',
        summary: 'Viaje programado',
        detail: 'El viaje fue programado exitosamente',
      });
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: err?.error?.error ?? 'No se pudo programar el viaje',
      });
    } finally {
      this.starting.set(false);
    }
  }

  async completeTrip(trip: TripDto): Promise<void> {
    try {
      const updated = await firstValueFrom(this.tripService.completeTrip(trip.id));
      this.trips.update(list => list.map(t => (t.id === trip.id ? updated : t)));
      this.messageService.add({
        severity: 'info',
        summary: 'Completado',
        detail: 'El viaje fue completado',
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo completar el viaje',
      });
    }
  }

  async cancelTrip(trip: TripDto): Promise<void> {
    try {
      const updated = await firstValueFrom(this.tripService.cancelTrip(trip.id));
      this.trips.update(list => list.map(t => (t.id === trip.id ? updated : t)));
      this.messageService.add({
        severity: 'warn',
        summary: 'Cancelado',
        detail: 'El viaje fue cancelado',
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo cancelar el viaje',
      });
    }
  }

  goToSimulator(tripId: string): void {
    this.router.navigate(['/simulator', tripId]);
  }

  goToHistory(tripId: string): void {
    this.router.navigate(['/trips', tripId, 'history']);
  }

  labelTipo(tipo: TripTipo): string {
    switch (tipo) {
      case 'ida_vuelta': return 'Ida y vuelta';
      case 'espera':     return 'Con espera';
      default:           return tipo;
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'active':    return 'Activo';
      case 'scheduled': return 'Programado';
      case 'completed': return 'Completado';
      case 'cancelled': return 'Cancelado';
      default:          return status;
    }
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'active':    return 'success';
      case 'scheduled': return 'warn';
      case 'completed': return 'info';
      case 'cancelled': return 'danger';
      default:          return 'secondary';
    }
  }

  onPasajerosChange(): void {
    // Reset vehicle selection if current vehicle no longer meets capacity
    if (this.selectedVehicleId && this.cantidadPasajeros) {
      const v = this.vehicles().find(v => v.id === this.selectedVehicleId);
      if (v?.capacidad_pasajeros !== null && v?.capacidad_pasajeros !== undefined &&
          v.capacidad_pasajeros < this.cantidadPasajeros) {
        this.selectedVehicleId = null;
      }
    }
  }

  get routeOptions() {
    return this.routes().map(r => ({ label: r.name, value: r.id }));
  }

  get driverOptions() {
    return this.drivers().map(d => ({ label: d.email, value: d.id }));
  }

  get vehicleOptions() {
    const cap = this.cantidadPasajeros;
    return this.vehicles()
      .filter(v => !cap || v.capacidad_pasajeros === null || v.capacidad_pasajeros >= cap)
      .map(v => ({
        label: `${v.alias ?? v.patente} — ${v.marca} ${v.modelo}` +
               (v.capacidad_pasajeros ? ` (${v.capacidad_pasajeros} pas.)` : ''),
        value: v.id,
      }));
  }
}
