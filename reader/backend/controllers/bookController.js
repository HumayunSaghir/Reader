const mongoose = require('mongoose');
const Book = require('../models/Book');
const Shelf = require('../models/Shelf');
const Activity = require('../models/Activity');
const Review = require('../models/Review');
const bookSource = require('../services/bookSource');
const catalog = require('../services/catalog');
const ai = require('../services/ai');
const { sendError, HttpError } = require('../middlewares/errorHandler');

// Fields needed to render book cards; descriptions are large and loaded on demand
const CARD_FIELDS = '_id title author coverImage genres publishedYear averageRating ratingsCount';
const SHELF_STATUSES = ['want-to-read', 'currently-reading', 'read'];

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const { toCard, BROWSE_PAGE_SIZE, SEARCH_PAGE_SIZE } = catalog;

const parsePage = (value) => Math.min(Math.max(parseInt(value, 10) || 1, 1), 50);

const assertBookId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Book not found');
};

// GET /api/books?category=fantasy&page=1 — popular books (trending when no category)
const getBooks = async (req, res) => {
  try {
    const category = typeof req.query.category === 'string' && req.query.category !== 'All'
      ? req.query.category.trim().toLowerCase().slice(0, 40)
      : '';
    const page = parsePage(req.query.page);

    let books;
    try {
      books = await catalog.browse(category, page);
      if (!books) throw new Error('No results from provider');
    } catch (error) {
      // Provider down and nothing cached: fall back to what we already have locally
      console.error('Browse provider failed:', error.message);
      const match = { coverImage: { $type: 'string' } };
      if (category) match.genres = { $regex: escapeRegex(category), $options: 'i' };
      books = (await Book.aggregate([{ $match: match }, { $sample: { size: BROWSE_PAGE_SIZE } }])).map(toCard);
    }

    res.set('Cache-Control', 'public, max-age=300');
    res.json(books);
  } catch (error) {
    sendError(res, error);
  }
};

