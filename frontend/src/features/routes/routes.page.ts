import { Component, OnInit, signal, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ToolbarModule } from 'primeng/toolbar';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';

import { RouteService, CreateRouteInput } from '../../core/api/route.service';
import { RouteDto, WaypointInput } from '../../core/api/api.types';

@Component({
  selector: 'app-routes-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TableModule,
    CardModule,
    InputTextModule,
    ToolbarModule,
    ToastModule,
    ConfirmDialogModule,
    DialogModule,
    TagModule,
    TooltipModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './routes.page.html',
  styleUrl: './routes.page.scss',
})
export class RoutesPage implements OnInit {
  private readonly routeService = inject(RouteService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly location = inject(Location);

  @ViewChild('routeMapContainer') routeMapContainer!: ElementRef<HTMLDivElement>;

  routes = signal<RouteDto[]>([]);
  loading = signal(false);
  showCreateDialog = signal(false);
  saving = signal(false);

  // Form model
  formName = '';
  formOrigin = '';
  formDestination = '';
  formWaypoints: WaypointInput[] = [];

  // Leaflet internals
  private leafletMap: any = null;
  private markers: any[] = [];
  private polyline: any = null;

  ngOnInit(): void {
    this.loadRoutes();
  }

  goBack(): void {
    this.location.back();
  }

  async loadRoutes(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(this.routeService.getRoutes());
      this.routes.set(data);
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudieron cargar las rutas',
      });
    } finally {
      this.loading.set(false);
    }
  }

  openCreateDialog(): void {
    this.formName = '';
    this.formOrigin = '';
    this.formDestination = '';
    this.formWaypoints = [];
    this.showCreateDialog.set(true);
  }

  async onDialogShow(): Promise<void> {
    // Wait for dialog DOM to render
    await new Promise(r => setTimeout(r, 100));

    const L = (await import('leaflet')).default;

    const container = this.routeMapContainer?.nativeElement;
    if (!container) return;

    // Init map centered on Ushuaia
    this.leafletMap = L.map(container).setView([-54.8, -68.3], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.leafletMap);

    this.leafletMap.invalidateSize();

    this.leafletMap.on('click', (e: any) => {
      const order = this.formWaypoints.length + 1;
      this.formWaypoints = [
        ...this.formWaypoints,
        { lat: e.latlng.lat, lng: e.latlng.lng, order },
      ];
      this.addMarker(L, e.latlng.lat, e.latlng.lng, order);
      this.redrawPolyline(L);
    });
  }

  onDialogHide(): void {
    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
      this.markers = [];
      this.polyline = null;
    }
  }

  private addMarker(L: any, lat: number, lng: number, order: number): void {
    const icon = L.divIcon({
      className: '',
      html: `<div style="
        background:#3b82f6;color:#fff;border-radius:50%;
        width:26px;height:26px;display:flex;align-items:center;
        justify-content:center;font-size:12px;font-weight:bold;
        border:2px solid #1d4ed8;box-shadow:0 2px 4px rgba(0,0,0,.3)
      ">${order}</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });

    const marker = L.marker([lat, lng], { icon }).addTo(this.leafletMap);
    this.markers.push(marker);
  }

  private redrawPolyline(L: any): void {
    if (this.polyline) {
      this.polyline.remove();
      this.polyline = null;
    }
    if (this.formWaypoints.length >= 2) {
      const latlngs = this.formWaypoints.map(wp => [wp.lat, wp.lng]);
      this.polyline = L.polyline(latlngs as any, {
        color: '#3b82f6',
        weight: 3,
        dashArray: '6 4',
      }).addTo(this.leafletMap);
    }
  }

  removeWaypoint(index: number): void {
    // Remove marker from map
    if (this.markers[index]) {
      this.markers[index].remove();
      this.markers.splice(index, 1);
    }

    // Remove waypoint and re-number
    this.formWaypoints = this.formWaypoints
      .filter((_, i) => i !== index)
      .map((wp, i) => ({ ...wp, order: i + 1 }));

    // Re-number remaining markers
    this.markers.forEach((marker, i) => {
      const el = marker.getElement()?.querySelector('div');
      if (el) el.textContent = String(i + 1);
    });

    // Redraw polyline
    if (this.leafletMap) {
      import('leaflet').then(mod => this.redrawPolyline(mod.default));
    }
  }

  async saveRoute(): Promise<void> {
    if (!this.formName.trim() || !this.formOrigin.trim() || !this.formDestination.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Campos requeridos',
        detail: 'Completá nombre, origen y destino',
      });
      return;
    }

    if (this.formWaypoints.length < 2) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Waypoints insuficientes',
        detail: 'Agregá al menos 2 puntos en el mapa',
      });
      return;
    }

    const input: CreateRouteInput = {
      name: this.formName.trim(),
      origin: this.formOrigin.trim(),
      destination: this.formDestination.trim(),
      waypoints: this.formWaypoints,
    };

    this.saving.set(true);
    try {
      const created = await firstValueFrom(this.routeService.createRoute(input));
      this.routes.update(list => [...list, created]);
      this.showCreateDialog.set(false);
      this.messageService.add({
        severity: 'success',
        summary: 'Ruta creada',
        detail: `"${created.name}" fue creada exitosamente`,
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo crear la ruta',
      });
    } finally {
      this.saving.set(false);
    }
  }

  confirmDelete(route: RouteDto): void {
    this.confirmationService.confirm({
      message: `¿Seguro que querés eliminar la ruta "${route.name}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteRoute(route),
    });
  }

  private async deleteRoute(route: RouteDto): Promise<void> {
    try {
      await firstValueFrom(this.routeService.deleteRoute(route.id));
      this.routes.update(list => list.filter(r => r.id !== route.id));
      this.messageService.add({
        severity: 'success',
        summary: 'Eliminada',
        detail: `La ruta "${route.name}" fue eliminada`,
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo eliminar la ruta',
      });
    }
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'secondary';
      default: return 'info';
    }
  }
}
