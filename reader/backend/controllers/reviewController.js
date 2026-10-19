const { sendError } = require('../middlewares/errorHandler');
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Book = require('../models/Book');
const Activity = require('../models/Activity');
const ai = require('../services/ai');

const MAX_REVIEW_CHARS = 5000;
const MAX_REPLY_CHARS = 1000;

const isId = (id) => mongoose.isValidObjectId(id);

// Recompute a book's in-app rating from its reviews in the database
const refreshBookRating = async (bookId) => {
  const [stats] = await Review.aggregate([
    { $match: { book: new mongoose.Types.ObjectId(bookId) } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  await Book.updateOne({ _id: bookId }, {
    averageRating: stats ? Math.round(stats.avg * 10) / 10 : 0,
    ratingsCount: stats ? stats.count : 0
  });
};

// POST /api/books/:id/reviews — one review per user per book; posting again edits it
const addReview = async (req, res) => {
  const bookId = req.params.id;
  const rating = Number(req.body.rating);
  const reviewText = typeof req.body.reviewText === 'string' ? req.body.reviewText.trim() : '';

  try {
    if (!isId(bookId) || !(await Book.exists({ _id: bookId }))) {
      return res.status(404).json({ message: 'Book not found' });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be a whole number from 1 to 5' });
    }
    if (reviewText.length > MAX_REVIEW_CHARS) {
      return res.status(400).json({ message: `Reviews are limited to ${MAX_REVIEW_CHARS} characters` });
    }

    let review = await Review.findOne({ user: req.user._id, book: bookId });
    const isNew = !review;
    if (isNew) {
      review = new Review({ user: req.user._id, book: bookId });
    }
    review.rating = rating;
    review.reviewText = reviewText;
    await review.save();

    await refreshBookRating(bookId);
    if (isNew) {
      await Activity.create({ user: req.user._id, book: bookId, type: 'review', rating, reviewText });
    }

    res.status(isNew ? 201 : 200).json(review);
  } catch (error) {
    sendError(res, error);
  }
};

const getBookReviews = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: 'Book not found' });
    const reviews = await Review.find({ book: req.params.id })
      .populate('user', 'name avatar')
      .populate('likes', 'name avatar')
      .populate('replies.user', 'name avatar')
      .populate('replies.likes', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json(reviews);
  } catch (error) {
    sendError(res, error);
  }
};

const toggleLikeReview = async (req, res) => {
  try {
    if (!isId(req.params.reviewId)) return res.status(404).json({ message: 'Review not found' });
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    const index = review.likes.findIndex(id => id.equals(req.user._id));
    if (index > -1) review.likes.splice(index, 1);
    else review.likes.push(req.user._id);

    await review.save();
    res.json(review.likes);
  } catch (error) {
    sendError(res, error);
  }
};

const addReply = async (req, res) => {
  try {
    if (!isId(req.params.reviewId)) return res.status(404).json({ message: 'Review not found' });
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!text) return res.status(400).json({ message: 'Reply text is required' });
    if (text.length > MAX_REPLY_CHARS) {
      return res.status(400).json({ message: `Replies are limited to ${MAX_REPLY_CHARS} characters` });
    }

    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    const parentReplyId = req.body.parentReplyId && isId(req.body.parentReplyId) && review.replies.id(req.body.parentReplyId)
      ? req.body.parentReplyId
      : null;
    review.replies.push({ user: req.user._id, text, parentReplyId });
    await review.save();

    res.status(201).json(review.replies);
  } catch (error) {
    sendError(res, error);
  }
};

const toggleLikeReply = async (req, res) => {
  try {
    if (!isId(req.params.reviewId) || !isId(req.params.replyId)) return res.status(404).json({ message: 'Reply not found' });
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    const reply = review.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json({ message: 'Reply not found' });

    const index = reply.likes.findIndex(id => id.equals(req.user._id));
    if (index > -1) reply.likes.splice(index, 1);
    else reply.likes.push(req.user._id);

    await review.save();
    res.json(reply.likes);
  } catch (error) {
    sendError(res, error);
  }
};

const deleteReview = async (req, res) => {
  try {
    if (!isId(req.params.reviewId)) return res.status(404).json({ message: 'Review not found' });
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    if (!review.user.equals(req.user._id)) {
      return res.status(403).json({ message: 'You can only delete your own reviews' });
    }

    await review.deleteOne();
    await refreshBookRating(review.book);

    res.json({ message: 'Review removed' });
  } catch (error) {
    sendError(res, error);
  }
};

const deleteReply = async (req, res) => {
  try {
    if (!isId(req.params.reviewId) || !isId(req.params.replyId)) return res.status(404).json({ message: 'Reply not found' });
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    const reply = review.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json({ message: 'Reply not found' });

    if (!reply.user.equals(req.user._id)) {
      return res.status(403).json({ message: 'You can only delete your own replies' });
    }

    // Remove the reply and any replies nested under it
    const doomed = new Set([reply._id.toString()]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const r of review.replies) {
        if (r.parentReplyId && doomed.has(r.parentReplyId.toString()) && !doomed.has(r._id.toString())) {
          doomed.add(r._id.toString());
          grew = true;
        }
      }
    }
    review.replies = review.replies.filter(r => !doomed.has(r._id.toString()));
    await review.save();

    res.json({ message: 'Reply removed' });
  } catch (error) {
    sendError(res, error);
  }
};

// GET /api/books/:id/reviews/summary — AI summary, cached until the reviews change
const getReviewSummary = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: 'Book not found' });
    const book = await Book.findById(req.params.id).select('title author').lean();
    if (!book) return res.status(404).json({ message: 'Book not found' });

    const reviews = await Review.find({ book: req.params.id }).select('rating reviewText likes updatedAt').lean();
    if (reviews.length === 0) {
      return res.json({ summary: 'There are no reviews yet to summarize.' });
    }

    const summary = await ai.summarizeReviews(book, reviews);
    res.json({ summary });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = { addReview, getBookReviews, toggleLikeReview, addReply, toggleLikeReply, deleteReview, deleteReply, getReviewSummary };
