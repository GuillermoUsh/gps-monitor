import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-register-page',
  standalone: true,
  templateUrl: './register.page.html',
  styleUrl: './register.page.scss',
  imports: [
    ReactiveFormsModule, RouterLink,
    ButtonModule, InputTextModule, PasswordModule, MessageModule,
  ],
})
export class RegisterPage {
  private readonly fb      = inject(FormBuilder);
  private readonly router  = inject(Router);
  private readonly http    = inject(HttpClient);

  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);
  readonly success = signal(false);

  readonly form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const { email, password } = this.form.value;
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/auth/register`, { email, password })
      );
      this.success.set(true);
      await this.router.navigate(['/login']);
    } catch (err: unknown) {
      const message = (err as { error?: { message?: string } })?.error?.message;
      this.error.set(message ?? 'Error al registrarse');
    } finally {
      this.loading.set(false);
    }
  }
}
