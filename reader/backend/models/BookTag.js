const mongoose = require('mongoose');

// One user's vote that a book has a given micro-trope (e.g. "found family")
const bookTagSchema = new mongoose.Schema({
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tag: { type: String, required: true }
}, { timestamps: true });

bookTagSchema.index({ book: 1, user: 1, tag: 1 }, { unique: true });
bookTagSchema.index({ tag: 1, book: 1 });

module.exports = mongoose.model('BookTag', bookTagSchema);
