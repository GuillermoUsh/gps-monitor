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

function makeToken(sub = 'user-1', role = 'driver'): string {
  return jwt.sign({ sub, role }, JWT_SECRET, { expiresIn: '1h' });
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
    clients.forEach(c => c.disconnect());
    httpServer.close(done);
    (SocketServer as unknown as { instance: null }).instance = null;
  });

  afterEach(() => {
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
      const token = makeToken();
      const client = createClient({ token });

      client.on('connect', () => {
        expect(client.connected).toBe(true);
        done();
      });

      client.on('connect_error', done);
    });
  });

  describe('position:update', () => {
    it('recibe position:update tras conectarse', async () => {
      const token = makeToken();
      const client = createClient({ token });

      await new Promise<void>((resolve, reject) => {
        client.on('connect', resolve);
        client.on('connect_error', reject);
      });

      // Pequeña espera para que el join automático se procese
      await new Promise(r => setTimeout(r, 100));

      const socketServer = SocketServer.getInstance()!;
      const payload = {
        tripId: 'trip-1', routeId: 'route-1', driverId: 'driver-1',
        lat: -34.608, lng: -58.370, speed: 60,
        isDeviation: false, deviationMeters: null,
        distanceKm: 1.5, recordedAt: new Date().toISOString(),
      };

      const received = waitFor(client, SOCKET_EVENTS.POSITION_UPDATE);
      socketServer.emitPositionUpdate(payload);

      const data = await received;
      expect(data).toMatchObject({ tripId: 'trip-1', lat: -34.608 });
    });

    it('todos los clientes conectados reciben el update', async () => {
      const token1 = makeToken('user-1');
      const token2 = makeToken('user-2');

      const client1 = createClient({ token: token1 });
      const client2 = createClient({ token: token2 });

      await Promise.all([
        new Promise<void>(r => client1.on('connect', r)),
        new Promise<void>(r => client2.on('connect', r)),
      ]);

      await new Promise(r => setTimeout(r, 100));

      const socketServer = SocketServer.getInstance()!;
      const payload = {
        tripId: 't2', routeId: 'r2', driverId: 'd2',
        lat: -41.1, lng: -71.3, speed: 80,
        isDeviation: false, deviationMeters: null,
        distanceKm: 5, recordedAt: new Date().toISOString(),
      };

      const p1 = waitFor(client1, SOCKET_EVENTS.POSITION_UPDATE);
      const p2 = waitFor(client2, SOCKET_EVENTS.POSITION_UPDATE);
      socketServer.emitPositionUpdate(payload);

      const [data1, data2] = await Promise.all([p1, p2]);
      expect(data1).toMatchObject({ tripId: 't2' });
      expect(data2).toMatchObject({ tripId: 't2' });
    });
  });
});
