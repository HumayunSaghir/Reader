const express = require('express');
const { getBooks, searchBooks, getBookById, addBook, updateShelf, getUserShelves, removeShelf, liveSearch } = require('../controllers/bookController');
const { protect } = require('../middlewares/authMiddleware');
const router = express.Router();

router.get('/', getBooks);
router.get('/search', searchBooks);
router.get('/livesearch', liveSearch);
router.post('/', addBook);
router.get('/shelves', protect, getUserShelves);
router.get('/:id', getBookById);
router.post('/:id/shelf', protect, updateShelf);
router.delete('/:id/shelf', protect, removeShelf);

module.exports = router;
