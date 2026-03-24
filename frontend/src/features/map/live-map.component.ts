import {
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  OnDestroy,
  effect,
  inject,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { SocketService } from '../../core/socket/socket.service';
import { PositionService } from '../../core/api/position.service';
import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';

@Component({
  selector: 'app-live-map',
  standalone: true,
  imports: [CommonModule, ButtonModule, ToolbarModule],
  templateUrl: './live-map.component.html',
  styleUrl: './live-map.component.scss',
})
export class LiveMapComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  private map: unknown = null;
  private markers = new Map<string, unknown>();

  protected socketService  = inject(SocketService);
  private authService      = inject(AuthService);
  private tenantService    = inject(TenantService);
  private positionService  = inject(PositionService);
  private location         = inject(Location);

  protected get positions() {
    return this.socketService.positions();
  }

  protected get connectionStatus() {
    return this.socketService.connectionStatus();
  }

  protected positionEntries(): [string, unknown][] {
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
    const slug = this.tenantService.agencySlug();
    if (token && slug) {
      this.socketService.connect(token, slug);
    }
    await this.loadInitialPositions();
  }

  private async loadInitialPositions(): Promise<void> {
    try {
      const positions = await firstValueFrom(this.positionService.getLatestPerActiveTrip());
      positions.forEach(p => this.updateMarker(p.tripId, p));
    } catch {
      // silently ignore — socket updates will arrive anyway
    }
  }

  goBack(): void {
    this.location.back();
  }

  ngOnDestroy(): void {
    this.socketService.disconnect();
  }

  private async initMap(): Promise<void> {
    const L = await import('leaflet');


    this.map = L.map(this.mapContainer.nativeElement).setView([-54.8, -68.3], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map as ReturnType<typeof L.map>);

    // Forzar recalculo de tamaño una vez que el layout flex está resuelto
    setTimeout(() => {
      (this.map as ReturnType<typeof L.map>).invalidateSize();
    }, 100);
  }

  private updateMarker(
    tripId: string,
    payload: { lat: number; lng: number; isDeviation: boolean },
  ): void {
    if (!this.map) return;

    const existing = this.markers.get(tripId);

    import('leaflet').then(L => {
      const icon = L.divIcon({
        className: payload.isDeviation ? 'marker-deviation' : 'marker-normal',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${payload.isDeviation ? '#e53e3e' : '#38a169'};border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,.4)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      if (existing) {
        (existing as ReturnType<typeof L.marker>).setLatLng([payload.lat, payload.lng]).setIcon(icon);
      } else {
        const marker = L.marker([payload.lat, payload.lng], { icon }).addTo(
          this.map as ReturnType<typeof L.map>,
        );
        this.markers.set(tripId, marker);
      }
    });
  }
}
