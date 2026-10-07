const express = require('express');
const { addReview, getBookReviews, toggleLikeReview, addReply, toggleLikeReply, deleteReview, deleteReply } = require('../controllers/reviewController');
const { protect } = require('../middlewares/authMiddleware');
const router = express.Router({ mergeParams: true }); 

router.post('/', protect, addReview);
router.get('/', getBookReviews);
router.put('/:reviewId/like', protect, toggleLikeReview);
router.post('/:reviewId/replies', protect, addReply);
router.put('/:reviewId/replies/:replyId/like', protect, toggleLikeReply);
router.delete('/:reviewId', protect, deleteReview);
router.delete('/:reviewId/replies/:replyId', protect, deleteReply);

module.exports = router;
