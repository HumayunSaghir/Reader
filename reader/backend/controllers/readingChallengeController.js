const { sendError } = require('../middlewares/errorHandler');
const ReadingChallenge = require('../models/ReadingChallenge');
const Shelf = require('../models/Shelf');
const Book = require('../models/Book');
const Review = require('../models/Review');
const ReadingLog = require('../models/ReadingLog');
const User = require('../models/User');

// Helper to determine reading persona based on count and genres
const getPersona = (count, topGenre) => {
  if (count >= 40) {
    return {
      title: "The Literary Devourer",
      badge: "⚡ Astronomical Pace",
      description: "You consume stories at lightning speed. Libraries tremble when you walk in!"
    };
  }
  if (count >= 25) {
    return {
      title: "The Deep-Dive Bibliophile",
      badge: "📚 Master Reader",
      description: "Books aren't just a hobby for you; they are a cherished daily ritual."
    };
  }
  const genreLower = (topGenre || '').toLowerCase();
  if (genreLower.includes('sci-fi') || genreLower.includes('fantasy')) {
    return {
      title: "The Multiverse Traveler",
      badge: "✨ Cosmic Explorer",
      description: "You thrive on ancient magic, distant stars, and limitless realms."
    };
  }
  if (genreLower.includes('mystery') || genreLower.includes('thriller')) {
    return {
      title: "The Master Sleuth",
      badge: "🔍 Plot Detective",
      description: "You never put a book down until every secret and plot twist is solved."
    };
  }
  if (genreLower.includes('romance')) {
    return {
      title: "The Hopeless Romantic",
      badge: "💖 Heartstrings Weaver",
      description: "You read for emotional depth, electric banter, and happy endings."
    };
  }
  if (genreLower.includes('non-fiction') || genreLower.includes('history') || genreLower.includes('biography')) {
    return {
      title: "The Perpetual Scholar",
      badge: "🧠 Truth Seeker",
      description: "Your hunger for real-world wisdom and historic insight knows no bounds."
    };
  }
  if (count >= 10) {
    return {
      title: "The Avid Voyager",
      badge: "🧭 Dedicated Explorer",
      description: "Steadily turning pages and discovering new worlds week after week."
    };
  }
  if (count >= 1) {
    return {
      title: "The Inspired Storyseeker",
      badge: "🌱 Story Artisan",
      description: "Every finished book sparks imagination and opens new perspectives."
    };
  }
  return {
    title: "The Aspiring Wanderer",
    badge: "🚀 Fresh Journey",
    description: "Poised at the starting line of an unforgettable literary adventure."
  };
};

// Calculate streak from log records for a specific year
const calculateYearlyStreaks = (logs) => {
  if (!logs || logs.length === 0) return { longestStreak: 0, totalDaysActive: 0 };

  const activeDates = new Set(logs.map(l => l.date));
  const sortedDates = Array.from(activeDates).sort();

  let longestStreak = 0;
  let currentRun = 0;
  let prevDate = null;

  for (const dateStr of sortedDates) {
    const currentDate = new Date(dateStr + 'T00:00:00Z');
    if (!prevDate) {
      currentRun = 1;
    } else {
      const diffDays = Math.round((currentDate - prevDate) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentRun += 1;
      } else if (diffDays > 1) {
        currentRun = 1;
      }
    }
    if (currentRun > longestStreak) {
      longestStreak = currentRun;
    }
    prevDate = currentDate;
  }

  return { longestStreak, totalDaysActive: activeDates.size };
};

