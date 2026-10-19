const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { gemini } = require('../config/env');

// In-memory stores are per process. When running several instances, plug in a
// shared store (e.g. rate-limit-redis) so limits apply across all of them.

const common = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down and try again shortly.' }
};

const userOrIp = (req) => (req.user ? `user:${req.user._id}` : ipKeyGenerator(req.ip));

// Whole API: generous ceiling against abuse and runaway clients
const apiLimiter = rateLimit({ ...common, windowMs: 60 * 1000, limit: 300 });

// Login / register: slow down credential stuffing
const authLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  message: { message: 'Too many sign-in attempts. Please wait a few minutes and try again.' }
});

// Endpoints that call paid AI APIs: capped per user (or per IP when anonymous)
const aiLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: gemini.hourlyLimit,
  keyGenerator: userOrIp,
  message: { message: 'You have reached the hourly AI limit. Please try again later.' }
});

// Endpoints that call external book providers
const externalSearchLimiter = rateLimit({ ...common, windowMs: 60 * 1000, limit: 40, keyGenerator: userOrIp });

// Cover images: pages load dozens at once, but random-id scraping is capped
const coverLimiter = rateLimit({ ...common, windowMs: 60 * 1000, limit: 600 });

module.exports = { apiLimiter, authLimiter, aiLimiter, externalSearchLimiter, coverLimiter };
