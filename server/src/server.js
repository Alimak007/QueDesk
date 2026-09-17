import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase, explainConnectionError } from './config/db.js';
import { runMigrations } from './config/migrations.js';
import { createApp } from './app.js';
import './models.js';
import { logger } from './utils/logger.js';

const RETRY_DELAY_MS = 15_000;

/**
 * Connects and runs the pending migrations. The API starts either way: a
 * database that is unreachable at boot (a paused cluster, an IP that has not
 * been allow-listed yet, a laptop that is offline) should not stop the server,
 * because it usually comes back without anyone touching the code.
 */
async function startDatabase() {
  try {
    await connectDatabase();
    await runMigrations();
    return true;
  } catch (err) {
    logger.error({ err }, `Database unavailable — ${explainConnectionError(err)}`);
    logger.warn(`The API is running, but every request needing data will answer 503. Retrying every ${RETRY_DELAY_MS / 1000}s.`);
    return false;
  }
}

function retryDatabase() {
  const timer = setInterval(async () => {
    if (await startDatabase()) {
      clearInterval(timer);
      logger.info('Database reached; the API is fully available');
    }
  }, RETRY_DELAY_MS);
  timer.unref();
}

async function bootstrap() {
  const connected = await startDatabase();
  if (!connected) retryDatabase();

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
