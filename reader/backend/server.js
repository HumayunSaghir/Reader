const env = require('./config/env');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { runMigrations } = require('./config/migrations');
const { apiLimiter, coverLimiter } = require('./middlewares/rateLimits');
const { errorHandler, notFound } = require('./middlewares/errorHandler');

const app = express();
app.disable('x-powered-by');
if (env.trustProxy) app.set('trust proxy', env.trustProxy);

// Security headers. Images and fonts come from book cover CDNs and Google Fonts,
// and /uploads is loaded cross-origin by the frontend when it's hosted separately.
// Without TLS (ALLOW_HTTP), upgrade-insecure-requests would make browsers fetch
// every asset over HTTPS and the page would load blank.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  strictTransportSecurity: !env.allowHttp,
  contentSecurityPolicy: {
    directives: {
      'img-src': ["'self'", 'data:', 'blob:', 'https:'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'connect-src': ["'self'", ...env.corsOrigins],
      'upgrade-insecure-requests': env.allowHttp ? null : []
    }
  }
}));
// Optional access log: LOG_REQUESTS=true
if (process.env.LOG_REQUESTS === 'true') {
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${res.getHeader('content-length') || '-'}B ${Date.now() - started}ms ua="${req.get('user-agent') || ''}" range="${req.get('range') || ''}"`);
    });
    next();
  });
}
app.use(compression());
app.use(cors(env.corsOrigins.length > 0 ? { origin: env.corsOrigins } : undefined));
app.use(express.json({ limit: '100kb' }));

// Uploaded avatars may be SVGs, which can embed scripts. Sandbox them so that
// opening one directly can't run code on the API's origin.
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d',
  setHeaders(res) {
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

app.get('/api/health', (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'up' : 'down', uptime: Math.round(process.uptime()) });
});

// Covers are mounted before the API rate limit: a page of books requests dozens
// of them, and they're served from disk or a CDN cache anyway
app.use('/api/covers', coverLimiter, require('./routes/coverRoutes'));

app.use('/api', apiLimiter);
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/books', require('./routes/bookRoutes'));
app.use('/api/books/:id/reviews', require('./routes/reviewRoutes'));
app.use('/api/activities', require('./routes/activityRoutes'));
app.use('/api/clubs', require('./routes/bookClubRoutes'));
app.use('/api/reading', require('./routes/readingLogRoutes'));
app.use('/api/tags', require('./routes/tagRoutes'));
app.use('/api', notFound);

// Optionally serve the built frontend from the same origin (single-service deploys)
if (env.frontendDist && fs.existsSync(path.join(env.frontendDist, 'index.html'))) {
  const dist = path.resolve(env.frontendDist);
  // Hashed assets never change, so browsers can cache them forever
  app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(dist, 'index.html'));
  });
  console.log(`Serving frontend from ${dist}`);
}

app.use(errorHandler);

const start = async () => {
  await connectDB();
  await runMigrations();
  const server = app.listen(env.port, () => console.log(`Server running on port ${env.port}`));
  if (process.env.DISABLE_WARMUP !== 'true') require('./services/catalog').startWarmup();

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    // Don't hang forever on open keep-alive connections
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
