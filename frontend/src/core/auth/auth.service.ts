import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TenantService } from '../tenant/tenant.service';

export interface LoginResponse {
  status: string;
  data: {
    accessToken: string;
    user: { id: string; email: string; role: string };
  };
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tenantService = inject(TenantService);

  private readonly _accessToken = signal<string | null>(null);
  private readonly _user = signal<AuthUser | null>(null);

  readonly isAuthenticated = computed(() => !!this._accessToken());
  readonly currentUser = computed(() => this._user());
  readonly accessToken = computed(() => this._accessToken());

  async login(email: string, password: string): Promise<void> {
    const url = `${this.tenantService.getApiBase()}/auth/login`;
    const response = await firstValueFrom(
      this.http.post<LoginResponse>(url, { email, password }, { withCredentials: true })
    );
    this._accessToken.set(response.data.accessToken);
    this._user.set(response.data.user);
  }

  async logout(): Promise<void> {
    const url = `${this.tenantService.getApiBase()}/auth/logout`;
    try {
      await firstValueFrom(
        this.http.post(url, {}, { withCredentials: true })
      );
    } finally {
      this._accessToken.set(null);
      this._user.set(null);
      await this.router.navigate(['/login']);
    }
  }

  async refresh(): Promise<boolean> {
    const url = `${this.tenantService.getApiBase()}/auth/refresh`;
    try {
      const response = await firstValueFrom(
        this.http.post<{ status: string; data: { accessToken: string } }>(
          url, {}, { withCredentials: true }
        )
      );
      this._accessToken.set(response.data.accessToken);
      return true;
    } catch {
      this._accessToken.set(null);
      this._user.set(null);
      return false;
    }
  }

  setToken(token: string, user: AuthUser): void {
    this._accessToken.set(token);
    this._user.set(user);
  }

  clearSession(): void {
    this._accessToken.set(null);
    this._user.set(null);
  }
}
