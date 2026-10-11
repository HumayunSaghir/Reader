const mongoose = require('mongoose');

const readingChallengeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  year: { type: Number, required: true },
  target: { type: Number, required: true, default: 20, min: 1, max: 1000 }
}, { timestamps: true });

readingChallengeSchema.index({ user: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('ReadingChallenge', readingChallengeSchema);