// GET /api/reading/challenge
const getChallengeData = async (req, res) => {
  try {
    const userId = req.user._id;
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();

    // 1. Fetch challenge target
    let challenge = await ReadingChallenge.findOne({ user: userId, year });
    const target = challenge ? challenge.target : 20;

    // 2. Fetch completed books for the user
    const readShelves = await Shelf.find({ user: userId, status: 'read' })
      .populate('book')
      .sort({ updatedAt: -1 });

    const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
    const yearEnd = new Date(`${year}-12-31T23:59:59.999Z`);

    // Filter books read in specified year
    const readBooks = readShelves.filter(s => {
      if (!s.book) return false;
      const readDate = s.readAt || s.updatedAt || s.createdAt;
      if (!readDate) return true;
      const d = new Date(readDate);
      return d >= yearStart && d <= yearEnd;
    }).map(s => ({
      _id: s.book._id,
      title: s.book.title,
      author: s.book.author,
      coverImage: s.book.coverImage,
      genres: s.book.genres || [],
      pageCount: s.book.pageCount || null,
      averageRating: s.book.averageRating || 0,
      readAt: s.readAt || s.updatedAt || s.createdAt
    }));

    const completedCount = readBooks.length;
    const percentage = Math.min(100, Math.round((completedCount / target) * 100));

    // 3. Calculate Pace
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    const totalDays = isLeapYear ? 366 : 365;
    const now = new Date();
    const currentYear = now.getFullYear();

    let daysPassed;
    if (year < currentYear) {
      daysPassed = totalDays;
    } else if (year === currentYear) {
      const start = new Date(year, 0, 1);
      daysPassed = Math.max(1, Math.min(totalDays, Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1));
    } else {
      daysPassed = 0;
    }

    const expectedBooks = Math.round((daysPassed / totalDays) * target);
    const diff = completedCount - expectedBooks;

    let paceStatus = 'on_track';
    let paceMessage = 'Right on schedule!';
    if (completedCount >= target) {
      paceStatus = 'completed';
      paceMessage = 'Goal achieved! Outstanding job! 🎉';
    } else if (diff > 0) {
      paceStatus = 'ahead';
      paceMessage = `${diff} book${diff > 1 ? 's' : ''} ahead of schedule`;
    } else if (diff < 0) {
      paceStatus = 'behind';
      paceMessage = `${Math.abs(diff)} book${Math.abs(diff) > 1 ? 's' : ''} behind schedule`;
    }

    // 4. Wrapped Infographic Analytics
    // Top Genres Breakdown
    const genreCounts = {};
    readBooks.forEach(b => {
      if (b.genres && b.genres.length > 0) {
        b.genres.forEach(g => {
          genreCounts[g] = (genreCounts[g] || 0) + 1;
        });
      } else {
        genreCounts['Fiction'] = (genreCounts['Fiction'] || 0) + 1;
      }
    });

    const sortedGenres = Object.entries(genreCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const totalGenreTags = sortedGenres.reduce((acc, g) => acc + g.count, 0) || 1;
    const topGenres = sortedGenres.slice(0, 4).map(g => ({
      ...g,
      percentage: Math.round((g.count / totalGenreTags) * 100)
    }));
    const topGenre = topGenres.length > 0 ? topGenres[0].name : 'Literary Fiction';

    // Top Rated Book by user
    const bookIds = readBooks.map(b => b._id);
    const userReviews = await Review.find({ user: userId, book: { $in: bookIds } }).populate('book');
    userReviews.sort((a, b) => b.rating - a.rating);

    let topBook = null;
    if (userReviews.length > 0 && userReviews[0].book) {
      topBook = {
        _id: userReviews[0].book._id,
        title: userReviews[0].book.title,
        author: userReviews[0].book.author,
        coverImage: userReviews[0].book.coverImage,
        rating: userReviews[0].rating,
        reviewSnippet: userReviews[0].reviewText ? (userReviews[0].reviewText.slice(0, 120) + (userReviews[0].reviewText.length > 120 ? '...' : '')) : null
      };
    } else if (readBooks.length > 0) {
      topBook = {
        _id: readBooks[0]._id,
        title: readBooks[0].title,
        author: readBooks[0].author,
        coverImage: readBooks[0].coverImage,
        rating: 5,
        reviewSnippet: null
      };
    }

    // Reading persona
    const persona = getPersona(completedCount, topGenre);

    // Reading streaks for this year
    const yearlyLogs = await ReadingLog.find({
      user: userId,
      date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` }
    });
    const { longestStreak, totalDaysActive } = calculateYearlyStreaks(yearlyLogs);

    // Real page counts where the catalogue has them, ~300 pages otherwise
    const estimatedPages = readBooks.reduce((sum, b) => sum + (b.pageCount || 300), 0);

    // User details for wrapped card
    const user = await User.findById(userId).select('name avatar');

    res.json({
      year,
      target,
      completedCount,
      percentage,
      paceStatus,
      paceMessage,
      readBooks,
      wrapped: {
        year,
        userName: user ? user.name : 'Reader',
        userAvatar: user ? user.avatar : null,
        completedCount,
        target,
        percentage,
        estimatedPages,
        topBook,
        topGenre,
        topGenres,
        persona,
        longestStreak,
        totalDaysActive
      }
    });
  } catch (error) {
    console.error('Error fetching challenge data:', error);
    sendError(res, error);
  }
};

// POST /api/reading/challenge
const setChallengeTarget = async (req, res) => {
  try {
    const userId = req.user._id;
    const year = parseInt(req.body.year, 10) || new Date().getFullYear();
    const target = parseInt(req.body.target, 10);

    if (!target || target < 1 || target > 1000) {
      return res.status(400).json({ message: 'Target must be between 1 and 1000 books.' });
    }

    const challenge = await ReadingChallenge.findOneAndUpdate(
      { user: userId, year },
      { target },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Return the updated data
    req.query.year = year;
    return getChallengeData(req, res);
  } catch (error) {
    console.error('Error setting challenge target:', error);
    sendError(res, error);
  }
};

module.exports = {
  getChallengeData,
  setChallengeTarget
};
