import 'dotenv/config';
import http from 'http';
import { env } from './config/env';
import { createApp } from './app';
import { runMigrations } from './db/migrate';
import { closeDatabase } from './config/database';
import { closeRedis } from './config/redis';
import { SocketServer } from './socket/socket.server';

async function bootstrap(): Promise<void> {
  console.log('[boot] Starting GPS Monitor backend...');

  await runMigrations();
  console.log('[boot] Migrations complete');

  const app = createApp();
  const server = http.createServer(app);

  SocketServer.initialize(server, { corsOrigin: env.SOCKET_CORS_ORIGIN });
  console.log('[boot] Socket.io initialized');

  server.listen(env.PORT, () => {
    console.log(`[boot] Server running on port ${env.PORT} (${env.NODE_ENV})`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[boot] ${signal} received — shutting down gracefully`);
    server.close(async () => {
      await closeDatabase();
      await closeRedis();
      console.log('[boot] Shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[boot] Fatal error during startup:', err);
  process.exit(1);
});
