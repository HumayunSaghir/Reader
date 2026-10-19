const express = require('express');
const {
  getBooks, searchBooks, getBookById, getBookDescription, addBook, updateShelf, getUserShelves,
  getMyShelfForBook, removeShelf, liveSearch, chatWithBook, getRecommendation
} = require('../controllers/bookController');
const { getDiscoverQueue, swipeBook, undoSwipe } = require('../controllers/discoverController');
const { getBookTags, addBookTag, removeBookTag } = require('../controllers/tagController');
const { protect, optionalAuth } = require('../middlewares/authMiddleware');
const { aiLimiter, externalSearchLimiter } = require('../middlewares/rateLimits');
const router = express.Router();

router.get('/', getBooks);
// Search is for signed-in members; it can call external book APIs, so it's also rate limited
router.get('/search', protect, externalSearchLimiter, searchBooks);
router.get('/livesearch', protect, liveSearch);
router.get('/discover', protect, getDiscoverQueue);
router.post('/', protect, addBook);
router.get('/shelves', protect, getUserShelves);
router.get('/:id', getBookById);
router.get('/:id/description', getBookDescription);
router.post('/:id/chat', protect, aiLimiter, chatWithBook);
router.get('/:id/recommendation', protect, aiLimiter, getRecommendation);
router.get('/:id/shelf', protect, getMyShelfForBook);
router.post('/:id/shelf', protect, updateShelf);
router.delete('/:id/shelf', protect, removeShelf);
router.post('/:id/swipe', protect, swipeBook);
router.delete('/:id/swipe', protect, undoSwipe);
router.get('/:id/tags', optionalAuth, getBookTags);
router.post('/:id/tags', protect, addBookTag);
router.delete('/:id/tags/:tag', protect, removeBookTag);

module.exports = router;
