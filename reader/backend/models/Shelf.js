const mongoose = require('mongoose');

const shelfSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  status: { 
    type: String, 
    required: false, 
    enum: ['want-to-read', 'currently-reading', 'read'] 
  },
  readAt: { type: Date },
  customShelves: [{ type: String }]
}, { timestamps: true });

shelfSchema.index({ user: 1, book: 1 });
shelfSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('Shelf', shelfSchema);
