const express = require('express');
const { searchTags, getBooksByTags } = require('../controllers/tagController');
const router = express.Router();

router.get('/', searchTags);
router.get('/books', getBooksByTags);

module.exports = router;
