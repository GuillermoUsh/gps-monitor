import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TenantService } from '../../../core/tenant/tenant.service';

@Component({
  selector: 'app-register-agency-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-container">
      <h1>Registrar agencia</h1>
      @if (!success()) {
        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <div class="field">
            <label>Nombre de la agencia</label>
            <input type="text" formControlName="name" />
          </div>
          <div class="field">
            <label>Slug (subdominio)</label>
            <input type="text" formControlName="slug" />
            @if (slugPreview()) {
              <small>Tu acceso: <strong>{{ slugPreview() }}.gpsmonitor.com</strong></small>
            }
          </div>
          <div class="field">
            <label>Email del administrador</label>
            <input type="email" formControlName="adminEmail" />
          </div>
          <div class="field">
            <label>Contraseña</label>
            <input type="password" formControlName="adminPassword" />
          </div>
          @if (error()) {
            <p class="error">{{ error() }}</p>
          }
          <button type="submit" [disabled]="form.invalid || loading()">
            {{ loading() ? 'Registrando...' : 'Registrar agencia' }}
          </button>
        </form>
      } @else {
        <div class="success">
          <h2>¡Agencia creada!</h2>
          <p>Revisá tu email para verificar la cuenta antes de iniciar sesión.</p>
          <a routerLink="/login">Ir al login</a>
        </div>
      }
    </div>
  `,
})
export class RegisterAgencyPage {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly tenantService = inject(TenantService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal(false);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    slug: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30), Validators.pattern(/^[a-z0-9-]+$/)]],
    adminEmail: ['', [Validators.required, Validators.email]],
    adminPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  readonly slugPreview = computed(() => {
    const slug = this.form.get('slug')?.value ?? '';
    return slug.length >= 3 ? slug.toLowerCase().replace(/[^a-z0-9-]/g, '') : '';
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const url = `${this.tenantService.getApiBase()}/agencies`;
      await firstValueFrom(this.http.post(url, this.form.value));
      this.success.set(true);
    } catch (err: unknown) {
      const message = (err as { error?: { message?: string } })?.error?.message;
      this.error.set(message ?? 'Error al registrar la agencia');
    } finally {
      this.loading.set(false);
    }
  }
}
