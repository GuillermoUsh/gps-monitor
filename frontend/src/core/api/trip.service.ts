import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { TripDto, PositionHistoryDto, TripStatsDto, ScheduleTripInput, UpdateScheduleTripInput } from './api.types';

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

  startTrip(routeId: string, driverId?: string, vehicleId?: string, cantidadPasajeros?: number): Observable<TripDto> {
    return this.http
      .post<{ data: TripDto }>(`${this.base}/trips`, { routeId, driverId, vehicleId, cantidadPasajeros })
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

  scheduleTrip(input: ScheduleTripInput): Observable<TripDto> {
    return this.http
      .post<{ data: TripDto }>(`${this.base}/trips/schedule`, input)
      .pipe(map(res => res.data));
  }

  rescheduleTrip(id: string, input: UpdateScheduleTripInput): Observable<TripDto> {
    return this.http
      .patch<{ data: TripDto }>(`${this.base}/trips/${id}/schedule`, input)
      .pipe(map(res => res.data));
  }

  getMyTrips(): Observable<TripDto[]> {
    return this.http
      .get<{ data: TripDto[] }>(`${this.base}/trips/mine`)
      .pipe(map(res => res.data));
  }

  getTripPositions(tripId: string): Observable<{ positions: PositionHistoryDto[]; stats: TripStatsDto }> {
    return this.http
      .get<{ data: { positions: PositionHistoryDto[]; stats: TripStatsDto } }>(`${this.base}/trips/${tripId}/positions`)
      .pipe(map(res => res.data));
  }
}
