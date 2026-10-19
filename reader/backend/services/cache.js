const CacheEntry = require('../models/CacheEntry');

// Two-level cache: a small in-process LRU in front of a MongoDB collection, so
// hot keys skip the database and everything survives restarts / scales across
// instances. Entries have a "fresh" window and a longer "stale" window: stale
// values are served immediately while a refresh runs in the background.

const MEMORY_LIMIT = 500;
const memory = new Map(); // key -> { value, freshUntil, expiresAt }
const inflight = new Map(); // key -> Promise, so concurrent misses share one fetch

const remember = (key, entry) => {
  memory.delete(key);
  memory.set(key, entry);
  if (memory.size > MEMORY_LIMIT) {
    memory.delete(memory.keys().next().value);
  }
};

const read = async (key) => {
  const now = Date.now();
  const hot = memory.get(key);
  if (hot && hot.expiresAt > now) {
    remember(key, hot);
    return hot;
  }
  const doc = await CacheEntry.findOne({ key }).lean();
  if (!doc || doc.expiresAt.getTime() <= now) return null;
  const entry = { value: doc.value, freshUntil: doc.freshUntil.getTime(), expiresAt: doc.expiresAt.getTime() };
  remember(key, entry);
  return entry;
};

const write = async (key, value, { ttlSeconds, staleSeconds = 0 }) => {
  const now = Date.now();
  const entry = {
    value,
    freshUntil: now + ttlSeconds * 1000,
    expiresAt: now + (ttlSeconds + staleSeconds) * 1000
  };
  remember(key, entry);
  await CacheEntry.updateOne(
    { key },
    { $set: { value, freshUntil: new Date(entry.freshUntil), expiresAt: new Date(entry.expiresAt) } },
    { upsert: true }
  );
};

const refresh = (key, loader, options) => {
  if (inflight.has(key)) return inflight.get(key);
  const promise = (async () => {
    try {
      const value = await loader();
      if (value !== undefined) {
        await write(key, value, options).catch(err => console.error(`Cache write failed for ${key}:`, err.message));
      }
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise;
};

/**
 * Return the cached value for `key`, calling `loader` on a miss.
 * - ttlSeconds: how long a value counts as fresh
 * - staleSeconds: extra time a stale value may be served while refreshing in the background
 * A loader returning undefined is not cached.
 */
const getOrSet = async (key, loader, options) => {
  let entry = null;
  try {
    entry = await read(key);
  } catch (error) {
    console.error('Cache read failed:', error.message);
  }

  if (entry) {
    if (entry.freshUntil <= Date.now()) {
      refresh(key, loader, options).catch(err => console.error(`Background refresh failed for ${key}:`, err.message));
    }
    return entry.value;
  }
  return refresh(key, loader, options);
};

const invalidate = async (key) => {
  memory.delete(key);
  await CacheEntry.deleteOne({ key });
};

module.exports = { getOrSet, invalidate, read, write };
