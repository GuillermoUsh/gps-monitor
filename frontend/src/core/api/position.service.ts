import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface PositionInput {
  lat: number;
  lng: number;
  speed?: number;
  timestamp: string;
}

export interface LatestPosition {
  tripId: string;
  lat: number;
  lng: number;
  isDeviation: boolean;
}

@Injectable({ providedIn: 'root' })
export class PositionService {
  private readonly http = inject(HttpClient);

  private get base(): string {
    return environment.apiUrl;
  }

  sendPosition(tripId: string, body: PositionInput): Observable<unknown> {
    return this.http.post(`${this.base}/trips/${tripId}/positions`, body);
  }

  getLatestPerActiveTrip(): Observable<LatestPosition[]> {
    return this.http
      .get<{ data: LatestPosition[] }>(`${this.base}/trips/positions/latest`)
      .pipe(map(res => res.data));
  }
}
