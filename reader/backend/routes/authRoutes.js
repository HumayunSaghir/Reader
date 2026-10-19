const express = require('express');
const { registerUser, loginUser, getGoogleConfig, googleLogin, getUserProfile, uploadPhoto, addCustomShelf, removeCustomShelf } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const { authLimiter } = require('../middlewares/rateLimits');
const router = express.Router();

router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
router.get('/google/config', getGoogleConfig);
router.post('/google', authLimiter, googleLogin);
router.get('/profile', protect, getUserProfile);
router.put('/profile/photo', protect, (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Images must be 2 MB or smaller' : (err.message || 'Failed to upload photo');
      return res.status(400).json({ message });
    }
    next();
  });
}, uploadPhoto);
router.post('/profile/shelves', protect, addCustomShelf);
router.delete('/profile/shelves/:shelfName', protect, removeCustomShelf);

module.exports = router;
