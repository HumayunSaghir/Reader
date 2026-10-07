const Review = require('../models/Review');
const Book = require('../models/Book');

const addReview = async (req, res) => {
  const { rating, reviewText } = req.body;
  const bookId = req.params.id; // comes from merged params if we mount at /api/books/:id/reviews

  try {
    const review = await Review.create({
      user: req.user._id,
      book: bookId,
      rating,
      reviewText
    });

    // Update book ratings
    const reviews = await Review.find({ book: bookId });
    const avgRating = reviews.reduce((acc, item) => item.rating + acc, 0) / reviews.length;
    
    await Book.findByIdAndUpdate(bookId, { 
      averageRating: avgRating,
      ratingsCount: reviews.length
    });

    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getBookReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ book: req.params.id })
      .populate('user', 'name avatar')
      .populate('likes', 'name avatar')
      .populate('replies.user', 'name avatar')
      .populate('replies.likes', 'name avatar')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const toggleLikeReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    
    const index = review.likes.indexOf(req.user._id);
    if (index > -1) review.likes.splice(index, 1);
    else review.likes.push(req.user._id);
    
    await review.save();
    res.json(review.likes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addReply = async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    
    const reply = { user: req.user._id, text: req.body.text, parentReplyId: req.body.parentReplyId || null };
    review.replies.push(reply);
    await review.save();
    
    res.status(201).json(review.replies);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const toggleLikeReply = async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    
    const reply = review.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json({ message: 'Reply not found' });
    
    const index = reply.likes.indexOf(req.user._id);
    if (index > -1) reply.likes.splice(index, 1);
    else reply.likes.push(req.user._id);
    
    await review.save();
    res.json(reply.likes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    
    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'User not authorized' });
    }
    
    await review.deleteOne();
    
    // Update book ratings
    const reviews = await Review.find({ book: req.params.id });
    const avgRating = reviews.length > 0 ? reviews.reduce((acc, item) => item.rating + acc, 0) / reviews.length : 0;
    
    await Book.findByIdAndUpdate(req.params.id, { 
      averageRating: avgRating,
      ratingsCount: reviews.length
    });

    res.json({ message: 'Review removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteReply = async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    
    const reply = review.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json({ message: 'Reply not found' });
    
    if (reply.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'User not authorized' });
    }
    
    // cascade delete children if needed, but for now just remove the reply
    reply.deleteOne();
    await review.save();
    
    res.json({ message: 'Reply removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { addReview, getBookReviews, toggleLikeReview, addReply, toggleLikeReply, deleteReview, deleteReply };
