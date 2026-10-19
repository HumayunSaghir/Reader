const express = require('express');
const { getActivities } = require('../controllers/activityController');
const { protect } = require('../middlewares/authMiddleware');
const router = express.Router();

// The feed shows members' names and reviews, so it's for signed-in users only
router.get('/', protect, getActivities);

module.exports = router;
