const express = require('express');
const { getBooks, searchBooks, getBookById, addBook, updateShelf, getUserShelves, removeShelf, liveSearch, chatWithBook, getRecommendation } = require('../controllers/bookController');
const { protect } = require('../middlewares/authMiddleware');
const router = express.Router();

router.get('/', getBooks);
router.get('/search', searchBooks);
router.get('/livesearch', liveSearch);
router.post('/', addBook);
router.get('/shelves', protect, getUserShelves);
router.get('/:id', getBookById);
router.post('/:id/chat', protect, chatWithBook);
router.get('/:id/recommendation', protect, getRecommendation);
router.post('/:id/shelf', protect, updateShelf);
router.delete('/:id/shelf', protect, removeShelf);

module.exports = router;
