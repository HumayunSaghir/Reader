const ReadingLog = require('../models/ReadingLog');
const Activity = require('../models/Activity');

// Helper to record reading action for a user on a given date (default today)
const recordReadingActivity = async (userId, bookId = null, count = 1, customDate = null) => {
  try {
    const today = customDate || new Date().toISOString().split('T')[0];
    const update = { $inc: { count: count } };
    if (bookId) {
      update.$addToSet = { books: bookId };
    }
    await ReadingLog.findOneAndUpdate(
      { user: userId, date: today },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    console.error('Failed to record reading activity:', error);
  }
};

// Calculate consecutive streaks from a set/map of active date strings 'YYYY-MM-DD'
const calculateStreaks = (dateMap, clientToday = null) => {
  const activeDates = new Set(Object.keys(dateMap).filter(d => dateMap[d] > 0));
  if (activeDates.size === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Parse all dates and sort in ascending order
  const sortedDates = Array.from(activeDates).sort();

  // Calculate longest streak
  let longestStreak = 0;
  let currentRun = 0;
  let prevDate = null;

  for (const dateStr of sortedDates) {
    const currentDate = new Date(dateStr + 'T00:00:00Z');
    if (!prevDate) {
      currentRun = 1;
    } else {
      const diffDays = Math.round((currentDate - prevDate) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentRun += 1;
      } else if (diffDays > 1) {
        currentRun = 1;
      }
    }
    if (currentRun > longestStreak) {
      longestStreak = currentRun;
    }
    prevDate = currentDate;
  }

  // Calculate current streak
  // Check if today or yesterday is logged
  const now = clientToday ? new Date(clientToday + 'T00:00:00Z') : new Date();
  const todayStr = clientToday || now.toISOString().split('T')[0];

  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

  let currentStreak = 0;
  let checkDate = new Date(now);

  if (activeDates.has(todayStr)) {
    // Today is active, count backwards from today
    checkDate = new Date(now);
  } else if (activeDates.has(yesterdayStr)) {
    // Yesterday was active, streak is still alive! Count backwards from yesterday
    checkDate = yesterdayDate;
  } else {
    // Neither today nor yesterday active -> streak is 0
    return { currentStreak: 0, longestStreak };
  }

  while (true) {
    const dStr = checkDate.toISOString().split('T')[0];
    if (activeDates.has(dStr)) {
      currentStreak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return { currentStreak, longestStreak };
};

// GET /api/reading/activity
const getReadingActivity = async (req, res) => {
  try {
    const userId = req.user._id;
    const clientToday = req.query.today || new Date().toISOString().split('T')[0];

    // 1. Fetch from ReadingLog (genuine reading sessions)
    const logs = await ReadingLog.find({ user: userId });
    const activityMap = {};

    logs.forEach(log => {
      activityMap[log.date] = (activityMap[log.date] || 0) + log.count;
    });

    // 2. Compute stats
    const { currentStreak, longestStreak } = calculateStreaks(activityMap, clientToday);
    const activeDates = Object.keys(activityMap).filter(d => activityMap[d] > 0);
    const totalDaysRead = activeDates.length;
    const totalActions = Object.values(activityMap).reduce((sum, count) => sum + count, 0);
    const todayLogged = Boolean(activityMap[clientToday] && activityMap[clientToday] > 0);

    res.json({
      activityMap,
      currentStreak,
      longestStreak,
      totalDaysRead,
      totalActions,
      todayLogged
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/reading/log
const logReadingToday = async (req, res) => {
  try {
    const userId = req.user._id;
    const { bookId, notes, date } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];

    await recordReadingActivity(userId, bookId, 1, targetDate);

    // Fetch and return updated activity
    const logs = await ReadingLog.find({ user: userId });
    const activityMap = {};
    logs.forEach(log => {
      activityMap[log.date] = (activityMap[log.date] || 0) + log.count;
    });

    const { currentStreak, longestStreak } = calculateStreaks(activityMap, targetDate);
    const totalDaysRead = Object.keys(activityMap).filter(d => activityMap[d] > 0).length;

    res.json({
      message: 'Reading session recorded!',
      activityMap,
      currentStreak,
      longestStreak,
      totalDaysRead,
      todayLogged: true
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  recordReadingActivity,
  getReadingActivity,
  logReadingToday
};
