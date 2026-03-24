import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { TripDto } from './api.types';

@Injectable({ providedIn: 'root' })
export class TripService {
  private readonly http = inject(HttpClient);

  private get base(): string {
    return environment.apiUrl;
  }

  getTrips(): Observable<TripDto[]> {
    return this.http
      .get<{ data: TripDto[] }>(`${this.base}/trips`)
      .pipe(map(res => res.data));
  }

  startTrip(routeId: string, driverId?: string): Observable<TripDto> {
    return this.http
      .post<{ data: TripDto }>(`${this.base}/trips`, { routeId, driverId })
      .pipe(map(res => res.data));
  }

  completeTrip(id: string): Observable<TripDto> {
    return this.http
      .patch<{ data: TripDto }>(`${this.base}/trips/${id}`, { action: 'complete' })
      .pipe(map(res => res.data));
  }

  cancelTrip(id: string): Observable<TripDto> {
    return this.http
      .patch<{ data: TripDto }>(`${this.base}/trips/${id}`, { action: 'cancel' })
      .pipe(map(res => res.data));
  }

  getMyTrips(): Observable<TripDto[]> {
    return this.http
      .get<{ data: TripDto[] }>(`${this.base}/trips/mine`)
      .pipe(map(res => res.data));
  }
}
