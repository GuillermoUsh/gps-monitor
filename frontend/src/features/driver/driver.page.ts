import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { DatePipe, DecimalPipe, SlicePipe } from '@angular/common';
import { TripService } from '../../core/api/trip.service';
import { TripDto } from '../../core/api/api.types';
import { PositionService } from '../../core/api/position.service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-driver-page',
  standalone: true,
  imports: [
    ButtonModule,
    ToastModule,
    DatePipe,
    DecimalPipe,
    SlicePipe,
  ],
  templateUrl: './driver.page.html',
  styleUrl: './driver.page.scss',
  providers: [MessageService],
})
export class DriverPage implements OnInit, OnDestroy {
  private readonly tripService = inject(TripService);
  private readonly positionService = inject(PositionService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  trips = signal<TripDto[]>([]);
  loading = signal(false);
  tracking = signal(false);
  activeTripId = signal<string | null>(null);
  lastPosition = signal<{ lat: number; lng: number } | null>(null);
  accuracy = signal<number | null>(null);
  error = signal<string | null>(null);

  private watchId: number | null = null;

  ngOnInit(): void {
    this.loadTrips();
  }

  ngOnDestroy(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
    }
  }

  loadTrips(): void {
    this.loading.set(true);
    this.tripService.getMyTrips().subscribe({
      next: trips => {
        this.trips.set(trips);
        this.loading.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los viajes' });
        this.loading.set(false);
      },
    });
  }

  async startTracking(tripId: string): Promise<void> {
    this.error.set(null);

    if (!navigator.geolocation) {
      this.error.set('Este dispositivo no soporta GPS.');
      return;
    }

    // Check permission state before calling watchPosition
    if (navigator.permissions) {
      const perm = await navigator.permissions.query({ name: 'geolocation' });
      if (perm.state === 'denied') {
        this.error.set('GPS bloqueado. Habilitá la ubicación en Ajustes del celular → Apps → Chrome → Permisos → Ubicación.');
        return;
      }
    }

    this.activeTripId.set(tripId);
    this.tracking.set(true);

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { coords } = position;
        this.lastPosition.set({ lat: coords.latitude, lng: coords.longitude });
        this.accuracy.set(coords.accuracy);
        this.sendPosition(tripId, coords);
      },
      (err) => {
        this.error.set(`GPS no disponible: ${err.message}. Habilitá la ubicación en Ajustes del celular.`);
        this.tracking.set(false);
        this.activeTripId.set(null);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
  }

  stopTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.tracking.set(false);
    this.activeTripId.set(null);
  }

  sendPosition(tripId: string, coords: GeolocationCoordinates): void {
    this.positionService.sendPosition(tripId, {
      lat: coords.latitude,
      lng: coords.longitude,
      speed: coords.speed ?? undefined,
      timestamp: new Date().toISOString(),
    }).subscribe();
  }

  logout(): void {
    this.authService.logout();
  }
}
