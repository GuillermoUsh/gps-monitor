import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { errorHandler } from './middleware/error-handler';
import authRouter from './routes/auth.routes';
import routesRouter from './routes/routes.routes';
import tripsRouter from './routes/trips.routes';
import usersRouter from './routes/users.routes';
import fleetRouter from './routes/fleet.routes';

export function createApp(): express.Application {
  const app = express();

  // Security & parsing
  app.use(helmet({
    contentSecurityPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed =
        /^https?:\/\/([a-z0-9-]+\.)?localhost(:\d+)?$/.test(origin) ||
        /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin) ||
        /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(origin) ||
        /^https:\/\/[a-z0-9-]+\.loca\.lt$/.test(origin) ||
        /^https:\/\/[a-z0-9-]+\.up\.railway\.app$/.test(origin) ||
        origin === (process.env.CORS_ORIGIN ?? 'http://localhost:4200');
      callback(allowed ? null : new Error('Not allowed by CORS'), allowed);
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'bypass-tunnel-reminder'],
  }));
  app.use(express.json());
  app.use(cookieParser());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/auth',   authRouter);
  app.use('/routes', routesRouter);
  app.use('/trips',  tripsRouter);
  app.use('/users',  usersRouter);
  app.use('/fleet',  fleetRouter);

  // Global error handler (must be before static fallback)
  app.use(errorHandler);

  // Serve Angular frontend (production only)
  const publicDir = path.join(__dirname, '../public');
  // Service worker and manifest must never be cached so browsers pick up new deploys
  app.get('/ngsw-worker.js', (_req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(publicDir, 'ngsw-worker.js'));
  });
  app.get('/ngsw.json', (_req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(publicDir, 'ngsw.json'));
  });
  app.use(express.static(publicDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}
