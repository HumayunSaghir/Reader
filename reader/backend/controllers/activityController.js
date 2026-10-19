const { sendError } = require('../middlewares/errorHandler');
const Activity = require('../models/Activity');

const getActivities = async (req, res) => {
  try {
    const activities = await Activity.find()
      .populate('user', 'name avatar')
      .populate('book', 'title author coverImage')
      .sort({ createdAt: -1 })
      .limit(50);
      
    res.json(activities);
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = { getActivities };
