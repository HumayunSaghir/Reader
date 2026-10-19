const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { coverCacheDir } = require('../config/env');

// Open Library covers redirect to archive.org, which unpacks each image from a
// zip on request: 5-20 seconds per cover. We fetch each cover once, keep it on
// disk, and serve it with immutable caching headers (ideal behind a CDN).
//
// Two lanes: covers a user is waiting for download immediately; background
// prefetching (warming popular lists) uses a small separate pool so it can
// never delay a real request.

const UPSTREAM = 'https://covers.openlibrary.org/b/id';
const UPSTREAM_TIMEOUT_MS = 30000;
const PREFETCH_CONCURRENCY = 3;
const PREFETCH_QUEUE_LIMIT = 2000;

fs.mkdirSync(coverCacheDir, { recursive: true });

const fileFor = (id, size) => path.join(coverCacheDir, `${id}-${size}.jpg`);
const missingMarker = (id, size) => path.join(coverCacheDir, `${id}-${size}.missing`);

const exists = (file) => fsp.access(file).then(() => true, () => false);

const download = async (id, size) => {
  // default=false makes Open Library answer 404 instead of a blank placeholder
  const res = await fetch(`${UPSTREAM}/${id}-${size}.jpg?default=false`, {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    redirect: 'follow'
  });
  if (res.status === 404) {
    await fsp.writeFile(missingMarker(id, size), '');
    return null;
  }
  if (!res.ok) throw new Error(`Cover upstream HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  // Write atomically so a crash never leaves a half-written image behind
  const tmp = `${fileFor(id, size)}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmp, buffer);
  await fsp.rename(tmp, fileFor(id, size));
  return buffer;
};

// Downloads currently in progress, shared by both lanes
const inflight = new Map();
const startDownload = (id, size) => {
  const key = `${id}-${size}`;
  if (!inflight.has(key)) {
    inflight.set(key, download(id, size).finally(() => inflight.delete(key)));
  }
  return inflight.get(key);
};

/**
 * Returns { file } for a cached cover, { buffer } when just downloaded,
 * or null when Open Library has no such cover.
 */
const getCover = async (id, size) => {
  const file = fileFor(id, size);
  if (await exists(file)) return { file };
  if (await exists(missingMarker(id, size))) return null;
  const buffer = await startDownload(id, size);
  return buffer ? { buffer } : null;
};

// ---- Background prefetch lane ----
const prefetchQueue = [];
const queued = new Set();
let prefetchWorkers = 0;

const runPrefetchWorker = async () => {
  prefetchWorkers++;
  try {
    while (prefetchQueue.length > 0) {
      const { id, size } = prefetchQueue.shift();
      queued.delete(`${id}-${size}`);
      try {
        if (await exists(fileFor(id, size)) || await exists(missingMarker(id, size))) continue;
        await startDownload(id, size);
      } catch {
        // Prefetch is best effort; a user request will retry on demand
      }
    }
  } finally {
    prefetchWorkers--;
  }
};

/** Warm the cache for a list of Open Library cover URLs (fire and forget). */
const prefetchCovers = (urls, size = 'M') => {
  for (const url of urls) {
    const match = /covers\.openlibrary\.org\/b\/id\/(\d+)-[SML]\.jpg/.exec(url || '');
    if (!match) continue;
    const key = `${match[1]}-${size}`;
    if (queued.has(key) || prefetchQueue.length >= PREFETCH_QUEUE_LIMIT) continue;
    queued.add(key);
    prefetchQueue.push({ id: match[1], size });
  }
  while (prefetchWorkers < PREFETCH_CONCURRENCY && prefetchQueue.length > 0) {
    runPrefetchWorker();
  }
};

module.exports = { getCover, prefetchCovers };
