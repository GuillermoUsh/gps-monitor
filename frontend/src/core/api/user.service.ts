import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { TenantService } from '../tenant/tenant.service';

export interface UserDto {
  id: string;
  email: string;
  role: string;
  verified: boolean;
}

export interface CreateUserInput {
  email: string;
  password: string;
  role: 'driver' | 'mechanic' | 'administration' | 'sales';
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly tenantService = inject(TenantService);

  private get base() { return this.tenantService.getApiBase(); }

  getUsers(): Observable<UserDto[]> {
    return this.http.get<{ data: UserDto[] }>(`${this.base}/users`).pipe(map(r => r.data));
  }

  createUser(input: CreateUserInput): Observable<UserDto> {
    return this.http.post<{ data: UserDto }>(`${this.base}/users`, input).pipe(map(r => r.data));
  }
}
