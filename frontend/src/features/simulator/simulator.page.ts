import {
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  OnDestroy,
  signal,
  inject,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToolbarModule } from 'primeng/toolbar';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';

import { TripService } from '../../core/api/trip.service';
import { PositionService } from '../../core/api/position.service';
import { RouteService } from '../../core/api/route.service';
import { TripDto, RouteDto } from '../../core/api/api.types';

@Component({
  selector: 'app-simulator-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    InputNumberModule,
    ToolbarModule,
    ToastModule,
    TagModule,
  ],
  providers: [MessageService],
  templateUrl: './simulator.page.html',
  styleUrl: './simulator.page.scss',
})
export class SimulatorPage implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly tripService = inject(TripService);
  private readonly positionService = inject(PositionService);
  private readonly routeService = inject(RouteService);
  private readonly messageService = inject(MessageService);
  private readonly location = inject(Location);

  private map: any = null;
  private currentMarker: any = null;
  private routePolyline: any = null;

  tripId = signal('');
  trip = signal<TripDto | null>(null);
  route = signal<RouteDto | null>(null);
  loading = signal(false);
  sending = signal(false);

  lat = signal<number>(-54.8);
  lng = signal<number>(-68.3);
  speed = signal<number>(40);

  async ngOnInit(): Promise<void> {
    const id = this.activatedRoute.snapshot.paramMap.get('tripId') ?? '';
    this.tripId.set(id);
    await this.initMap();
    await this.loadTrip(id);
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  goBack(): void {
    this.location.back();
  }

  private async loadTrip(id: string): Promise<void> {
    if (!id) return;
    this.loading.set(true);
    try {
      const trips = await firstValueFrom(this.tripService.getTrips());
      const found = trips.find(t => t.id === id) ?? null;
      this.trip.set(found);

      if (found?.routeId) {
        const routeDetail = await firstValueFrom(this.routeService.getRoute(found.routeId));
        this.route.set(routeDetail);
        await this.drawRoute(routeDetail);
      }
    } catch {
      this.messageService.add({
        severity: 'warn',
        summary: 'Aviso',
        detail: 'No se pudo cargar la info del viaje',
      });
    } finally {
      this.loading.set(false);
    }
  }

  private async drawRoute(route: RouteDto): Promise<void> {
    if (!this.map || !route.waypoints?.length) return;

    const L = await import('leaflet');

    const sorted = [...route.waypoints].sort((a, b) => a.order - b.order);
    const latlngs = sorted.map(wp => [wp.lat, wp.lng] as [number, number]);

    // Draw polyline
    if (this.routePolyline) this.routePolyline.remove();
    this.routePolyline = L.polyline(latlngs, {
      color: '#3b82f6',
      weight: 4,
      opacity: 0.8,
    }).addTo(this.map);

    // Draw numbered waypoint markers
    sorted.forEach((wp, i) => {
      const isFirst = i === 0;
      const isLast = i === sorted.length - 1;
      const color = isFirst ? '#22c55e' : isLast ? '#ef4444' : '#3b82f6';
      const label = isFirst ? 'A' : isLast ? 'B' : String(i + 1);

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          background:${color};color:#fff;border-radius:50%;
          width:24px;height:24px;display:flex;align-items:center;
          justify-content:center;font-size:11px;font-weight:bold;
          border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,.3)
        ">${label}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      L.marker([wp.lat, wp.lng], { icon })
        .bindTooltip(`Waypoint ${i + 1}`)
        .addTo(this.map);
    });

    // Fit map to route bounds
    this.map.fitBounds(this.routePolyline.getBounds(), { padding: [40, 40] });

    // Set default position to first waypoint
    this.lat.set(parseFloat(sorted[0].lat.toFixed(7)));
    this.lng.set(parseFloat(sorted[0].lng.toFixed(7)));
  }

  private async initMap(): Promise<void> {
    const L = await import('leaflet');

    this.map = L.map(this.mapContainer.nativeElement).setView([-54.8, -68.3], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    this.map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
      this.lat.set(parseFloat(e.latlng.lat.toFixed(7)));
      this.lng.set(parseFloat(e.latlng.lng.toFixed(7)));
      this.placeCurrentMarker(L, e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => this.map.invalidateSize(), 100);
  }

  async sendPosition(): Promise<void> {
    const tripId = this.tripId();
    if (!tripId) return;

    this.sending.set(true);
    try {
      await firstValueFrom(
        this.positionService.sendPosition(tripId, {
          lat: this.lat(),
          lng: this.lng(),
          speed: this.speed(),
          timestamp: new Date().toISOString(),
        }),
      );

      import('leaflet').then(L => this.placeCurrentMarker(L, this.lat(), this.lng()));

      this.messageService.add({
        severity: 'success',
        summary: 'Posición enviada',
        detail: `Lat: ${this.lat().toFixed(5)}, Lng: ${this.lng().toFixed(5)}`,
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo enviar la posición',
      });
    } finally {
      this.sending.set(false);
    }
  }

  private placeCurrentMarker(L: any, lat: number, lng: number): void {
    if (!this.map) return;

    const icon = L.divIcon({
      className: '',
      html: `<div style="width:18px;height:18px;border-radius:50%;background:#f97316;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    if (this.currentMarker) {
      this.currentMarker.setLatLng([lat, lng]);
    } else {
      this.currentMarker = L.marker([lat, lng], { icon }).addTo(this.map);
    }

    this.map.panTo([lat, lng]);
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'info';
      case 'cancelled': return 'danger';
      default: return 'secondary';
    }
  }
}
