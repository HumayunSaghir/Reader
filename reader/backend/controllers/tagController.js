const { sendError } = require('../middlewares/errorHandler');
const mongoose = require('mongoose');
const BookTag = require('../models/BookTag');
const Book = require('../models/Book');

const MAX_TAG_LENGTH = 40;
const MAX_TAGS_PER_USER_PER_BOOK = 10;
const MAX_FILTER_TAGS = 5;

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "  Found_Family!! " -> "found family". Returns null if nothing usable remains.
const normalizeTag = (raw) => {
  if (typeof raw !== 'string') return null;
  const tag = raw
    .toLowerCase()
    .replace(/[_]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s'&-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TAG_LENGTH)
    .trim();
  return tag.length >= 2 ? tag : null;
};

// Parse "a,b,c" from a query string into unique normalized tags
const parseTagList = (raw) => {
  if (!raw) return [];
  const tags = String(raw).split(',').map(normalizeTag).filter(Boolean);
  return [...new Set(tags)].slice(0, MAX_FILTER_TAGS);
};

// Tag counts for one book, flagging the ones the given user voted for
const getTagSummary = async (bookId, userId) => {
  const rows = await BookTag.aggregate([
    { $match: { book: new mongoose.Types.ObjectId(bookId) } },
    { $group: { _id: '$tag', count: { $sum: 1 }, users: { $push: '$user' } } },
    { $sort: { count: -1, _id: 1 } }
  ]);
  return rows.map(r => ({
    tag: r._id,
    count: r.count,
    mine: userId ? r.users.some(u => u.equals(userId)) : false
  }));
};

// Map of bookId -> its most-voted tags, for showing on cards
const getTopTagsForBooks = async (bookIds, perBook = 3) => {
  if (bookIds.length === 0) return {};
  const rows = await BookTag.aggregate([
    { $match: { book: { $in: bookIds.map(id => new mongoose.Types.ObjectId(id)) } } },
    { $group: { _id: { book: '$book', tag: '$tag' }, count: { $sum: 1 } } },
    { $sort: { count: -1, '_id.tag': 1 } },
    { $group: { _id: '$_id.book', tags: { $push: '$_id.tag' } } }
  ]);
  const result = {};
  for (const row of rows) {
    result[row._id.toString()] = row.tags.slice(0, perBook);
  }
  return result;
};

// Pipeline stages matching books that carry every tag in `tags`, most-voted first
const booksWithAllTagsPipeline = (tags, excludeIds = []) => {
  const match = { tag: { $in: tags } };
  if (excludeIds.length > 0) match.book = { $nin: excludeIds };
  return [
    { $match: match },
    { $group: { _id: { book: '$book', tag: '$tag' }, votes: { $sum: 1 } } },
    { $group: { _id: '$_id.book', matched: { $push: { tag: '$_id.tag', votes: '$votes' } }, totalVotes: { $sum: '$votes' } } },
    { $match: { [`matched.${tags.length - 1}`]: { $exists: true } } }
  ];
};

const getBookTags = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Book not found' });
    }
    res.json(await getTagSummary(req.params.id, req.user?._id));
  } catch (error) {
    sendError(res, error);
  }
};

const addBookTag = async (req, res) => {
  try {
    const bookId = req.params.id;
    const tag = normalizeTag(req.body.tag);
    if (!tag) {
      return res.status(400).json({ message: `Tags must be 2-${MAX_TAG_LENGTH} letters, numbers or spaces.` });
    }

    if (!mongoose.isValidObjectId(bookId) || !(await Book.exists({ _id: bookId }))) {
      return res.status(404).json({ message: 'Book not found' });
    }

    const existing = await BookTag.exists({ book: bookId, user: req.user._id, tag });
    if (!existing) {
      const userTagCount = await BookTag.countDocuments({ book: bookId, user: req.user._id });
      if (userTagCount >= MAX_TAGS_PER_USER_PER_BOOK) {
        return res.status(400).json({ message: `You can add up to ${MAX_TAGS_PER_USER_PER_BOOK} tags per book.` });
      }
      try {
        await BookTag.create({ book: bookId, user: req.user._id, tag });
      } catch (error) {
        // Ignore a duplicate from a double-submit; anything else is a real error
        if (error.code !== 11000) throw error;
      }
    }

    res.status(201).json(await getTagSummary(bookId, req.user._id));
  } catch (error) {
    sendError(res, error);
  }
};

const removeBookTag = async (req, res) => {
  try {
    const bookId = req.params.id;
    if (!mongoose.isValidObjectId(bookId)) {
      return res.status(404).json({ message: 'Book not found' });
    }
    const tag = normalizeTag(req.params.tag);
    if (tag) {
      await BookTag.deleteOne({ book: bookId, user: req.user._id, tag });
    }
    res.json(await getTagSummary(bookId, req.user._id));
  } catch (error) {
    sendError(res, error);
  }
};

// GET /api/tags?q=slow&limit=20 -> most-used tags, optionally filtered by text
const searchTags = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 30, 1), 100);
    const q = normalizeTag(req.query.q || '');

    const pipeline = [];
    if (q) pipeline.push({ $match: { tag: { $regex: escapeRegex(q) } } });
    pipeline.push(
      { $group: { _id: '$tag', books: { $addToSet: '$book' } } },
      { $project: { _id: 0, tag: '$_id', bookCount: { $size: '$books' } } },
      { $sort: { bookCount: -1, tag: 1 } },
      { $limit: limit }
    );

    const tags = await BookTag.aggregate(pipeline);

    // Prefix matches are what the user is most likely typing towards
    if (q) {
      tags.sort((a, b) => Number(b.tag.startsWith(q)) - Number(a.tag.startsWith(q)));
    }
    res.json(tags);
  } catch (error) {
    sendError(res, error);
  }
};

// GET /api/tags/books?tags=found family,slow burn&page=1 -> books having ALL tags
const getBooksByTags = async (req, res) => {
  try {
    const tags = parseTagList(req.query.tags);
    if (tags.length === 0) return res.json({ tags, books: [], hasMore: false });

    const limit = 24;
    const page = Math.max(parseInt(req.query.page) || 1, 1);

    const rows = await BookTag.aggregate([
      ...booksWithAllTagsPipeline(tags),
      { $sort: { totalVotes: -1, _id: 1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit + 1 }
    ]);

    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);
    const books = await Book.find({ _id: { $in: pageRows.map(r => r._id) } }).lean();
    const booksById = new Map(books.map(b => [b._id.toString(), b]));
    const topTags = await getTopTagsForBooks(pageRows.map(r => r._id), 4);

    const result = pageRows
      .map(r => {
        const book = booksById.get(r._id.toString());
        if (!book) return null;
        return { ...book, topTags: topTags[r._id.toString()] || [] };
      })
      .filter(Boolean);

    res.json({ tags, books: result, hasMore });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  normalizeTag,
  parseTagList,
  getTopTagsForBooks,
  booksWithAllTagsPipeline,
  getBookTags,
  addBookTag,
  removeBookTag,
  searchTags,
  getBooksByTags
};
