const mongoose = require('mongoose');

const readingLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true }, // Format: 'YYYY-MM-DD'
  count: { type: Number, default: 1 },
  books: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }],
  notes: { type: String, default: '' }
}, { timestamps: true });

readingLogSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('ReadingLog', readingLogSchema);
