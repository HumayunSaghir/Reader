const BookClub = require('../models/BookClub');
const Book = require('../models/Book');
const { recordReadingActivity } = require('./readingLogController');

// Get all clubs
const getClubs = async (req, res) => {
  try {
    const clubs = await BookClub.find()
      .populate('book', 'title coverImage author')
      .populate('creator', 'name avatar')
      .sort({ createdAt: -1 });
    res.json(clubs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single club
const getClubById = async (req, res) => {
  try {
    const club = await BookClub.findById(req.params.id)
      .populate('book')
      .populate('creator', 'name avatar')
      .populate('members.user', 'name avatar')
      .populate('messages.user', 'name avatar');
    
    if (!club) return res.status(404).json({ message: 'Book club not found' });
    res.json(club);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new club
const createClub = async (req, res) => {
  const { name, description, bookId, totalChapters } = req.body;
  try {
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: 'Book not found' });

    const numChapters = Math.max(1, parseInt(totalChapters) || 10);
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
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
  }
};

// Update reading progress
const updateProgress = async (req, res) => {
  const { chapterIndex, action } = req.body;
  try {
    const club = await BookClub.findById(req.params.id);
    if (!club) return res.status(404).json({ message: 'Club not found' });

    const member = club.members.find(m => m.user.toString() === req.user._id.toString());
    if (!member) return res.status(403).json({ message: 'Not a member of this club' });

    if (action === 'add') {
      if (!member.readChapters.includes(chapterIndex)) {
        member.readChapters.push(chapterIndex);
        await recordReadingActivity(req.user._id, club.book);
      }
    } else if (action === 'remove') {
      member.readChapters = member.readChapters.filter(c => c !== chapterIndex);
    }
    
    // Recalculate progress percentage
    const total = club.totalChapters || club.chapters?.length || 10;
    member.progress = Math.round((member.readChapters.length / total) * 100);
    if (member.progress > 100) member.progress = 100;

    await club.save();

    res.json({ message: 'Progress updated', progress: member.progress, readChapters: member.readChapters });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Send message to club chat
const sendMessage = async (req, res) => {
  const { text, isSpoiler } = req.body;
  try {
    const club = await BookClub.findById(req.params.id);
    if (!club) return res.status(404).json({ message: 'Club not found' });

    const member = club.members.find(m => m.user.toString() === req.user._id.toString());
    if (!member) return res.status(403).json({ message: 'Not a member of this club' });

    const newMessage = {
      user: req.user._id,
      text,
      isSpoiler: isSpoiler || false
    };

    club.messages.push(newMessage);
    await club.save();

    const updatedClub = await BookClub.findById(req.params.id)
      .populate('messages.user', 'name avatar');

    // Return the specific message with populated user (which is the last one in the array)
    res.status(201).json(updatedClub.messages[updatedClub.messages.length - 1]);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getClubs, getClubById, createClub, joinClub, updateProgress, sendMessage, deleteClub };
