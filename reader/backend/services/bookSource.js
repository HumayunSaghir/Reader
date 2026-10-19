const Book = require('../models/Book');
const { books: config } = require('../config/env');

// Book data comes from Open Library (free, no key, huge catalogue) and, when a
// GOOGLE_BOOKS_API_KEY is configured, Google Books (better descriptions and
// coverage of recent bestsellers). Results from both are merged, re-ranked and
// upserted into MongoDB in one bulk write.

const OPEN_LIBRARY = 'https://openlibrary.org';
const GOOGLE_BOOKS = 'https://www.googleapis.com/books/v1/volumes';

// With lang=en, the editions.* fields describe the best English edition, which
// fixes works catalogued under a translated title (e.g. "Homo Deus" is stored
// under its original Hebrew title).
const OL_SEARCH_FIELDS = [
  'key', 'title', 'author_name', 'cover_i', 'first_publish_year', 'subject',
  'edition_count', 'number_of_pages_median', 'ratings_count',
  'editions', 'editions.key', 'editions.title', 'editions.cover_i', 'editions.isbn'
].join(',');

const GOOGLE_FIELDS = 'items(id,volumeInfo(title,authors,publishedDate,description,industryIdentifiers,pageCount,categories,imageLinks,ratingsCount))';

// Titles that are almost never what someone searching for a book wants
const LOW_VALUE_TITLE = /\b(summary|study guide|workbook|journal|notebook|analysis of|sparknotes|cliffsnotes|box set|collection set|summaries|publishing|tracker|planner|coloring book|resumen)\b/i;

// ---------------------------------------------------------------------------
// HTTP with timeout, retry and a throttle for Open Library's rate limit

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Open Library resets connections from clients making more than ~3 req/s
const OL_MIN_INTERVAL_MS = 350;
let olQueue = Promise.resolve();
let olLastCall = 0;
const throttleOpenLibrary = (fn) => {
  const run = olQueue.then(async () => {
    const wait = olLastCall + OL_MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    olLastCall = Date.now();
  });
  olQueue = run.catch(() => {});
  return run.then(fn);
};

const fetchJson = async (url, { retries = 1, headers = {} } = {}) => {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', ...headers },
        signal: AbortSignal.timeout(config.requestTimeoutMs)
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      if (attempt >= retries) throw error;
      await sleep(500 * (attempt + 1));
    }
  }
};

const fetchOpenLibrary = (path, params = {}) => {
  const qs = new URLSearchParams(params).toString();
  const url = `${OPEN_LIBRARY}${path}${qs ? `?${qs}` : ''}`;
  return throttleOpenLibrary(() => fetchJson(url, { headers: { 'User-Agent': config.openLibraryUserAgent } }));
};

// ---------------------------------------------------------------------------
// Normalisation

