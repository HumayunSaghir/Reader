const express = require('express');
const { registerUser, loginUser, getUserProfile, uploadPhoto, addCustomShelf, removeCustomShelf } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile', protect, getUserProfile);
router.put('/profile/photo', protect, upload.single('photo'), uploadPhoto);
router.post('/profile/shelves', protect, addCustomShelf);
router.delete('/profile/shelves/:shelfName', protect, removeCustomShelf);

module.exports = router;
