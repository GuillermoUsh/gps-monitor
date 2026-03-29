import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { CheckboxModule } from 'primeng/checkbox';
import { TextareaModule } from 'primeng/textarea';
import { MessageService } from 'primeng/api';

import { FleetService } from '../../../core/api/fleet.service';
import { DriverProfileDto } from '../../../core/api/api.types';

@Component({
  selector: 'app-drivers-page',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    ButtonModule,
    TableModule,
    ToastModule,
    DialogModule,
    InputTextModule,
    DatePickerModule,
    TagModule,
    CheckboxModule,
    TextareaModule,
  ],
  templateUrl: './drivers.page.html',
  styleUrl: './drivers.page.scss',
  providers: [MessageService],
})
export class DriversPage implements OnInit {
  private readonly fleetService = inject(FleetService);
  private readonly messageService = inject(MessageService);

  drivers = signal<DriverProfileDto[]>([]);
  loading = signal(false);
  saving = signal(false);
  showDialog = signal(false);

  editingUserId: string | null = null;
  editingEmail = '';

  formNombre = '';
  formApellido = '';
  formLicencia = '';
  formVencimiento: Date | null = null;
  formTelefono = '';
  formCursoPuerto = false;
  formNotas = '';

  ngOnInit(): void {
    this.loadDrivers();
  }

  async loadDrivers(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(this.fleetService.getDriverProfiles());
      this.drivers.set(data);
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los choferes' });
    } finally {
      this.loading.set(false);
    }
  }

  openEditDialog(driver: DriverProfileDto): void {
    this.editingUserId = driver.user_id;
    this.editingEmail = driver.email;
    this.formNombre = driver.nombre ?? '';
    this.formApellido = driver.apellido ?? '';
    this.formLicencia = driver.licencia ?? '';
    this.formVencimiento = driver.vencimiento_licencia ? new Date(driver.vencimiento_licencia) : null;
    this.formTelefono = driver.telefono ?? '';
    this.formCursoPuerto = driver.curso_puerto ?? false;
    this.formNotas = driver.notas ?? '';
    this.showDialog.set(true);
  }

  async saveDriver(): Promise<void> {
    if (!this.editingUserId) return;

    this.saving.set(true);
    try {
      const updated = await firstValueFrom(
        this.fleetService.upsertDriverProfile(this.editingUserId, {
          nombre: this.formNombre || null,
          apellido: this.formApellido || null,
          licencia: this.formLicencia || null,
          vencimiento_licencia: this.formVencimiento
            ? this.formVencimiento.toISOString().split('T')[0]
            : null,
          telefono: this.formTelefono || null,
          curso_puerto: this.formCursoPuerto,
          notas: this.formNotas || null,
        }),
      );
      this.drivers.update(list => list.map(d => d.user_id === this.editingUserId ? updated : d));
      this.showDialog.set(false);
      this.messageService.add({ severity: 'success', summary: 'Guardado', detail: 'Perfil actualizado' });
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar el perfil' });
    } finally {
      this.saving.set(false);
    }
  }

  getLicenciaSeverity(vencimiento: string | null): 'danger' | 'warn' | 'success' | 'secondary' {
    if (!vencimiento) return 'secondary';
    const diffDays = Math.ceil((new Date(vencimiento).getTime() - Date.now()) / 86_400_000);
    if (diffDays < 0) return 'danger';
    if (diffDays <= 30) return 'warn';
    return 'success';
  }

  getLicenciaLabel(vencimiento: string | null): string {
    if (!vencimiento) return 'Sin fecha';
    const diffDays = Math.ceil((new Date(vencimiento).getTime() - Date.now()) / 86_400_000);
    if (diffDays < 0) return 'Vencida';
    if (diffDays <= 30) return `Vence en ${diffDays}d`;
    return new Date(vencimiento).toLocaleDateString('es-AR');
  }
}
