import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToolbarModule } from 'primeng/toolbar';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { MessageService, ConfirmationService } from 'primeng/api';

import { TripService } from '../../core/api/trip.service';
import { RouteService } from '../../core/api/route.service';
import { UserService, UserDto } from '../../core/api/user.service';
import { TripDto, RouteDto } from '../../core/api/api.types';

@Component({
  selector: 'app-trip-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TableModule,
    ToolbarModule,
    ToastModule,
    ConfirmDialogModule,
    DialogModule,
    SelectModule,
    TagModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './trip-list.component.html',
  styleUrl: './trip-list.component.scss',
})
export class TripListComponent implements OnInit {
  private readonly tripService = inject(TripService);
  private readonly routeService = inject(RouteService);
  private readonly userService = inject(UserService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  trips = signal<TripDto[]>([]);
  routes = signal<RouteDto[]>([]);
  drivers = signal<UserDto[]>([]);
  loading = signal(false);
  showNewTripDialog = signal(false);
  starting = signal(false);

  selectedRouteId: string | null = null;
  selectedDriverId: string | null = null;

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

  async openNewTripDialog(): Promise<void> {
    this.selectedRouteId = null;
    this.selectedDriverId = null;
    this.showNewTripDialog.set(true);
    const [routes, users] = await Promise.allSettled([
      this.routes().length === 0 ? firstValueFrom(this.routeService.getRoutes()) : Promise.resolve(this.routes()),
      this.drivers().length === 0 ? firstValueFrom(this.userService.getUsers()) : Promise.resolve(this.drivers()),
    ]);
    if (routes.status === 'fulfilled') this.routes.set(routes.value);
    if (users.status === 'fulfilled') this.drivers.set(users.value.filter(u => u.role === 'driver'));
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
      const trip = await firstValueFrom(this.tripService.startTrip(this.selectedRouteId, this.selectedDriverId ?? undefined));
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

  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'info';
      case 'cancelled': return 'danger';
      default: return 'secondary';
    }
  }

  get routeOptions() {
    return this.routes().map(r => ({ label: r.name, value: r.id }));
  }

  get driverOptions() {
    return this.drivers().map(d => ({ label: d.email, value: d.id }));
  }
}
