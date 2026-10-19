const mongoose = require('mongoose');

// A book the user swiped left on in Discover, so it isn't shown again
const bookDismissalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true }
}, { timestamps: true });

bookDismissalSchema.index({ user: 1, book: 1 }, { unique: true });

module.exports = mongoose.model('BookDismissal', bookDismissalSchema);
