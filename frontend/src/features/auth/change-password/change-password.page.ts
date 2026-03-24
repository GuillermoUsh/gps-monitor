import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-change-password-page',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule, PasswordModule, MessageModule],
  templateUrl: './change-password.page.html',
  styleUrl: './change-password.page.scss',
})
export class ChangePasswordPage {
  private readonly fb     = inject(FormBuilder);
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  readonly form = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword:     ['', [Validators.required, Validators.minLength(8)]],
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const url = `${environment.apiUrl}/auth/change-password`;
      await firstValueFrom(this.http.post(url, this.form.value, { withCredentials: true }));
      await this.router.navigate(['/dashboard']);
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message;
      this.error.set(msg ?? 'Error al cambiar la contraseña');
    } finally {
      this.loading.set(false);
    }
  }
}
