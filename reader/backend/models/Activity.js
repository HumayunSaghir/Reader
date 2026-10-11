const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  type: { type: String, required: true, enum: ['review', 'shelf_status', 'shelf_custom'] },
  // For 'review' type
  rating: { type: Number },
  reviewText: { type: String },
  // For 'shelf_status' type
  status: { type: String }, // 'want-to-read', 'currently-reading', 'read'
  // For 'shelf_custom' type
  customShelf: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Activity', activitySchema);
