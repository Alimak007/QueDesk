import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { apiLimiter } from './middlewares/rateLimiter.js';
import apiRoutes from './routes/index.js';
import { logger } from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Same-origin and non-browser requests have no Origin header.
        if (!origin || env.clientOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  if (!env.isTest) {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: (req) => req.url === '/api/health' },
        customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
        serializers: {
          req: (req) => ({ method: req.method, url: req.url }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
      }),
    );
  }

  app.use('/api', apiLimiter, apiRoutes);
  app.use('/api', notFoundHandler);

  // In production the API also serves the built React app.
  if (env.isProduction && fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1y', immutable: true }));
    app.get('/{*splat}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
