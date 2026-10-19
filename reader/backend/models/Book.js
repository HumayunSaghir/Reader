const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  description: { type: String },
  // When we last asked the providers for a description (set even if none was found)
  descriptionFetchedAt: { type: Date },
  coverImage: { type: String },
  isbn: { type: String },
  publishedYear: { type: Number },
  genres: [{ type: String }],
  // Provider identity, e.g. "ol:/works/OL17075811W" or "gb:<volumeId>"
  sourceKey: { type: String },
  // Open Library key of the best English edition, e.g. "/books/OL26247313M"
  editionKey: { type: String },
  // Number of published editions (Open Library) — a cheap popularity signal
  editionCount: { type: Number, default: 0 },
  pageCount: { type: Number },
  // In-app ratings from our own reviews
  averageRating: { type: Number, default: 0 },
  ratingsCount: { type: Number, default: 0 }
}, { timestamps: true });

bookSchema.index({ sourceKey: 1 }, { unique: true, partialFilterExpression: { sourceKey: { $type: 'string' } } });
bookSchema.index({ title: 'text', author: 'text' }, { weights: { title: 3, author: 1 }, name: 'book_text' });
bookSchema.index({ genres: 1 });

module.exports = mongoose.model('Book', bookSchema);
