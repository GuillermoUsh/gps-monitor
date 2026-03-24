import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { RouteDto, WaypointInput } from './api.types';

export interface CreateRouteInput {
  name: string;
  origin: string;
  destination: string;
  waypoints: WaypointInput[];
}

@Injectable({ providedIn: 'root' })
export class RouteService {
  private readonly http = inject(HttpClient);

  private get base(): string {
    return environment.apiUrl;
  }

  getRoutes(): Observable<RouteDto[]> {
    return this.http
      .get<{ data: RouteDto[] }>(`${this.base}/routes`)
      .pipe(map(res => res.data));
  }

  getRoute(id: string): Observable<RouteDto> {
    return this.http
      .get<{ data: RouteDto }>(`${this.base}/routes/${id}`)
      .pipe(map(res => res.data));
  }

  createRoute(input: CreateRouteInput): Observable<RouteDto> {
    return this.http
      .post<{ data: RouteDto }>(`${this.base}/routes`, input)
      .pipe(map(res => res.data));
  }

  updateRoute(id: string, input: CreateRouteInput): Observable<RouteDto> {
    return this.http
      .put<{ data: RouteDto }>(`${this.base}/routes/${id}`, input)
      .pipe(map(res => res.data));
  }

  deleteRoute(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/routes/${id}`);
  }
}
