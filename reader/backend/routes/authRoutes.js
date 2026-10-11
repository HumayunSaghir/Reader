const express = require('express');
const { registerUser, loginUser, getUserProfile, uploadPhoto, addCustomShelf, removeCustomShelf } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile', protect, getUserProfile);
router.put('/profile/photo', protect, (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Failed to upload photo' });
    }
    next();
  });
}, uploadPhoto);
router.post('/profile/shelves', protect, addCustomShelf);
router.delete('/profile/shelves/:shelfName', protect, removeCustomShelf);

module.exports = router;
