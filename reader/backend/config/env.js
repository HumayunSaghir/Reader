const dotenv = require('dotenv');

dotenv.config({ quiet: true });

const isProduction = process.env.NODE_ENV === 'production';

// Fail fast on missing configuration instead of erroring on the first request
const required = ['MONGO_URI', 'JWT_SECRET'];
const missing = required.filter(name => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

if (isProduction && process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters in production.');
  process.exit(1);
}

const toInt = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

module.exports = {
  isProduction,
  port: toInt(process.env.PORT, 5000),
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  // Comma-separated list of allowed browser origins. Empty allows all (dev only).
  corsOrigins: (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean),
  // Number of reverse proxies in front of the app (for correct client IPs in rate limiting)
  trustProxy: toInt(process.env.TRUST_PROXY, 0),
  // Path to the built frontend; when set and present, the API also serves the SPA
  frontendDist: process.env.FRONTEND_DIST || '',
  // Where proxied book covers are cached on disk
  coverCacheDir: process.env.COVER_CACHE_DIR || require('path').join(__dirname, '..', 'cache', 'covers'),

  // Google OAuth "Web application" client ID. The apps fetch it from the API and Google
  // issues their ID tokens for it. Empty disables Google sign-in.
  googleClientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    // Per-user AI requests allowed per hour (chat + recommendations + summaries)
    hourlyLimit: toInt(process.env.AI_HOURLY_LIMIT, 30)
  },

  books: {
    googleApiKey: process.env.GOOGLE_BOOKS_API_KEY || '',
    // Open Library asks clients to identify themselves; identified clients get higher rate limits
    openLibraryUserAgent: process.env.OPEN_LIBRARY_USER_AGENT || 'ReaderApp/1.0',
    requestTimeoutMs: toInt(process.env.BOOK_API_TIMEOUT_MS, 8000)
  }
};
