require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const PgSession = require('connect-pg-simple')(session);

const db = require('./database/db');
const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const asyncHandler = require('./middleware/async-handler');
const PostgresRateLimitStore = require('./middleware/postgres-rate-limit-store');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDirectory = path.join(__dirname, 'public');
const configuredSiteUrl = process.env.PUBLIC_SITE_URL
  ? new URL(process.env.PUBLIC_SITE_URL)
  : null;

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET tem de estar definida e ter pelo menos 32 caracteres.');
}
if (configuredSiteUrl && !['http:', 'https:'].includes(configuredSiteUrl.protocol)) {
  throw new Error('PUBLIC_SITE_URL tem de começar por http:// ou https://.');
}

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/v1', asyncHandler(async (req, res, next) => {
  await db.initDatabase();
  next();
}));
app.use('/api/v1', rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  store: new PostgresRateLimitStore('api'),
}));
app.use('/api/v1', session({
  name: 'bb.sid',
  secret: process.env.SESSION_SECRET,
  store: new PgSession({
    pool: db.getPool(),
    tableName: 'session',
    createTableIfMissing: false,
  }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8,
  },
}));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', publicRoutes);
app.use('/api/v1/admin', adminRoutes);

app.use((req, res, next) => {
  if ((req.method !== 'GET' && req.method !== 'HEAD') || !/^\/(?:[a-z0-9_-]+\.html)?$/i.test(req.path)) {
    return next();
  }

  const pagePath = req.path === '/' ? '/index.html' : req.path;
  const filePath = path.join(publicDirectory, pagePath.slice(1));

  fs.readFile(filePath, 'utf8', (error, html) => {
    if (error) {
      if (error.code === 'ENOENT') return next();
      return next(error);
    }

    try {
      const forwardedProtocol = req.get('x-forwarded-proto')?.split(',')[0].trim();
      const protocol = forwardedProtocol || req.protocol;
      if (!configuredSiteUrl && !['http', 'https'].includes(protocol)) {
        throw new Error('Não foi possível determinar o protocolo público do site.');
      }

      const origin = configuredSiteUrl
        ? configuredSiteUrl.origin
        : new URL(`${protocol}://${req.get('host')}`).origin;
      const pageUrl = new URL(req.path === '/' ? '/' : pagePath, origin).href;

      res.vary('X-Forwarded-Proto');
      res.type('html').send(
        html
          .replaceAll('__PUBLIC_ORIGIN__', origin)
          .replaceAll('__PAGE_URL__', pageUrl),
      );
    } catch (metadataError) {
      next(metadataError);
    }
  });
});

app.use(express.static(publicDirectory));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Bug Busters a correr em http://localhost:${PORT}`);
  });
}

module.exports = app;