import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TenantService } from '../../../core/tenant/tenant.service';

@Component({
  selector: 'app-verify-email-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="auth-container">
      @if (loading()) {
        <p>Verificando tu email...</p>
      } @else if (verified()) {
        <div class="success">
          <h2>¡Email verificado!</h2>
          <p>Tu cuenta está activa. Ya podés iniciar sesión.</p>
          <a routerLink="/login">Ir al login</a>
        </div>
      } @else {
        <div class="error-state">
          <h2>Error de verificación</h2>
          <p>{{ errorMessage() }}</p>
          <button (click)="resend()">Reenviar email de verificación</button>
          <a routerLink="/login">Volver al login</a>
        </div>
      }
    </div>
  `,
})
export class VerifyEmailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly tenantService = inject(TenantService);

  readonly loading = signal(true);
  readonly verified = signal(false);
  readonly errorMessage = signal<string>('');

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.queryParams['token'];
    if (!token) {
      this.loading.set(false);
      this.errorMessage.set('Token de verificación no encontrado en la URL');
      return;
    }

    try {
      const url = `${this.tenantService.getApiBase()}/auth/verify-email?token=${token}`;
      await firstValueFrom(this.http.get(url, { withCredentials: true }));
      this.verified.set(true);
    } catch (err: unknown) {
      const message = (err as { error?: { message?: string } })?.error?.message;
      this.errorMessage.set(message ?? 'Token inválido o expirado');
    } finally {
      this.loading.set(false);
    }
  }

  async resend(): Promise<void> {
    // Could prompt for email here, for now just show message
    this.errorMessage.set('Ingresá al login y usá la opción de reenviar verificación');
  }
}
