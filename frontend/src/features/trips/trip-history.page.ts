import {
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  signal,
  inject,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';

import { TripService } from '../../core/api/trip.service';
import { RouteService } from '../../core/api/route.service';
import { TripDto, PositionHistoryDto, TripStatsDto, RouteDto } from '../../core/api/api.types';

@Component({
  selector: 'app-trip-history',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    ToolbarModule,
    ToastModule,
    CardModule,
    TagModule,
  ],
  providers: [MessageService],
  templateUrl: './trip-history.page.html',
  styleUrl: './trip-history.page.scss',
})
export class TripHistoryPage implements OnInit {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  private readonly route        = inject(ActivatedRoute);
  private readonly tripService  = inject(TripService);
  private readonly routeService = inject(RouteService);
  private readonly location     = inject(Location);
  private readonly messageService = inject(MessageService);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private map: any = null;

  loading   = signal(false);
  positions = signal<PositionHistoryDto[]>([]);
  stats     = signal<TripStatsDto | null>(null);
  trip      = signal<TripDto | null>(null);
  routeData = signal<RouteDto | null>(null);

  async ngOnInit(): Promise<void> {
    const tripId = this.route.snapshot.paramMap.get('tripId');
    if (!tripId) return;

    this.loading.set(true);
    try {
      const [positionData, trips] = await Promise.all([
        firstValueFrom(this.tripService.getTripPositions(tripId)),
        firstValueFrom(this.tripService.getTrips()),
      ]);

      this.positions.set(positionData.positions);
      this.stats.set(positionData.stats);

      const tripFound = trips.find(t => t.id === tripId) ?? null;
      this.trip.set(tripFound);

      if (tripFound?.routeId) {
        try {
          const route = await firstValueFrom(this.routeService.getRoute(tripFound.routeId));
          this.routeData.set(route);
        } catch {
          // route load is best-effort
        }
      }
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo cargar el historial del viaje',
      });
    } finally {
      this.loading.set(false);
    }

    await this.initMap();
  }

  goBack(): void {
    this.location.back();
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'active':    return 'success';
      case 'completed': return 'info';
      case 'cancelled': return 'danger';
      default:          return 'secondary';
    }
  }

  private async initMap(): Promise<void> {
    const leafletModule = await import('leaflet');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (leafletModule as any).default ?? leafletModule;

    const allPositions = this.positions();
    const route        = this.routeData();

    // Default center: first actual position or a fallback
    const center: [number, number] = allPositions.length > 0
      ? [allPositions[0].lat, allPositions[0].lng]
      : [-54.8, -68.3];

    this.map = L.map(this.mapContainer.nativeElement).setView(center, 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    // Draw planned route (blue dashed polyline) from waypoints
    if (route?.waypoints && route.waypoints.length > 0) {
      const waypointLatLngs = route.waypoints
        .slice()
        .sort((a, b) => a.order - b.order)
        .map(w => [w.lat, w.lng] as [number, number]);

      L.polyline(waypointLatLngs, {
        color:     '#3b82f6',
        weight:    3,
        dashArray: '8 6',
        opacity:   0.8,
      }).addTo(this.map);
    }

    // Draw actual path (green solid polyline)
    if (allPositions.length > 1) {
      const actualLatLngs = allPositions.map(p => [p.lat, p.lng] as [number, number]);

      L.polyline(actualLatLngs, {
        color:   '#16a34a',
        weight:  3,
        opacity: 0.9,
      }).addTo(this.map);
    }

    // Draw red markers for deviation points
    const deviationIcon = L.divIcon({
      className: 'marker-deviation',
      html: `<div style="width:12px;height:12px;border-radius:50%;background:#dc2626;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,.4)"></div>`,
      iconSize:   [12, 12],
      iconAnchor: [6, 6],
    });

    for (const pos of allPositions) {
      if (pos.isDeviation) {
        L.marker([pos.lat, pos.lng], { icon: deviationIcon })
          .bindTooltip(`Desvío: ${pos.deviationMeters}m`)
          .addTo(this.map);
      }
    }

    // Fit map to show all positions
    if (allPositions.length > 0) {
      const bounds = L.latLngBounds(allPositions.map(p => [p.lat, p.lng]));
      this.map.fitBounds(bounds, { padding: [32, 32] });
    }

    setTimeout(() => this.map.invalidateSize(), 100);
  }
}
