const mongoose = require('mongoose');

// Generic key/value cache (external API results, AI responses). MongoDB's TTL
// monitor deletes entries once expiresAt passes.
const cacheEntrySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed },
  freshUntil: { type: Date, required: true },
  expiresAt: { type: Date, required: true }
}, { timestamps: true, minimize: false });

cacheEntrySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('CacheEntry', cacheEntrySchema);
