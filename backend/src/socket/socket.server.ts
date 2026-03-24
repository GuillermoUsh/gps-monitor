import http from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload, PositionUpdatePayload, SocketData } from '../shared/types';
import { SOCKET_EVENTS } from './socket.events';

interface ServerToClientEvents {
  [SOCKET_EVENTS.POSITION_UPDATE]: (payload: PositionUpdatePayload) => void;
}

interface ClientToServerEvents {
  [SOCKET_EVENTS.JOIN_AGENCY]: (slug: string) => void;
}

interface InterServerEvents {
  // empty
}

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export class SocketServer {
  private static instance: SocketServer | null = null;
  private io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

  private constructor(
    httpServer: http.Server,
    options: { corsOrigin: string },
  ) {
    this.io = new Server(httpServer, {
      cors: {
        origin: (origin, callback) => {
          if (!origin) return callback(null, true);
          const allowed =
            /^https?:\/\/([a-z0-9-]+\.)?localhost(:\d+)?$/.test(origin) ||
            /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin) ||
            /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(origin) ||
            /^https:\/\/[a-z0-9-]+\.loca\.lt$/.test(origin) ||
            /^https:\/\/[a-z0-9-]+\.up\.railway\.app$/.test(origin) ||
            origin === options.corsOrigin;
          callback(allowed ? null : new Error('Not allowed by CORS'), allowed);
        },
        credentials: true,
      },
    });

    this.setupMiddleware();
    this.setupHandlers();
  }

  static initialize(
    httpServer: http.Server,
    options: { corsOrigin: string },
  ): SocketServer {
    if (!SocketServer.instance) {
      SocketServer.instance = new SocketServer(httpServer, options);
    }
    return SocketServer.instance;
  }

  static getInstance(): SocketServer | null {
    return SocketServer.instance;
  }

  private setupMiddleware(): void {
    this.io.use((socket: TypedSocket, next: (err?: Error) => void) => {
      const token = socket.handshake.auth?.token as string | undefined;

      if (!token) {
        return next(new Error(SOCKET_EVENTS.AUTH_ERROR));
      }

      try {
        const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
        const slug = payload.tenantSchema.replace('agency_', '');
        socket.data = {
          userId:       payload.sub,
          tenantSchema: payload.tenantSchema,
          slug,
          role:         payload.role,
        };
        next();
      } catch {
        next(new Error(SOCKET_EVENTS.AUTH_ERROR));
      }
    });
  }

  private setupHandlers(): void {
    this.io.on('connection', (socket: TypedSocket) => {
      socket.on(SOCKET_EVENTS.JOIN_AGENCY, (slug: string) => {
        if (slug !== socket.data.slug) return;
        void socket.join(`agency:${slug}`);
      });
    });
  }

  emitPositionUpdate(slug: string, payload: PositionUpdatePayload): void {
    this.io.to(`agency:${slug}`).emit(SOCKET_EVENTS.POSITION_UPDATE, payload);
  }
}
