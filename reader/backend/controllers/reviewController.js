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
    const reviews = await Review.find({ book: req.params.id }).populate('user', 'name avatar');
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { addReview, getBookReviews };
