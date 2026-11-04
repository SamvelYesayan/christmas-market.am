import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config, isProd } from './config.js';
import { logger } from './lib/logger.js';
import { pool } from './db.js';
import { loadUser } from './middleware/auth.js';
import { localeMiddleware } from './i18n/index.js';
import { allowedOrigins, globalLimiter, originCheck } from './middleware/security.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import catalogRoutes from './routes/catalog.js';
import shopRoutes from './routes/shop.js';
import paymentRoutes from './routes/payments.js';
import pioneerRoutes from './routes/pioneer.js';
import academyRoutes from './routes/academy.js';
import adventRoutes from './routes/advent.js';
import gamesRoutes from './routes/games.js';
import contentRoutes from './routes/content.js';
import wishesRoutes from './routes/wishes.js';
import adminRoutes from './routes/admin/index.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.TRUST_PROXY) app.set('trust proxy', config.TRUST_PROXY);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        formAction: ["'self'", 'https://banking.idram.am'],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
  }));
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' }, customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info') }));
  // Keep the raw body for webhook signature verification (Stripe).
  app.use(express.json({ limit: '200kb', verify: (req, _res, buf) => { if (req.url.includes('/payments/')) req.rawBody = buf; } }));
  app.use(express.urlencoded({ extended: false, limit: '50kb' }));
  app.use(cookieParser());
  app.use(localeMiddleware);

  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.use('/uploads', express.static(path.resolve(config.UPLOAD_DIR), { maxAge: '30d', immutable: true, fallthrough: false }));

  const api = express.Router();
  api.use(globalLimiter);
  api.use(originCheck);
  api.use(loadUser);
  api.use((req, _res, next) => {
    const v = req.get('x-visitor-id');
    if (v && /^[a-zA-Z0-9-]{8,64}$/.test(v)) req.visitorId = v;
    next();
  });
  api.use('/auth', authRoutes);
  api.use('/me', meRoutes);
  api.use('/', catalogRoutes);
  api.use('/', shopRoutes);
  api.use('/payments', paymentRoutes);
  api.use('/pioneer', pioneerRoutes);
  api.use('/academy', academyRoutes);
  api.use('/advent', adventRoutes);
  api.use('/', gamesRoutes);
  api.use('/', contentRoutes);
  api.use('/', wishesRoutes);
  api.use('/admin', adminRoutes);
  api.use(notFoundHandler);
  app.use('/api/v1', api);

  // In production the API also serves the built client (single origin; SPA fallback).
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  if (isProd && fs.existsSync(dist)) {
    app.use(express.static(dist, { maxAge: '1y', index: false, setHeaders: (res, file) => { if (file.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); } }));
    app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