const normalize = (str) => (str || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

// "Homo Deus: A Brief History of Tomorrow" -> "homo deus"
const mainTitle = (title) => normalize((title || '').split(/[:(\[]/)[0]);

const lastName = (author) => {
  const parts = normalize((author || '').split(',')[0]).split(' ');
  return parts[parts.length - 1] || '';
};

const dedupeKey = (book) => `${mainTitle(book.title)}|${lastName(book.author)}`;

const cleanGenres = (subjects = []) => {
  const seen = new Set();
  const genres = [];
  for (const raw of subjects) {
    if (typeof raw !== 'string') continue;
    const s = raw.trim();
    if (s.length < 3 || s.length > 30 || !/^[A-Za-z][A-Za-z &'-]+$/.test(s)) continue;
    const label = s.replace(/\b\w/g, c => c.toUpperCase());
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    genres.push(label);
    if (genres.length >= 5) break;
  }
  return genres;
};

const pickIsbn = (isbns = []) => isbns.find(i => i.length === 13) || isbns[0] || null;

// ---------------------------------------------------------------------------
// Provider mappers -> common candidate shape

const fromOpenLibrary = (doc) => {
  if (!doc || !doc.key || !doc.title) return null;
  const edition = doc.editions?.docs?.[0] || {};
  const authors = doc.author_name || [];
  if (authors.length === 0) return null;
  const coverId = edition.cover_i || doc.cover_i;
  return {
    sourceKey: `ol:${doc.key}`,
    editionKey: edition.key || null,
    title: edition.title || doc.title,
    author: authors.slice(0, 3).join(', '),
    coverImage: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null,
    isbn: pickIsbn(edition.isbn),
    publishedYear: doc.first_publish_year || null,
    genres: cleanGenres(doc.subject),
    editionCount: doc.edition_count || 0,
    pageCount: doc.number_of_pages_median || null,
    externalRatings: doc.ratings_count || 0,
    description: null
  };
};

const fromGoogle = (item) => {
  const v = item?.volumeInfo;
  if (!v || !v.title || !v.authors?.length) return null;
  const ids = v.industryIdentifiers || [];
  const isbn = ids.find(i => i.type === 'ISBN_13')?.identifier || ids.find(i => i.type === 'ISBN_10')?.identifier || null;
  const thumb = v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail;
  return {
    sourceKey: `gb:${item.id}`,
    editionKey: null,
    title: v.title,
    author: v.authors.slice(0, 3).join(', '),
    coverImage: thumb ? thumb.replace(/^http:/, 'https:').replace('&edge=curl', '') : null,
    isbn,
    publishedYear: parseInt((v.publishedDate || '').slice(0, 4), 10) || null,
    genres: cleanGenres(v.categories),
    editionCount: 0,
    pageCount: v.pageCount || null,
    externalRatings: v.ratingsCount || 0,
    description: v.description || null
  };
};

// ---------------------------------------------------------------------------
// Provider calls

const searchOpenLibrary = async ({ q, limit = 20, page = 1, sort }) => {
  const params = { q, fields: OL_SEARCH_FIELDS, limit, page, lang: 'en' };
  if (sort) params.sort = sort;
  const data = await fetchOpenLibrary('/search.json', params);
  return (data?.docs || []).map(fromOpenLibrary).filter(Boolean).map((c, i, all) => ({ ...c, providerRank: 1 - i / all.length }));
};

const searchGoogle = async ({ q, limit = 20 }) => {
  if (!config.googleApiKey) return [];
  const params = new URLSearchParams({
    q, maxResults: String(Math.min(limit, 40)), printType: 'books', langRestrict: 'en',
    fields: GOOGLE_FIELDS, key: config.googleApiKey
  });
  const data = await fetchJson(`${GOOGLE_BOOKS}?${params}`);
  return (data?.items || []).map(fromGoogle).filter(Boolean).map((c, i, all) => ({ ...c, providerRank: 1 - i / all.length }));
};

const trendingOpenLibrary = async ({ limit = 40, page = 1 }) => {
  const data = await fetchOpenLibrary('/trending/weekly.json', { limit, page });
  return (data?.works || []).map(fromOpenLibrary).filter(Boolean);
};

// ---------------------------------------------------------------------------
// Merge + rank

const mergeCandidates = (lists) => {
  const merged = new Map();
  for (const list of lists) {
    for (const c of list) {
      const key = dedupeKey(c);
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { ...c });
        continue;
      }
      // Keep the first (preferred) source; fill gaps from the other one
      for (const field of ['coverImage', 'isbn', 'publishedYear', 'pageCount', 'description']) {
        if (!existing[field] && c[field]) existing[field] = c[field];
      }
      if (existing.genres.length === 0) existing.genres = c.genres;
      existing.editionCount = Math.max(existing.editionCount, c.editionCount);
      existing.externalRatings = Math.max(existing.externalRatings, c.externalRatings);
      existing.providerRank = Math.max(existing.providerRank || 0, c.providerRank || 0);
    }
  }
  return [...merged.values()];
};

const popularity = (c) => Math.log10(1 + c.editionCount) * 20 + Math.log10(1 + c.externalRatings) * 6;

// The providers' own ordering is the strongest relevance signal (it knows
// aliases like "1984" -> "Nineteen Eighty-Four"); these adjust it.
const relevance = (c, query) => {
  const q = normalize(query);
  const tokens = q.split(' ').filter(Boolean);
  const title = normalize(c.title);
  const main = mainTitle(c.title);
  const author = normalize(c.author);

  let score = 60 * (c.providerRank || 0);
  if (main === q || title === q) score += 30;
  else if (tokens.length && tokens.every(t => title.includes(t))) score += 15;

  // Searching an author's name should surface that author's books
  if (tokens.length && tokens.every(t => author.includes(t))) score += 40;

  // Summaries, workbooks and knock-offs (sometimes disguised in the author field)
  if ((LOW_VALUE_TITLE.test(c.title) || LOW_VALUE_TITLE.test(c.author)) && !LOW_VALUE_TITLE.test(query)) score -= 150;
  return score;
};

const rank = (candidates, query) => {
  const scored = candidates.map(c => ({
    c,
    score: (query ? relevance(c, query) : 0) + popularity(c) + (c.coverImage ? 10 : 0)
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.c);
};

// ---------------------------------------------------------------------------
// Persistence

const persist = async (candidates) => {
  if (candidates.length === 0) return [];
  const now = new Date();

  const ops = candidates.map(c => ({
    updateOne: {
      filter: { sourceKey: c.sourceKey },
      update: {
        $set: {
          title: c.title,
          author: c.author,
          coverImage: c.coverImage,
          isbn: c.isbn,
          publishedYear: c.publishedYear,
          genres: c.genres,
          editionCount: c.editionCount,
          pageCount: c.pageCount,
          editionKey: c.editionKey
        },
        $setOnInsert: { sourceKey: c.sourceKey }
      },
      upsert: true
    }
  }));

  // Only fill in descriptions that are missing; never overwrite a real one
  for (const c of candidates) {
    if (!c.description) continue;
    ops.push({
      updateOne: {
        filter: { sourceKey: c.sourceKey, $or: [{ description: { $in: [null, ''] } }, { description: { $exists: false } }] },
        update: { $set: { description: c.description, descriptionFetchedAt: now } }
      }
    });
  }

  await Book.bulkWrite(ops, { ordered: false });
  const docs = await Book.find({ sourceKey: { $in: candidates.map(c => c.sourceKey) } }).lean();
  const byKey = new Map(docs.map(d => [d.sourceKey, d]));
  return candidates.map(c => byKey.get(c.sourceKey)).filter(Boolean);
};

// ---------------------------------------------------------------------------
// Public API

/** Search both providers, merge, rank by relevance + popularity, persist. */
const searchBooks = async (query, { limit = 20, page = 1 } = {}) => {
  const [ol, gb] = await Promise.allSettled([
    searchOpenLibrary({ q: query, limit: Math.max(limit, 30), page }),
    page === 1 ? searchGoogle({ q: query, limit }) : Promise.resolve([])
  ]);
  if (ol.status === 'rejected') console.error('Open Library search failed:', ol.reason?.message);
  if (gb.status === 'rejected') console.error('Google Books search failed:', gb.reason?.message);
  const lists = [ol.value || [], gb.value || []];
  // Open Library is the primary source: if it failed and Google had nothing,
  // report failure rather than an empty (and cacheable) result
  if (ol.status === 'rejected' && lists[1].length === 0) {
    throw new Error(`Book providers unavailable: ${ol.reason?.message}`);
  }
  const ranked = rank(mergeCandidates(lists), query).slice(0, limit);
  return persist(ranked);
};

/** Popular books for a category ("All" = trending this week). */
const browseBooks = async (category, { limit = 40, page = 1 } = {}) => {
  let candidates;
  if (!category) {
    candidates = await trendingOpenLibrary({ limit, page });
  } else {
    candidates = await searchOpenLibrary({ q: `subject:"${category.replace(/"/g, '')}"`, limit, page, sort: 'rating' });
  }
  // Browsing is visual: skip books without covers
  return persist(candidates.filter(c => c.coverImage));
};

const LEGACY_PLACEHOLDER = /^(No description provided\.|A fascinating book titled .* A highly recommended read that delves into intriguing concepts and stories\.)$/s;
const DESCRIPTION_RETRY_MS = 30 * 24 * 60 * 60 * 1000;

const descriptionInflight = new Map();

const fetchDescription = async (book) => {
  const textOf = (record) => (typeof record?.description === 'string' ? record.description : record?.description?.value);
  // The English edition first: works are sometimes catalogued in their original language
  if (book.editionKey) {
    const desc = textOf(await fetchOpenLibrary(`${book.editionKey}.json`));
    if (desc) return desc;
  }
  if (book.sourceKey?.startsWith('ol:') || book.isbn?.startsWith('/works/')) {
    const workKey = book.sourceKey ? book.sourceKey.slice(3) : book.isbn;
    const desc = textOf(await fetchOpenLibrary(`${workKey}.json`));
    if (desc) return desc;
  }
  if (config.googleApiKey) {
    const q = book.isbn && /^\d{10,13}$/.test(book.isbn) ? `isbn:${book.isbn}` : `intitle:${mainTitle(book.title)} inauthor:${lastName(book.author)}`;
    const params = new URLSearchParams({ q, maxResults: '1', fields: 'items(volumeInfo(description))', key: config.googleApiKey });
    const data = await fetchJson(`${GOOGLE_BOOKS}?${params}`);
    const desc = data?.items?.[0]?.volumeInfo?.description;
    if (desc) return desc;
  }
  return '';
};

/**
 * Make sure a book has a description, fetching it once from the providers.
 * Books with no description anywhere are retried at most every 30 days.
 */
const ensureDescription = async (book) => {
  const hasReal = book.description && !LEGACY_PLACEHOLDER.test(book.description);
  if (hasReal) return book.description;
  if (book.descriptionFetchedAt && Date.now() - new Date(book.descriptionFetchedAt).getTime() < DESCRIPTION_RETRY_MS) {
    return '';
  }

  const id = book._id.toString();
  if (!descriptionInflight.has(id)) {
    descriptionInflight.set(id, (async () => {
      try {
        let description;
        try {
          description = await fetchDescription(book);
        } catch (error) {
          // Provider down or timed out: don't record a miss, so the next view retries
          console.error(`Description fetch failed for ${id}:`, error.message);
          return '';
        }
        await Book.updateOne({ _id: book._id }, { $set: { description, descriptionFetchedAt: new Date() } });
        return description;
      } finally {
        descriptionInflight.delete(id);
      }
    })());
  }
  return descriptionInflight.get(id);
};

module.exports = { searchBooks, browseBooks, ensureDescription, normalize, LEGACY_PLACEHOLDER };
