const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  isSpoiler: { type: Boolean, default: false }
}, { timestamps: true });

const memberSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  progress: { type: Number, default: 0 }, // computed percentage
  readChapters: [{ type: Number }], // indices of checked chapters
  joinedAt: { type: Date, default: Date.now }
});

const bookClubSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  totalChapters: { type: Number, default: 10 },
  chapters: [{ type: String }],
  members: [memberSchema],
  messages: [messageSchema]
}, { timestamps: true });

bookClubSchema.index({ createdAt: -1 });

module.exports = mongoose.model('BookClub', bookClubSchema);
