import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { runMigrations } from './config/migrations.js';
import { createApp } from './app.js';
import './models.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  await connectDatabase();
  await runMigrations();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`QueDesk API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    // Force exit if connections do not drain in time.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
