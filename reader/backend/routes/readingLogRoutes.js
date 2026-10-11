const express = require('express');
const { getReadingActivity, logReadingToday } = require('../controllers/readingLogController');
const { getChallengeData, setChallengeTarget } = require('../controllers/readingChallengeController');
const { protect } = require('../middlewares/authMiddleware');
const router = express.Router();

router.get('/activity', protect, getReadingActivity);
router.post('/log', protect, logReadingToday);

router.get('/challenge', protect, getChallengeData);
router.post('/challenge', protect, setChallengeTarget);

module.exports = router;
