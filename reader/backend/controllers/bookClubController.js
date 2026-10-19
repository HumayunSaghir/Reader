const { sendError } = require('../middlewares/errorHandler');
const mongoose = require('mongoose');
const BookClub = require('../models/BookClub');

const MAX_CHAPTERS = 200;
const MAX_MESSAGE_CHARS = 2000;
const MAX_STORED_MESSAGES = 2000;
const Book = require('../models/Book');
const { recordReadingActivity } = require('./readingLogController');

// Get all clubs
const getClubs = async (req, res) => {
  try {
    // The list only needs member counts; chat history stays on the detail endpoint
    const clubs = await BookClub.find()
      .select('-messages -members.readChapters')
      .populate('book', 'title coverImage author')
      .populate('creator', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(clubs);
  } catch (error) {
    sendError(res, error);
  }
};

// Get single club
const getClubById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Book club not found' });
    const club = await BookClub.findById(req.params.id)
      .populate('book', '-description')
      .populate('creator', 'name avatar')
      .populate('members.user', 'name avatar')
      .populate('messages.user', 'name avatar');
    
    if (!club) return res.status(404).json({ message: 'Book club not found' });
    res.json(club);
  } catch (error) {
    sendError(res, error);
  }
};

// Create a new club
const createClub = async (req, res) => {
  const { bookId, totalChapters } = req.body;
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const description = typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 1000) : '';
  if (!name || name.length > 80) return res.status(400).json({ message: 'Club names must be 1-80 characters' });
  if (!mongoose.isValidObjectId(bookId)) return res.status(400).json({ message: 'Choose a book for the club' });
  try {
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: 'Book not found' });

    const numChapters = Math.min(Math.max(1, parseInt(totalChapters) || 10), MAX_CHAPTERS);
    const chapters = Array.from({ length: numChapters }, (_, i) => `Chapter ${i + 1}`);

    const club = await BookClub.create({
      name,
      description,
      book: bookId,
      creator: req.user._id,
      totalChapters: numChapters,
      chapters: chapters,
      members: [{ user: req.user._id, progress: 0, readChapters: [] }]
    });

    res.status(201).json(club);
  } catch (error) {
    sendError(res, error);
  }
};

// Join a club
const joinClub = async (req, res) => {
  try {
    const club = await BookClub.findById(req.params.id);
    if (!club) return res.status(404).json({ message: 'Club not found' });

    const isMember = club.members.find(m => m.user.toString() === req.user._id.toString());
    if (isMember) return res.status(400).json({ message: 'Already a member' });

    club.members.push({ user: req.user._id, progress: 0, readChapters: [] });
    await club.save();
    
    // Repopulate member info to return
    const updatedClub = await BookClub.findById(req.params.id)
      .populate('members.user', 'name avatar');

    res.json(updatedClub.members);
  } catch (error) {
    sendError(res, error);
  }
};

// Update reading progress
const updateProgress = async (req, res) => {
  const { chapterIndex, action } = req.body;
  if (!['add', 'remove'].includes(action)) return res.status(400).json({ message: 'Invalid action' });
  try {
    const club = await BookClub.findById(req.params.id);
    if (!club) return res.status(404).json({ message: 'Club not found' });

    const member = club.members.find(m => m.user.toString() === req.user._id.toString());
    if (!member) return res.status(403).json({ message: 'Not a member of this club' });

    const total = club.totalChapters || club.chapters?.length || 10;
    if (!Number.isInteger(chapterIndex) || chapterIndex < 0 || chapterIndex >= total) {
      return res.status(400).json({ message: 'Invalid chapter' });
    }

    if (action === 'add') {
      if (!member.readChapters.includes(chapterIndex)) {
        member.readChapters.push(chapterIndex);
        await recordReadingActivity(req.user._id, club.book);
      }
    } else if (action === 'remove') {
      member.readChapters = member.readChapters.filter(c => c !== chapterIndex);
    }
    
    // Recalculate progress percentage
    member.progress = Math.round((member.readChapters.length / total) * 100);
    if (member.progress > 100) member.progress = 100;

    await club.save();

    res.json({ message: 'Progress updated', progress: member.progress, readChapters: member.readChapters });
  } catch (error) {
    sendError(res, error);
  }
};

// Send message to club chat
const sendMessage = async (req, res) => {
  const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
  const isSpoiler = req.body.isSpoiler === true;
  if (!text) return res.status(400).json({ message: 'Message text is required' });
  if (text.length > MAX_MESSAGE_CHARS) return res.status(400).json({ message: `Messages are limited to ${MAX_MESSAGE_CHARS} characters` });
  try {
    const club = await BookClub.findById(req.params.id);
    if (!club) return res.status(404).json({ message: 'Club not found' });

    const member = club.members.find(m => m.user.toString() === req.user._id.toString());
    if (!member) return res.status(403).json({ message: 'Not a member of this club' });

    club.messages.push({ user: req.user._id, text, isSpoiler });
    // Keep the club document bounded (MongoDB documents max out at 16 MB)
    if (club.messages.length > MAX_STORED_MESSAGES) {
      club.messages = club.messages.slice(-MAX_STORED_MESSAGES);
    }
    await club.save();

    const updatedClub = await BookClub.findById(req.params.id)
      .populate('messages.user', 'name avatar');

    // Return the specific message with populated user (which is the last one in the array)
    res.status(201).json(updatedClub.messages[updatedClub.messages.length - 1]);
  } catch (error) {
    sendError(res, error);
  }
};

// Delete a club (creator only)
const deleteClub = async (req, res) => {
  try {
    const club = await BookClub.findById(req.params.id);
    if (!club) return res.status(404).json({ message: 'Club not found' });

    if (club.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the creator of the club can delete it' });
    }

    await BookClub.findByIdAndDelete(req.params.id);
    res.json({ message: 'Book club deleted successfully' });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = { getClubs, getClubById, createClub, joinClub, updateProgress, sendMessage, deleteClub };
