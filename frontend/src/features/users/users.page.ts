import { Component, OnInit, inject, signal } from '@angular/core';
import { Location, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { TextareaModule } from 'primeng/textarea';

import { UserService, UserDto, CreateUserInput } from '../../core/api/user.service';
import { FleetService } from '../../core/api/fleet.service';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    TableModule,
    ToastModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    TagModule,
    CheckboxModule,
    DatePickerModule,
    TextareaModule,
  ],
  templateUrl: './users.page.html',
  styleUrl: './users.page.scss',
  providers: [MessageService],
})
export class UsersPage implements OnInit {
  private readonly userService = inject(UserService);
  private readonly fleetService = inject(FleetService);
  private readonly messageService = inject(MessageService);
  private readonly location = inject(Location);

  goBack(): void { this.location.back(); }

  users = signal<UserDto[]>([]);
  loading = signal(false);
  showCreateDialog = signal(false);
  showCredentialsDialog = signal(false);
  showProfileDialog = signal(false);
  saving = signal(false);

  // Create form
  formEmail = '';
  formPassword = '';
  formRole: string = 'driver';

  // Credentials dialog
  createdEmail = '';
  createdPassword = '';

  // Driver profile dialog
  profileUserId = '';
  profileEmail = '';
  profileNombre = '';
  profileApellido = '';
  profileLicencia = '';
  profileVencimiento: Date | null = null;
  profileTelefono = '';
  profileCursoPuerto = false;
  profileNotas = '';

  readonly roleOptions = [
    { label: 'Chofer', value: 'driver' },
    { label: 'Mecánico', value: 'mechanic' },
    { label: 'Administración', value: 'administration' },
    { label: 'Ventas', value: 'sales' },
  ];

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.userService.getUsers().subscribe({
      next: users => { this.users.set(users); this.loading.set(false); },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar los usuarios' });
        this.loading.set(false);
      },
    });
  }

  openCreateDialog(): void {
    this.formEmail = '';
    this.formPassword = this.generatePassword();
    this.formRole = 'driver';
    this.showCreateDialog.set(true);
  }

  regeneratePassword(): void {
    this.formPassword = this.generatePassword();
  }

  saveUser(): void {
    if (!this.formEmail || !this.formPassword) return;

    this.saving.set(true);
    const input: CreateUserInput = {
      email: this.formEmail,
      password: this.formPassword,
      role: this.formRole as CreateUserInput['role'],
    };

    this.userService.createUser(input).subscribe({
      next: user => {
        this.users.update(list => [user, ...list]);
        this.showCreateDialog.set(false);
        this.createdEmail = this.formEmail;
        this.createdPassword = this.formPassword;
        this.showCredentialsDialog.set(true);
        this.saving.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo crear el usuario. El email puede estar en uso.' });
        this.saving.set(false);
      },
    });
  }

  openProfileDialog(user: UserDto): void {
    this.profileUserId = user.id;
    this.profileEmail = user.email;
    this.profileNombre = '';
    this.profileApellido = '';
    this.profileLicencia = '';
    this.profileVencimiento = null;
    this.profileTelefono = '';
    this.profileCursoPuerto = false;
    this.profileNotas = '';

    // Try to load existing profile
    this.fleetService.getDriverProfiles().subscribe({
      next: profiles => {
        const existing = profiles.find(p => p.user_id === user.id);
        if (existing) {
          this.profileNombre = existing.nombre ?? '';
          this.profileApellido = existing.apellido ?? '';
          this.profileLicencia = existing.licencia ?? '';
          this.profileVencimiento = existing.vencimiento_licencia ? new Date(existing.vencimiento_licencia) : null;
          this.profileTelefono = existing.telefono ?? '';
          this.profileCursoPuerto = existing.curso_puerto ?? false;
          this.profileNotas = existing.notas ?? '';
        }
      },
    });

    this.showProfileDialog.set(true);
  }

  async saveProfile(): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(this.fleetService.upsertDriverProfile(this.profileUserId, {
        nombre: this.profileNombre || null,
        apellido: this.profileApellido || null,
        licencia: this.profileLicencia || null,
        vencimiento_licencia: this.profileVencimiento
          ? this.profileVencimiento.toISOString().split('T')[0]
          : null,
        telefono: this.profileTelefono || null,
        curso_puerto: this.profileCursoPuerto,
        notas: this.profileNotas || null,
      }));
      this.showProfileDialog.set(false);
      this.messageService.add({ severity: 'success', summary: 'Guardado', detail: 'Perfil de conductor actualizado' });
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar el perfil' });
    } finally {
      this.saving.set(false);
    }
  }

  getRoleSeverity(role: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    const map: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      driver: 'info',
      mechanic: 'warn',
      administration: 'success',
      sales: 'secondary',
      admin: 'danger',
    };
    return map[role] ?? 'secondary';
  }

  getRoleLabel(role: string): string {
    const map: Record<string, string> = {
      driver: 'Chofer',
      mechanic: 'Mecánico',
      administration: 'Administración',
      sales: 'Ventas',
      admin: 'Admin',
    };
    return map[role] ?? role;
  }

  private generatePassword(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
}
