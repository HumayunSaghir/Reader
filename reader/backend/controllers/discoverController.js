const mongoose = require('mongoose');
const Book = require('../models/Book');
const Shelf = require('../models/Shelf');
const Activity = require('../models/Activity');
const BookTag = require('../models/BookTag');
const BookDismissal = require('../models/BookDismissal');
const catalog = require('../services/catalog');
const { sendError } = require('../middlewares/errorHandler');
const { parseTagList, getTopTagsForBooks, booksWithAllTagsPipeline } = require('./tagController');

const DEFAULT_QUERIES = ['fiction', 'fantasy', 'mystery', 'romance', 'thriller', 'science fiction', 'history', 'classics', 'adventure', 'horror'];

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const DECK_FIELDS = '_id title author coverImage genres publishedYear description';

// Books the user has already shelved or skipped never come back into the deck
const getExcludedBookIds = async (userId, clientExclude) => {
  const [shelved, dismissed] = await Promise.all([
    Shelf.distinct('book', { user: userId }),
    BookDismissal.distinct('book', { user: userId })
  ]);
  const ids = new Set([...shelved, ...dismissed].map(id => id.toString()));
  for (const id of clientExclude) ids.add(id);
  return [...ids].map(id => new mongoose.Types.ObjectId(id));
};

// GET /api/books/discover?category=fantasy&tags=found family&exclude=id1,id2&limit=20
const getDiscoverQueue = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 40);
    const tags = parseTagList(req.query.tags);
    const category = typeof req.query.category === 'string' && req.query.category !== 'All'
      ? req.query.category.trim().toLowerCase().slice(0, 40)
      : '';
    // Cards the client already has queued, so a refill doesn't repeat them
    const clientExclude = String(req.query.exclude || '')
      .split(',')
      .filter(id => mongoose.isValidObjectId(id))
      .slice(0, 200);

    const excludeIds = await getExcludedBookIds(req.user._id, clientExclude);
    const excludeSet = new Set(excludeIds.map(id => id.toString()));
    let books = [];

    if (tags.length > 0) {
      const rows = await BookTag.aggregate([
        ...booksWithAllTagsPipeline(tags, excludeIds),
        { $sample: { size: limit } }
      ]);
      books = await Book.find({ _id: { $in: rows.map(r => r._id) } }).select(DECK_FIELDS).lean();
    } else {
      const query = category || DEFAULT_QUERIES[Math.floor(Math.random() * DEFAULT_QUERIES.length)];
      const page = 1 + Math.floor(Math.random() * 2);
      try {
        const cards = (await catalog.browse(query, page)) || [];
        const ids = cards.filter(c => c.coverImage && !excludeSet.has(c._id.toString())).map(c => c._id);
        books = await Book.find({ _id: { $in: ids } }).select(DECK_FIELDS).lean();
      } catch (e) {
        // Providers unavailable; fall back to the local catalogue below
      }

      if (books.length < limit) {
        const match = {
          _id: { $nin: [...excludeIds, ...books.map(b => b._id)] },
          coverImage: { $type: 'string', $ne: '' }
        };
        if (category) {
          match.genres = { $regex: category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
        }
        const extra = await Book.aggregate([
          { $match: match },
          { $sample: { size: limit - books.length } },
          { $project: Object.fromEntries(DECK_FIELDS.split(' ').map(f => [f, 1])) }
        ]);
        books.push(...extra);
      }
    }

    books = shuffle(books).slice(0, limit);
    const topTags = await getTopTagsForBooks(books.map(b => b._id));
    res.json(books.map(b => ({ ...b, topTags: topTags[b._id.toString()] || [] })));
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/books/:id/swipe { direction: 'right' | 'left' }
const swipeBook = async (req, res) => {
  const { direction } = req.body;
  const bookId = req.params.id;
  const userId = req.user._id;

  if (direction !== 'right' && direction !== 'left') {
    return res.status(400).json({ message: "direction must be 'right' or 'left'" });
  }

  try {
    if (!mongoose.isValidObjectId(bookId) || !(await Book.exists({ _id: bookId }))) {
      return res.status(404).json({ message: 'Book not found' });
    }

    if (direction === 'left') {
      await BookDismissal.updateOne({ user: userId, book: bookId }, { $setOnInsert: { user: userId, book: bookId } }, { upsert: true });
      return res.json({ direction, added: false });
    }

    await BookDismissal.deleteOne({ user: userId, book: bookId });

    // Never downgrade a book the user is already reading or has read
    let shelf = await Shelf.findOne({ user: userId, book: bookId });
    if (shelf && shelf.status) {
      return res.json({ direction, added: false, status: shelf.status });
    }
    if (!shelf) shelf = new Shelf({ user: userId, book: bookId });
    shelf.status = 'want-to-read';
    await shelf.save();
    await Activity.create({ user: userId, book: bookId, type: 'shelf_status', status: 'want-to-read' });

    res.json({ direction, added: true, status: shelf.status });
  } catch (error) {
    sendError(res, error);
  }
};

// DELETE /api/books/:id/swipe?direction=right — undo the most recent swipe on this book.
// The client only undoes a right swipe when that swipe actually added the book.
const undoSwipe = async (req, res) => {
  const { direction } = req.query;
  const bookId = req.params.id;
  const userId = req.user._id;

  if (!mongoose.isValidObjectId(bookId)) {
    return res.status(404).json({ message: 'Book not found' });
  }

  try {
    if (direction === 'left') {
      await BookDismissal.deleteOne({ user: userId, book: bookId });
    } else if (direction === 'right') {
      const shelf = await Shelf.findOne({ user: userId, book: bookId });
      if (shelf && shelf.status === 'want-to-read') {
        if (shelf.customShelves.length === 0) {
          await Shelf.deleteOne({ _id: shelf._id });
        } else {
          shelf.status = undefined;
          await shelf.save();
        }
        const activity = await Activity.findOne({ user: userId, book: bookId, type: 'shelf_status', status: 'want-to-read' })
          .sort({ createdAt: -1 });
        if (activity) await activity.deleteOne();
      }
    } else {
      return res.status(400).json({ message: "direction must be 'right' or 'left'" });
    }
    res.json({ message: 'Swipe undone' });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = { getDiscoverQueue, swipeBook, undoSwipe };
