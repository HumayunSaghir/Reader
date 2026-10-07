const express = require('express');
const { addReview, getBookReviews } = require('../controllers/reviewController');
const { protect } = require('../middlewares/authMiddleware');
const router = express.Router({ mergeParams: true }); 

router.post('/', protect, addReview);
router.get('/', getBookReviews);

module.exports = router;
