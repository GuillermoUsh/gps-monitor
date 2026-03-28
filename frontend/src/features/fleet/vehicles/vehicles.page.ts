import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { MessageService, ConfirmationService } from 'primeng/api';

import { FleetService } from '../../../core/api/fleet.service';
import { VehicleDto } from '../../../core/api/api.types';

@Component({
  selector: 'app-vehicles-page',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    ButtonModule,
    TableModule,
    ToastModule,
    DialogModule,
    ConfirmDialogModule,
    InputTextModule,
    SelectModule,
    TagModule,
    InputNumberModule,
    TextareaModule,
    DecimalPipe,
  ],
  templateUrl: './vehicles.page.html',
  styleUrl: './vehicles.page.scss',
  providers: [MessageService, ConfirmationService],
})
export class VehiclesPage implements OnInit {
  private readonly fleetService = inject(FleetService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  goToDetail(id: string): void { this.router.navigate(['/fleet/vehicles', id]); }
  private readonly confirmationService = inject(ConfirmationService);

  vehicles = signal<VehicleDto[]>([]);
  loading = signal(false);
  saving = signal(false);
  showDialog = signal(false);

  filterSearch = '';
  filterEstado = '';

  editingId: string | null = null;

  // Form fields
  formAlias = '';
  formMarca = '';
  formModelo = '';
  formAnio: number | null = null;
  formPatente = '';
  formVin = '';
  formTipo = '';
  formColor = '';
  formCapacidad: number | null = null;
  formEstado = 'disponible';
  formKilometraje = 0;
  formNotas = '';

  readonly estadoOptions = [
    { label: 'Todos', value: '' },
    { label: 'Disponible', value: 'disponible' },
    { label: 'En uso', value: 'en_uso' },
    { label: 'En mantenimiento', value: 'en_mantenimiento' },
    { label: 'Fuera de servicio', value: 'fuera_de_servicio' },
  ];

  readonly estadoFormOptions = [
    { label: 'Disponible', value: 'disponible' },
    { label: 'En uso', value: 'en_uso' },
    { label: 'En mantenimiento', value: 'en_mantenimiento' },
    { label: 'Fuera de servicio', value: 'fuera_de_servicio' },
  ];

  readonly tipoOptions = [
    { label: 'Auto', value: 'auto' },
    { label: 'Camioneta', value: 'camioneta' },
    { label: 'Minibus', value: 'minibus' },
    { label: 'Bus', value: 'bus' },
    { label: 'Otro', value: 'otro' },
  ];

  ngOnInit(): void {
    this.loadVehicles();
  }

  async loadVehicles(): Promise<void> {
    this.loading.set(true);
    try {
      const filters: { estado?: string; search?: string } = {};
      if (this.filterEstado) filters.estado = this.filterEstado;
      if (this.filterSearch) filters.search = this.filterSearch;
      const data = await firstValueFrom(this.fleetService.getVehicles(filters));
      this.vehicles.set(data);
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudieron cargar los vehículos',
      });
    } finally {
      this.loading.set(false);
    }
  }

  openCreateDialog(): void {
    this.editingId = null;
    this.resetForm();
    this.showDialog.set(true);
  }

  openEditDialog(vehicle: VehicleDto): void {
    this.editingId = vehicle.id;
    this.formAlias = vehicle.alias ?? '';
    this.formMarca = vehicle.marca;
    this.formModelo = vehicle.modelo;
    this.formAnio = vehicle.anio;
    this.formPatente = vehicle.patente;
    this.formVin = vehicle.vin ?? '';
    this.formTipo = vehicle.tipo ?? '';
    this.formColor = vehicle.color ?? '';
    this.formCapacidad = vehicle.capacidad_pasajeros;
    this.formEstado = vehicle.estado;
    this.formKilometraje = vehicle.kilometraje;
    this.formNotas = vehicle.notas ?? '';
    this.showDialog.set(true);
  }

  async saveVehicle(): Promise<void> {
    if (!this.formMarca || !this.formModelo || !this.formPatente) return;

    const payload: Partial<VehicleDto> = {
      alias: this.formAlias || null,
      marca: this.formMarca,
      modelo: this.formModelo,
      anio: this.formAnio,
      patente: this.formPatente,
      vin: this.formVin || null,
      tipo: this.formTipo || null,
      color: this.formColor || null,
      capacidad_pasajeros: this.formCapacidad,
      estado: this.formEstado,
      kilometraje: this.formKilometraje,
      notas: this.formNotas || null,
    };

    this.saving.set(true);
    try {
      if (this.editingId) {
        const updated = await firstValueFrom(this.fleetService.updateVehicle(this.editingId, payload));
        this.vehicles.update(list => list.map(v => v.id === this.editingId ? updated : v));
        this.messageService.add({ severity: 'success', summary: 'Actualizado', detail: 'Vehículo actualizado correctamente' });
      } else {
        const created = await firstValueFrom(this.fleetService.createVehicle(payload));
        this.vehicles.update(list => [created, ...list]);
        this.messageService.add({ severity: 'success', summary: 'Creado', detail: 'Vehículo creado correctamente' });
      }
      this.showDialog.set(false);
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo guardar el vehículo',
      });
    } finally {
      this.saving.set(false);
    }
  }

  confirmDelete(vehicle: VehicleDto): void {
    this.confirmationService.confirm({
      message: `¿Confirmás eliminar el vehículo ${vehicle.patente}?`,
      header: 'Eliminar vehículo',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteVehicle(vehicle.id),
    });
  }

  async deleteVehicle(id: string): Promise<void> {
    try {
      await firstValueFrom(this.fleetService.deleteVehicle(id));
      this.vehicles.update(list => list.filter(v => v.id !== id));
      this.messageService.add({ severity: 'info', summary: 'Eliminado', detail: 'Vehículo eliminado' });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo eliminar el vehículo',
      });
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

  get dialogTitle(): string {
    return this.editingId ? 'Editar vehículo' : 'Nuevo vehículo';
  }

  private resetForm(): void {
    this.formAlias = '';
    this.formMarca = '';
    this.formModelo = '';
    this.formAnio = null;
    this.formPatente = '';
    this.formVin = '';
    this.formTipo = '';
    this.formColor = '';
    this.formCapacidad = null;
    this.formEstado = 'disponible';
    this.formKilometraje = 0;
    this.formNotas = '';
  }
}
