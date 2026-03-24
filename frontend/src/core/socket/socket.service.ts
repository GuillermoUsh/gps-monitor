import { Injectable, OnDestroy, signal } from '@angular/core';
import { io } from 'socket.io-client';
import { environment } from '../../environments/environment';

export interface PositionUpdatePayload {
  tripId: string;
  routeId: string;
  driverId: string;
  lat: number;
  lng: number;
  speed: number | null;
  isDeviation: boolean;
  deviationMeters: number | null;
  distanceKm: number;
  recordedAt: string;
}

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket: ReturnType<typeof io> | null = null;

  readonly connectionStatus = signal<'connected' | 'disconnected' | 'error'>('disconnected');
  readonly positions = signal<Map<string, PositionUpdatePayload>>(new Map());

  connect(token: string): void {
    if (this.socket?.connected) {
      return;
    }

    // Socket.io needs the base URL, not the /api path
    const socketUrl = environment.apiUrl.replace(/\/api$/, '') || window.location.origin;
    this.socket = io(socketUrl, { auth: { token } });

    this.socket.on('connect', () => {
      this.connectionStatus.set('connected');
    });

    this.socket.on('disconnect', () => {
      this.connectionStatus.set('disconnected');
    });

    this.socket.on('position:update', (payload: PositionUpdatePayload) => {
      this.positions.update(current => {
        const updated = new Map(current);
        updated.set(payload.tripId, payload);
        return updated;
      });
    });

    this.socket.on('connect_error', () => {
      this.connectionStatus.set('error');
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
