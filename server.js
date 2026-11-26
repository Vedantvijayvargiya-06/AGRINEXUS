import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  PORT,
  CORS_ALLOWED_ORIGINS,
  IS_PRODUCTION,
  RATE_LIMIT_API_PER_MINUTE
} from './server/config.js';
import { initStore } from './server/store.js';
import { HttpError, checkRateLimit } from './server/security.js';
import authRouter from './server/routes/auth.js';
import batchesRouter from './server/routes/batches.js';
import decisionsRouter from './server/routes/decisions.js';
import clustersRouter from './server/routes/clusters.js';
import marketRouter from './server/routes/market.js';
import assistRouter from './server/routes/assist.js';
import reportsRouter from './server/routes/reports.js';
import notificationsRouter from './server/routes/notifications.js';
import adminRouter from './server/routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createApp({ dbPath = null, serveFrontend = true } = {}) {
  initStore(dbPath);

  const app = express();
  app.set('trust proxy', 1);

  // Baseline security headers (iframe-compatible for preview & Netlify embeds)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), geolocation=()');
    next();
  });

  // Strict CORS allowlist (never wildcard '*' on authenticated endpoints)
  const allowedOriginsSet = new Set(CORS_ALLOWED_ORIGINS);
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      if (allowedOriginsSet.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      } else if (req.method === 'OPTIONS') {
        return res.status(403).json({ detail: 'Origin not allowed by CORS policy' });
      }
    }
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  app.use(express.json({ limit: '10mb' }));

  // General API rate limit
  app.use('/api', (req, res, next) => {
    if (req.path === '/health') return next();
    try {
      const clientIp = req.ip || 'unknown';
      checkRateLimit(`api:${clientIp}`, RATE_LIMIT_API_PER_MINUTE, 60);
      next();
    } catch (err) {
      next(err);
    }
  });

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'online',
      app: 'AgriNexus Decision Intelligence Service',
      version: '1.0.0',
      theme: 'Agriculture, FoodTech & Rural Development'
    });
  });

  // Feature API Routers
  app.use('/api/auth', authRouter);
  app.use('/api/batches', batchesRouter);
  app.use('/api/decisions', decisionsRouter);
  app.use('/api/clusters', clustersRouter);
  app.use('/api/market', marketRouter);
  app.use('/api/assist', assistRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/admin', adminRouter);

  // API 404 fallback
  app.use('/api', (req, res) => {
    res.status(404).json({ detail: 'API route not found' });
  });

  // Global API Error Handler
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ detail: err.detail });
    }
    if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
      return res.status(400).json({ detail: 'Invalid JSON request body' });
    }
    if (err && typeof err.message === 'string' && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ detail: 'Duplicate record violates uniqueness constraint' });
    }
    console.error('[AgriNexus Server Error]', err);
    return res.status(500).json({
      detail: IS_PRODUCTION ? 'Internal server error' : err?.message || 'Internal server error'
    });
  });

  if (serveFrontend) {
    const presentationFile = path.resolve(__dirname, 'frontend', 'presentation', 'index.html');
    if (fs.existsSync(presentationFile)) {
      app.get('/presentation', (req, res) => {
        res.sendFile(presentationFile);
      });
    }

    const distDir = path.resolve(__dirname, 'frontend', 'dist');
    if (!IS_PRODUCTION) {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        configFile: path.resolve(__dirname, 'frontend', 'vite.config.js'),
        server: { middlewareMode: true, hmr: false },
        appType: 'spa'
      });
      app.use(vite.middlewares);
    } else if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  return app;
}

const isDirectRun =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  createApp()
    .then((app) => {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`[AgriNexus] Server running at http://0.0.0.0:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('[AgriNexus] Failed to start server:', err);
      process.exit(1);
    });
}
