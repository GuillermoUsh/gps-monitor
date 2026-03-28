import {
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  OnDestroy,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../core/auth/auth.service';
import { SocketService } from '../../core/socket/socket.service';
import { PositionService } from '../../core/api/position.service';
import { PositionUpdatePayload } from '../../core/socket/socket.service';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-live-map',
  standalone: true,
  imports: [CommonModule, ButtonModule, ToastModule],
  providers: [MessageService],
  templateUrl: './live-map.component.html',
  styleUrl: './live-map.component.scss',
})
export class LiveMapComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private map: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private L: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private markers = new Map<string, any>();

  panelOpen = signal(false);

  togglePanel(): void {
    this.panelOpen.update(v => !v);
  }

  // Feature 1: Trail toggle
  showTrail = signal(true);
  private trails = new Map<string, [number, number][]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private trailPolylines = new Map<string, any>();

  // Feature 3: Deviation alert with auto-zoom
  private deviatingTrips = new Set<string>();
  private deviationZoomTimer: ReturnType<typeof setTimeout> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private preBounds: any = null;

  protected socketService  = inject(SocketService);
  private authService      = inject(AuthService);
  private positionService  = inject(PositionService);
  private location         = inject(Location);
  private messageService   = inject(MessageService);

  protected get positions() {
    return this.socketService.positions();
  }

  protected get connectionStatus() {
    return this.socketService.connectionStatus();
  }

  protected positionEntries(): [string, PositionUpdatePayload][] {
    return Array.from(this.socketService.positions().entries());
  }

  constructor() {
    effect(() => {
      const positions = this.socketService.positions();
      positions.forEach((payload, tripId) => {
        this.updateMarker(tripId, payload);
      });
    });
  }

  async ngOnInit(): Promise<void> {
    await this.initMap();
    const token = this.authService.accessToken() ?? '';
    if (token) {
      this.socketService.connect(token);
    }
    await this.loadInitialPositions();
  }

  private async loadInitialPositions(): Promise<void> {
    try {
      const positions = await firstValueFrom(this.positionService.getLatestPerActiveTrip());
      positions.forEach(p => this.updateMarker(p.tripId, p as PositionUpdatePayload));
    } catch {
      // silently ignore — socket updates will arrive anyway
    }
  }

  goBack(): void {
    this.location.back();
  }

  toggleTrail(): void {
    this.showTrail.update(v => !v);

    if (this.showTrail()) {
      // Show all existing trail polylines
      this.trailPolylines.forEach(polyline => {
        polyline.addTo(this.map);
      });
    } else {
      // Hide all existing trail polylines
      this.trailPolylines.forEach(polyline => {
        polyline.remove();
      });
    }
  }

  ngOnDestroy(): void {
    if (this.deviationZoomTimer !== null) {
      clearTimeout(this.deviationZoomTimer);
    }
    this.socketService.disconnect();
  }

  private async initMap(): Promise<void> {
    const leafletModule = await import('leaflet');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.L = (leafletModule as any).default ?? leafletModule;

    this.map = this.L.map(this.mapContainer.nativeElement).setView([-54.8, -68.3], 13);

    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    // Forzar recalculo de tamaño una vez que el layout flex está resuelto
    setTimeout(() => {
      this.map.invalidateSize();
    }, 100);
  }

  private updateMarker(
    tripId: string,
    payload: { lat: number; lng: number; isDeviation: boolean; deviationMeters?: number | null },
  ): void {
    if (!this.map || !this.L) return;

    const L = this.L;

    // Build icon
    const icon = L.divIcon({
      className: payload.isDeviation ? 'marker-deviation' : 'marker-normal',
      html: `<div style="width:14px;height:14px;border-radius:50%;background:${payload.isDeviation ? '#e53e3e' : '#38a169'};border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,.4)"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    // Update or create marker
    const existing = this.markers.get(tripId);
    if (existing) {
      existing.setLatLng([payload.lat, payload.lng]).setIcon(icon);
    } else {
      const marker = L.marker([payload.lat, payload.lng], { icon }).addTo(this.map);
      this.markers.set(tripId, marker);
    }

    // Feature 1: Update trail
    if (!this.trails.has(tripId)) {
      this.trails.set(tripId, []);
    }
    const trailPoints = this.trails.get(tripId)!;
    trailPoints.push([payload.lat, payload.lng]);

    if (this.showTrail()) {
      const existingPolyline = this.trailPolylines.get(tripId);
      if (existingPolyline) {
        existingPolyline.remove();
      }
      const polyline = L.polyline(trailPoints, {
        color: 'green',
        weight: 2,
        opacity: 0.7,
      }).addTo(this.map);
      this.trailPolylines.set(tripId, polyline);
    }

    // Feature 3: Deviation alert with auto-zoom
    if (payload.isDeviation === true && !this.deviatingTrips.has(tripId)) {
      this.deviatingTrips.add(tripId);

      const meters = payload.deviationMeters?.toFixed(0) ?? '?';
      this.messageService.add({
        severity: 'warn',
        summary: '⚠ Desvío detectado',
        detail: `Viaje ${tripId.slice(0, 8)} — ${meters}m fuera de ruta`,
      });

      this.preBounds = this.map.getBounds();

      if (this.deviationZoomTimer !== null) {
        clearTimeout(this.deviationZoomTimer);
        this.deviationZoomTimer = null;
      }

      this.map.setView([payload.lat, payload.lng], 16, { animate: true });

      this.deviationZoomTimer = setTimeout(() => {
        if (this.preBounds) {
          this.map.fitBounds(this.preBounds, { animate: true });
          this.preBounds = null;
        }
        this.deviationZoomTimer = null;
      }, 10000);
    }

    if (payload.isDeviation === false && this.deviatingTrips.has(tripId)) {
      this.deviatingTrips.delete(tripId);
    }
  }
}
