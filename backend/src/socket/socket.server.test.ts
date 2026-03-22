import http from 'http';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';

// Set env vars before any imports that trigger env validation
process.env.JWT_SECRET = 'test-jwt-secret-must-be-at-least-32-chars';
process.env.DB_NAME = 'test';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.SMTP_FROM = 'test@test.com';
process.env.NODE_ENV = 'test';
process.env.SOCKET_CORS_ORIGIN = 'http://localhost:4200';

import { SocketServer } from './socket.server';
import { SOCKET_EVENTS } from './socket.events';

const JWT_SECRET = 'test-jwt-secret-must-be-at-least-32-chars';

function makeToken(tenantSchema: string, sub = 'user-1', role = 'driver'): string {
  return jwt.sign({ sub, tenantSchema, role }, JWT_SECRET, { expiresIn: '1h' });
}

function waitFor(emitter: ClientSocket, event: string, timeout = 2000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for event: ${event}`)), timeout);
    emitter.once(event, (data: unknown) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

describe('SocketServer', () => {
  let httpServer: http.Server;
  let port: number;
  const clients: ClientSocket[] = [];

  function createClient(opts: { token?: string } = {}): ClientSocket {
    const client = ioc(`http://localhost:${port}`, {
      auth: opts.token !== undefined ? { token: opts.token } : {},
      transports: ['websocket'],
      reconnection: false,
    });
    clients.push(client);
    return client;
  }

  beforeAll(done => {
    // Reset singleton so each test file gets a fresh server
    (SocketServer as unknown as { instance: null }).instance = null;

    httpServer = http.createServer();
    SocketServer.initialize(httpServer, { corsOrigin: 'http://localhost:4200' });

    httpServer.listen(0, () => {
      const addr = httpServer.address();
      port = typeof addr === 'object' && addr ? addr.port : 0;
      done();
    });
  });

  afterAll(done => {
    // Disconnect all clients
    clients.forEach(c => c.disconnect());
    httpServer.close(done);
    // Reset singleton for other test files
    (SocketServer as unknown as { instance: null }).instance = null;
  });

  afterEach(() => {
    // Disconnect clients created in each test
    clients.forEach(c => c.disconnect());
    clients.length = 0;
  });

  describe('autenticación', () => {
    it('rechaza conexión sin token', done => {
      const client = createClient({});

      client.on('connect_error', (err: Error) => {
        expect(err.message).toBe(SOCKET_EVENTS.AUTH_ERROR);
        done();
      });
    });

    it('rechaza conexión con token inválido', done => {
      const client = createClient({ token: 'token-invalido' });

      client.on('connect_error', (err: Error) => {
        expect(err.message).toBe(SOCKET_EVENTS.AUTH_ERROR);
        done();
      });
    });

    it('acepta conexión con token válido', done => {
      const token = makeToken('agency_rimatur');
      const client = createClient({ token });

      client.on('connect', () => {
        expect(client.connected).toBe(true);
        done();
      });

      client.on('connect_error', done);
    });
  });

  describe('join:agency', () => {
    it('ignora join:agency si el slug no coincide con el token', done => {
      const token = makeToken('agency_rimatur');
      const client = createClient({ token });

      client.on('connect', () => {
        // Join con slug diferente al del token
        client.emit(SOCKET_EVENTS.JOIN_AGENCY, 'patagonia');

        // Enviar un update: el cliente NO debería recibirlo
        setTimeout(() => {
          const socketServer = SocketServer.getInstance()!;
          let received = false;

          client.on(SOCKET_EVENTS.POSITION_UPDATE, () => { received = true; });
          socketServer.emitPositionUpdate('patagonia', {
            tripId: 't1', routeId: 'r1', driverId: 'd1',
            lat: -34.6, lng: -58.38, speed: null,
            isDeviation: false, deviationMeters: null,
            distanceKm: 0, recordedAt: new Date().toISOString(),
          });

          setTimeout(() => {
            expect(received).toBe(false);
            done();
          }, 200);
        }, 100);
      });
    });

    it('recibe position:update tras join:agency correcto', async () => {
      const token = makeToken('agency_rimatur');
      const client = createClient({ token });

      await new Promise<void>((resolve, reject) => {
        client.on('connect', resolve);
        client.on('connect_error', reject);
      });

      client.emit(SOCKET_EVENTS.JOIN_AGENCY, 'rimatur');

      // Pequeña espera para que el join se procese
      await new Promise(r => setTimeout(r, 100));

      const socketServer = SocketServer.getInstance()!;
      const payload = {
        tripId: 'trip-1', routeId: 'route-1', driverId: 'driver-1',
        lat: -34.608, lng: -58.370, speed: 60,
        isDeviation: false, deviationMeters: null,
        distanceKm: 1.5, recordedAt: new Date().toISOString(),
      };

      const received = waitFor(client, SOCKET_EVENTS.POSITION_UPDATE);
      socketServer.emitPositionUpdate('rimatur', payload);

      const data = await received;
      expect(data).toMatchObject({ tripId: 'trip-1', lat: -34.608 });
    });

    it('aislamiento de tenants: rimatur no recibe eventos de patagonia', async () => {
      const tokenRimatur = makeToken('agency_rimatur');
      const tokenPatagonia = makeToken('agency_patagonia', 'user-2');

      const clientRimatur = createClient({ token: tokenRimatur });
      const clientPatagonia = createClient({ token: tokenPatagonia });

      await Promise.all([
        new Promise<void>(r => clientRimatur.on('connect', r)),
        new Promise<void>(r => clientPatagonia.on('connect', r)),
      ]);

      clientRimatur.emit(SOCKET_EVENTS.JOIN_AGENCY, 'rimatur');
      clientPatagonia.emit(SOCKET_EVENTS.JOIN_AGENCY, 'patagonia');

      await new Promise(r => setTimeout(r, 100));

      const socketServer = SocketServer.getInstance()!;
      let rimaturReceived = false;
      clientRimatur.on(SOCKET_EVENTS.POSITION_UPDATE, () => { rimaturReceived = true; });

      socketServer.emitPositionUpdate('patagonia', {
        tripId: 't2', routeId: 'r2', driverId: 'd2',
        lat: -41.1, lng: -71.3, speed: 80,
        isDeviation: false, deviationMeters: null,
        distanceKm: 5, recordedAt: new Date().toISOString(),
      });

      await new Promise(r => setTimeout(r, 200));
      expect(rimaturReceived).toBe(false);
    });
  });
});
