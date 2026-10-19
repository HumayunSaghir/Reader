const express = require('express');
const { getClubs, getClubById, createClub, joinClub, updateProgress, sendMessage, deleteClub } = require('../controllers/bookClubController');
const { protect } = require('../middlewares/authMiddleware');
const router = express.Router();

// Clubs list members and their chat, so they're for signed-in users only
router.get('/', protect, getClubs);
router.get('/:id', protect, getClubById);
router.post('/', protect, createClub);
router.delete('/:id', protect, deleteClub);
router.post('/:id/join', protect, joinClub);
router.put('/:id/progress', protect, updateProgress);
router.post('/:id/messages', protect, sendMessage);

module.exports = router;
