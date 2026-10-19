const cache = require('./cache');
const bookSource = require('./bookSource');
const { prefetchCovers } = require('./coverCache');

// Cached, provider-backed book lists shared by the browse, search and discover
// endpoints. Lists are stored as lightweight "cards" (no descriptions).

const BROWSE_PAGE_SIZE = 40;
const SEARCH_PAGE_SIZE = 24;
const BROWSE_TTL = { ttlSeconds: 6 * 3600, staleSeconds: 7 * 24 * 3600 };
const SEARCH_TTL = { ttlSeconds: 24 * 3600, staleSeconds: 7 * 24 * 3600 };

const toCard = (b) => ({
  _id: b._id,
  title: b.title,
  author: b.author,
  coverImage: b.coverImage || null,
  genres: b.genres || [],
  publishedYear: b.publishedYear || null,
  averageRating: b.averageRating || 0,
  ratingsCount: b.ratingsCount || 0
});

// Empty lists are almost always a transient provider problem: don't cache them
const nonEmpty = (list) => (list.length > 0 ? list : undefined);

/** Popular books for a category ('' = trending). Resolves to undefined if unavailable. */
const browse = (category, page) => cache.getOrSet(
  `browse:${category || 'trending'}:${page}`,
  async () => {
    const cards = (await bookSource.browseBooks(category, { limit: BROWSE_PAGE_SIZE, page })).map(toCard);
    prefetchCovers(cards.map(c => c.coverImage));
    return nonEmpty(cards);
  },
  BROWSE_TTL
);

/** Ranked search results. Resolves to undefined if nothing was found. */
const search = (query, page = 1) => cache.getOrSet(
  `search:${bookSource.normalize(query)}:${page}`,
  async () => {
    const cards = (await bookSource.searchBooks(query, { limit: SEARCH_PAGE_SIZE, page })).map(toCard);
    prefetchCovers(cards.slice(0, 12).map(c => c.coverImage));
    return nonEmpty(cards);
  },
  SEARCH_TTL
);

// Categories offered in the UI (Home genre pills + Discover)
const WARM_CATEGORIES = ['', 'fiction', 'fantasy', 'science fiction', 'mystery', 'thriller', 'romance',
  'history', 'biography', 'science', 'self-help', 'technology', 'classics', 'adventure', 'horror'];
const WARM_INTERVAL_MS = 5 * 3600 * 1000;

/**
 * Keep the popular lists (and their covers) fresh in the background so real
 * users never wait on Open Library. Runs sequentially to stay well inside
 * Open Library's rate limits.
 */
const startWarmup = () => {
  const run = async () => {
    const started = Date.now();
    let warmed = 0;
    for (const category of WARM_CATEGORIES) {
      for (const page of [1, 2]) {
        try {
          const cards = await browse(category, page);
          if (cards) {
            prefetchCovers(cards.map(c => c.coverImage));
            warmed++;
          }
        } catch (error) {
          console.error(`Warmup failed for ${category || 'trending'} p${page}:`, error.message);
        }
      }
    }
    console.log(`Catalog warmup: ${warmed} lists ready in ${Math.round((Date.now() - started) / 1000)}s`);
  };
  setTimeout(run, 5000).unref();
  setInterval(run, WARM_INTERVAL_MS).unref();
};

module.exports = { browse, search, toCard, startWarmup, BROWSE_PAGE_SIZE, SEARCH_PAGE_SIZE };
