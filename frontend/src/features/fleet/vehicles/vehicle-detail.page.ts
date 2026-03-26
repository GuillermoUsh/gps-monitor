import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ToolbarModule } from 'primeng/toolbar';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TextareaModule } from 'primeng/textarea';
import { MessageService } from 'primeng/api';

import { FleetService } from '../../../core/api/fleet.service';
import {
  VehicleDto,
  VehicleDocumentDto,
  MaintenanceDto,
  DriverProfileDto,
} from '../../../core/api/api.types';

@Component({
  selector: 'app-vehicle-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    DecimalPipe,
    FormsModule,
    ButtonModule,
    CardModule,
    TagModule,
    ToolbarModule,
    ToastModule,
    DialogModule,
    SelectModule,
    InputTextModule,
    InputNumberModule,
    DatePickerModule,
    TableModule,
    TabsModule,
    TextareaModule,
  ],
  templateUrl: './vehicle-detail.page.html',
  styleUrl: './vehicle-detail.page.scss',
  providers: [MessageService],
})
export class VehicleDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly fleetService = inject(FleetService);
  private readonly messageService = inject(MessageService);

  vehicleId = signal<string>('');
  vehicle = signal<VehicleDto | null>(null);
  documents = signal<VehicleDocumentDto[]>([]);
  maintenances = signal<MaintenanceDto[]>([]);
  driverProfiles = signal<DriverProfileDto[]>([]);

  loading = signal(false);
  assigning = signal(false);

  // Assignment
  selectedDriverId: string | null = null;

  // Document dialog
  showDocDialog = signal(false);
  savingDoc = signal(false);
  docTipo = '';
  docDescripcion = '';
  docFechaVencimiento: Date | null = null;

  // Maintenance dialog
  showMaintDialog = signal(false);
  savingMaint = signal(false);
  maintTipo = '';
  maintDescripcion = '';
  maintFecha: Date | null = null;
  maintKilometraje: number | null = null;
  maintProximoKm: number | null = null;
  maintProximoFecha: Date | null = null;

  readonly docTipoOptions = [
    { label: 'Seguro', value: 'seguro' },
    { label: 'VTV', value: 'vtv' },
    { label: 'Habilitación turística', value: 'habilitacion_turistica' },
    { label: 'Otro', value: 'otro' },
  ];

  ngOnInit(): void {
    this.vehicleId.set(this.route.snapshot.paramMap.get('id') ?? '');
    this.loadAll();
  }

  async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const [vehicles, docs, maints, drivers] = await Promise.all([
        firstValueFrom(this.fleetService.getVehicles()),
        firstValueFrom(this.fleetService.getDocuments(this.vehicleId())),
        firstValueFrom(this.fleetService.getMaintenances(this.vehicleId())),
        firstValueFrom(this.fleetService.getDriverProfiles()),
      ]);
      const found = vehicles.find(v => v.id === this.vehicleId()) ?? null;
      this.vehicle.set(found);
      this.documents.set(docs);
      this.maintenances.set(maints);
      this.driverProfiles.set(drivers);
      if (found?.currentDriver) {
        this.selectedDriverId = found.currentDriver.id;
      }
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudieron cargar los datos del vehículo',
      });
    } finally {
      this.loading.set(false);
    }
  }

  async assignDriver(): Promise<void> {
    if (!this.selectedDriverId) return;
    this.assigning.set(true);
    try {
      await firstValueFrom(this.fleetService.assignDriver(this.vehicleId(), this.selectedDriverId));
      const driver = this.driverProfiles().find(d => d.user_id === this.selectedDriverId);
      this.vehicle.update(v => v ? { ...v, currentDriver: { id: this.selectedDriverId!, email: driver?.email ?? '' } } : v);
      this.messageService.add({ severity: 'success', summary: 'Asignado', detail: 'Conductor asignado correctamente' });
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo asignar el conductor' });
    } finally {
      this.assigning.set(false);
    }
  }

  async unassignDriver(): Promise<void> {
    this.assigning.set(true);
    try {
      await firstValueFrom(this.fleetService.unassignDriver(this.vehicleId()));
      this.vehicle.update(v => v ? { ...v, currentDriver: null } : v);
      this.selectedDriverId = null;
      this.messageService.add({ severity: 'info', summary: 'Desasignado', detail: 'Conductor desasignado' });
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo desasignar el conductor' });
    } finally {
      this.assigning.set(false);
    }
  }

  openDocDialog(): void {
    this.docTipo = '';
    this.docDescripcion = '';
    this.docFechaVencimiento = null;
    this.showDocDialog.set(true);
  }

  async saveDocument(): Promise<void> {
    if (!this.docTipo || !this.docFechaVencimiento) return;

    this.savingDoc.set(true);
    try {
      const doc = await firstValueFrom(this.fleetService.createDocument(this.vehicleId(), {
        tipo: this.docTipo,
        descripcion: this.docDescripcion || null,
        fecha_vencimiento: this.docFechaVencimiento.toISOString().split('T')[0],
      }));
      this.documents.update(list => [doc, ...list]);
      this.showDocDialog.set(false);
      this.messageService.add({ severity: 'success', summary: 'Guardado', detail: 'Documento agregado' });
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar el documento' });
    } finally {
      this.savingDoc.set(false);
    }
  }

  async deleteDocument(docId: string): Promise<void> {
    try {
      await firstValueFrom(this.fleetService.deleteDocument(docId));
      this.documents.update(list => list.filter(d => d.id !== docId));
      this.messageService.add({ severity: 'info', summary: 'Eliminado', detail: 'Documento eliminado' });
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar el documento' });
    }
  }

  openMaintDialog(): void {
    this.maintTipo = '';
    this.maintDescripcion = '';
    this.maintFecha = null;
    this.maintKilometraje = null;
    this.maintProximoKm = null;
    this.maintProximoFecha = null;
    this.showMaintDialog.set(true);
  }

  async saveMaintenance(): Promise<void> {
    if (!this.maintTipo || !this.maintFecha) return;

    this.savingMaint.set(true);
    try {
      const maint = await firstValueFrom(this.fleetService.createMaintenance(this.vehicleId(), {
        tipo: this.maintTipo,
        descripcion: this.maintDescripcion || null,
        fecha: this.maintFecha.toISOString().split('T')[0],
        kilometraje: this.maintKilometraje,
        proximo_service_km: this.maintProximoKm,
        proximo_service_fecha: this.maintProximoFecha
          ? this.maintProximoFecha.toISOString().split('T')[0]
          : null,
      }));
      this.maintenances.update(list => [maint, ...list]);
      this.showMaintDialog.set(false);
      this.messageService.add({ severity: 'success', summary: 'Guardado', detail: 'Mantenimiento registrado' });
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar el mantenimiento' });
    } finally {
      this.savingMaint.set(false);
    }
  }

  getEstadoSeverity(estado: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      disponible: 'success',
      en_uso: 'info',
      en_mantenimiento: 'warn',
      fuera_de_servicio: 'danger',
    };
    return map[estado] ?? 'secondary';
  }

  getEstadoLabel(estado: string): string {
    const map: Record<string, string> = {
      disponible: 'Disponible',
      en_uso: 'En uso',
      en_mantenimiento: 'En mantenimiento',
      fuera_de_servicio: 'Fuera de servicio',
    };
    return map[estado] ?? estado;
  }

  getDocSeverity(diasRestantes: number | undefined): 'danger' | 'warn' | 'success' {
    if (diasRestantes === undefined) return 'success';
    if (diasRestantes < 7) return 'danger';
    if (diasRestantes < 30) return 'warn';
    return 'success';
  }

  get driverOptions() {
    return this.driverProfiles().map(d => ({ label: d.email, value: d.user_id }));
  }
}