// GET /api/books/search?query=homo deus&page=1
const searchBooks = async (req, res) => {
  try {
    const query = typeof req.query.query === 'string' ? req.query.query.trim().slice(0, 120) : '';
    if (!query) return res.status(400).json({ message: 'Query is required' });
    const page = parsePage(req.query.page);

    let books;
    try {
      books = await catalog.search(query, page);
      if (!books) throw new Error('No results from provider');
    } catch (error) {
      console.error('Search provider failed:', error.message);
      books = (await Book.find({ $text: { $search: query } }, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .skip((page - 1) * SEARCH_PAGE_SIZE)
        .limit(SEARCH_PAGE_SIZE)
        .select(CARD_FIELDS)
        .lean()).map(toCard);
    }

    res.set('Cache-Control', 'public, max-age=300');
    res.json(books);
  } catch (error) {
    sendError(res, error);
  }
};

const LIVE_EXTERNAL_WAIT_MS = 2500;

// GET /api/books/livesearch?query=atomic — fast typeahead from the local catalogue
const liveSearch = async (req, res) => {
  try {
    const query = typeof req.query.query === 'string' ? req.query.query.trim().slice(0, 80) : '';
    if (query.length < 2) return res.json([]);

    const findLocal = async () => {
      const [textHits, prefixHits] = await Promise.all([
        Book.find({ $text: { $search: query } }, { score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' } }).limit(10).select(CARD_FIELDS).lean().maxTimeMS(2000),
        Book.find({ title: { $regex: `^${escapeRegex(query)}`, $options: 'i' } })
          .limit(6).select(CARD_FIELDS).lean().maxTimeMS(2000)
      ]);
      const seen = new Set();
      return [...prefixHits, ...textHits].filter(b => !seen.has(b._id.toString()) && seen.add(b._id.toString()));
    };

    let books = await findLocal();

    // Few local matches: ask the providers (cached), but don't keep the user
    // waiting. A slow lookup finishes in the background and populates the
    // catalogue, so the next keystroke finds it locally.
    if (books.length < 4 && query.length >= 3) {
      const external = catalog.search(query, 1).then(r => r || []).catch(() => []);
      const result = await Promise.race([external, new Promise(r => setTimeout(() => r(null), LIVE_EXTERNAL_WAIT_MS))]);
      if (result) {
        const seen = new Set(books.map(b => b._id.toString()));
        books = [...books, ...result.filter(b => !seen.has(b._id.toString()))];
      }
    }

    // Prefer titles that start with the query, then titles containing it
    const q = query.toLowerCase();
    const rankOf = (b) => {
      const t = (b.title || '').toLowerCase();
      if (t.startsWith(q)) return 0;
      if (t.split(/\s+/).some(w => w.startsWith(q))) return 1;
      if (t.includes(q)) return 2;
      return 3;
    };
    books = books.map((b, i) => ({ b, i })).sort((x, y) => rankOf(x.b) - rankOf(y.b) || x.i - y.i).map(x => x.b);

    res.json(books.slice(0, 6).map(toCard));
  } catch (error) {
    sendError(res, error);
  }
};

// GET /api/books/:id — returns immediately; descriptions load via /:id/description
const getBookById = async (req, res) => {
  try {
    assertBookId(req.params.id);
    const book = await Book.findById(req.params.id).select('-__v').lean();
    if (!book) return res.status(404).json({ message: 'Book not found' });
    if (book.description && bookSource.LEGACY_PLACEHOLDER.test(book.description)) book.description = '';
    res.json(book);
  } catch (error) {
    sendError(res, error);
  }
};

// GET /api/books/:id/description — fetched from the providers once, then stored
const getBookDescription = async (req, res) => {
  try {
    assertBookId(req.params.id);
    const book = await Book.findById(req.params.id).select('title author isbn sourceKey editionKey description descriptionFetchedAt').lean();
    if (!book) return res.status(404).json({ message: 'Book not found' });
    const description = await bookSource.ensureDescription(book);
    res.json({ description: description || '' });
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/books — manually add a book (only whitelisted fields)
const addBook = async (req, res) => {
  try {
    const { title, author, description, coverImage, isbn, publishedYear, genres } = req.body;
    if (typeof title !== 'string' || !title.trim() || typeof author !== 'string' || !author.trim()) {
      return res.status(400).json({ message: 'Title and author are required' });
    }
    const book = await Book.create({
      title: title.trim().slice(0, 300),
      author: author.trim().slice(0, 200),
      description: typeof description === 'string' ? description.slice(0, 10000) : undefined,
      coverImage: typeof coverImage === 'string' && /^https:\/\//.test(coverImage) ? coverImage : undefined,
      isbn: typeof isbn === 'string' ? isbn.slice(0, 20) : undefined,
      publishedYear: Number.isInteger(publishedYear) ? publishedYear : undefined,
      genres: Array.isArray(genres) ? genres.filter(g => typeof g === 'string').slice(0, 10).map(g => g.slice(0, 40)) : []
    });
    res.status(201).json(book);
  } catch (error) {
    sendError(res, error);
  }
};

const updateShelf = async (req, res) => {
  const { status, customShelf, action } = req.body;
  const bookId = req.params.id;
  const userId = req.user._id;

  try {
    assertBookId(bookId);
    if (status !== undefined && status !== null && !SHELF_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid shelf status' });
    }
    if (customShelf !== undefined) {
      if (typeof customShelf !== 'string' || !['add', 'remove'].includes(action)) {
        return res.status(400).json({ message: 'Invalid custom shelf update' });
      }
      if (action === 'add' && !(req.user.customShelves || []).includes(customShelf)) {
        return res.status(400).json({ message: 'Create the shelf on your profile first' });
      }
    }
    if (!(await Book.exists({ _id: bookId }))) return res.status(404).json({ message: 'Book not found' });

    let shelf = await Shelf.findOne({ user: userId, book: bookId });
    if (!shelf) {
      shelf = new Shelf({ user: userId, book: bookId });
    }

    if (status !== undefined) {
      if (shelf.status !== status) {
        shelf.status = status || undefined;
        shelf.readAt = status === 'read' ? new Date() : null;
        if (status) {
          await Activity.create({ user: userId, book: bookId, type: 'shelf_status', status });
        }
      }
    }

    if (customShelf) {
      if (action === 'add') {
        if (!shelf.customShelves.includes(customShelf)) {
          shelf.customShelves.push(customShelf);
          await Activity.create({ user: userId, book: bookId, type: 'shelf_custom', customShelf });
        }
      } else {
        shelf.customShelves = shelf.customShelves.filter(s => s !== customShelf);
      }
    }

    if (!shelf.status && shelf.customShelves.length === 0) {
      if (!shelf.isNew) await Shelf.deleteOne({ _id: shelf._id });
      return res.json({ message: 'Removed from all shelves' });
    }

    await shelf.save();
    res.json(shelf);
  } catch (error) {
    sendError(res, error);
  }
};

const getUserShelves = async (req, res) => {
  try {
    const shelves = await Shelf.find({ user: req.user._id })
      .populate('book', `${CARD_FIELDS} pageCount`)
      .sort({ updatedAt: -1 })
      .lean();
    res.json(shelves.filter(s => s.book));
  } catch (error) {
    sendError(res, error);
  }
};

// GET /api/books/:id/shelf — the current user's shelf entry for one book
const getMyShelfForBook = async (req, res) => {
  try {
    assertBookId(req.params.id);
    const shelf = await Shelf.findOne({ user: req.user._id, book: req.params.id }).select('status customShelves readAt').lean();
    res.json(shelf || { status: null, customShelves: [] });
  } catch (error) {
    sendError(res, error);
  }
};

const removeShelf = async (req, res) => {
  try {
    assertBookId(req.params.id);
    await Shelf.findOneAndDelete({ user: req.user._id, book: req.params.id });
    res.json({ message: 'Book removed from shelf' });
  } catch (error) {
    sendError(res, error);
  }
};

const chatWithBook = async (req, res) => {
  try {
    assertBookId(req.params.id);
    const { message, history } = req.body;
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }
    if (message.length > ai.MAX_MESSAGE_CHARS) {
      return res.status(400).json({ message: `Messages are limited to ${ai.MAX_MESSAGE_CHARS} characters` });
    }
    const book = await Book.findById(req.params.id).lean();
    if (!book) return res.status(404).json({ message: 'Book not found' });
    book.description = await bookSource.ensureDescription(book).catch(() => book.description);

    const reply = await ai.chatAboutBook(book, message.trim(), history);
    res.json({ reply });
  } catch (error) {
    sendError(res, error);
  }
};

const getRecommendation = async (req, res) => {
  try {
    assertBookId(req.params.id);
    const book = await Book.findById(req.params.id).lean();
    if (!book) return res.status(404).json({ message: 'Book not found' });
    book.description = await bookSource.ensureDescription(book).catch(() => book.description);

    const favorites = await Review.find({ user: req.user._id, rating: 5, book: { $ne: book._id } })
      .sort({ updatedAt: -1 })
      .limit(20)
      .populate('book', 'title author')
      .lean();
    const favoriteTitles = favorites.filter(r => r.book).map(r => `${r.book.title} by ${r.book.author}`).sort();

    const recommendation = await ai.recommendBook(book, favoriteTitles);
    res.json({ recommendation });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  getBooks, searchBooks, getBookById, getBookDescription, addBook, updateShelf, getUserShelves,
  getMyShelfForBook, removeShelf, liveSearch, chatWithBook, getRecommendation, CARD_FIELDS, toCard
};
