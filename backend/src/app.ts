import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { tenantMiddleware } from './tenant/tenant.middleware';
import { errorHandler } from './middleware/error-handler';
import agenciesRouter from './routes/agencies.routes';
import authRouter from './routes/auth.routes';
import routesRouter from './routes/routes.routes';
import tripsRouter from './routes/trips.routes';
import usersRouter from './routes/users.routes';

export function createApp(): express.Application {
  const app = express();

  // Security & parsing
  app.use(helmet());
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
  }));
  app.use(express.json());
  app.use(cookieParser());

  // Health check (no tenant required)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Public routes (no tenant middleware)
  app.use('/agencies', agenciesRouter);

  // Tenant-scoped routes
  app.use('/auth',   tenantMiddleware, authRouter);
  app.use('/routes', tenantMiddleware, routesRouter);
  app.use('/trips',  tenantMiddleware, tripsRouter);
  app.use('/users',  tenantMiddleware, usersRouter);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}
