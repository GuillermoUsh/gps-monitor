import { Component, OnInit, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { UserService, UserDto, CreateUserInput } from '../../core/api/user.service';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [
    ButtonModule,
    TableModule,
    ToastModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    TagModule,
    FormsModule,
    DatePipe,
  ],
  templateUrl: './users.page.html',
  styleUrl: './users.page.scss',
  providers: [MessageService],
})
export class UsersPage implements OnInit {
  private readonly userService = inject(UserService);
  private readonly messageService = inject(MessageService);
  private readonly location = inject(Location);

  goBack(): void { this.location.back(); }

  users = signal<UserDto[]>([]);
  loading = signal(false);
  showCreateDialog = signal(false);
  showCredentialsDialog = signal(false);
  saving = signal(false);

  formEmail = '';
  formPassword = '';
  formRole: string = 'driver';

  createdEmail = '';
  createdPassword = '';

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
      next: users => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar los usuarios' });
        this.loading.set(false);
      },
    });
  }

  openCreateDialog(): void {
    this.formEmail = '';
    this.formPassword = '';
    this.formRole = 'driver';
    this.showCreateDialog.set(true);
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
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo crear el usuario' });
        this.saving.set(false);
      },
    });
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
}
