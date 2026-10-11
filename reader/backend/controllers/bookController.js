const Book = require('../models/Book');
const Shelf = require('../models/Shelf');
const Activity = require('../models/Activity');
const { recordReadingActivity } = require('./readingLogController');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const fetchAndSaveFromOpenLibrary = async (query, maxResults = 10, page = 1) => {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${maxResults}&page=${page}`;
  const response = await fetch(url);
  const data = await response.json();
  
  const savedBooks = [];
  if (data.docs) {
    for (let item of data.docs) {
      if (!item.title || !item.author_name) continue;
      
      const isbn = (item.isbn && item.isbn.length > 0) ? item.isbn[0] : item.key;
      const coverImage = item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-L.jpg` : 'https://via.placeholder.com/400x550?text=No+Cover';
      
      let book = await Book.findOne({ isbn });
      if (!book) {
        book = await Book.create({
          title: item.title,
          author: item.author_name.join(', '),
          description: 'No description provided.',
          coverImage: coverImage,
          isbn: isbn,
          publishedYear: item.first_publish_year || null,
          genres: item.subject ? item.subject.slice(0, 3) : []
        });
      }
      savedBooks.push(book);
    }
  }
  return savedBooks;
};

const getBooks = async (req, res) => {
  try {
    const { category, page = 1 } = req.query;
    const queries = ['fiction', 'science', 'history', 'technology', 'fantasy', 'mystery', 'romance', 'thriller', 'programming', 'art'];
    const randomQuery = category && category !== 'All' ? category : queries[Math.floor(Math.random() * queries.length)];
    
    const books = await fetchAndSaveFromOpenLibrary(randomQuery, 50, page);
    
    if (books.length === 0) {
      const count = await Book.countDocuments();
      if (count > 0) {
        const randomDbBooks = await Book.aggregate([{ $sample: { size: 8 } }]);
        return res.json(randomDbBooks);
      }
    }
    res.json(books);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const searchBooks = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ message: 'Query is required' });
    
    const books = await fetchAndSaveFromOpenLibrary(query, 12);
    res.json(books);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const liveSearch = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.json([]);
    const cleanQuery = query.trim();
    if (!cleanQuery) return res.json([]);

    const regex = new RegExp(cleanQuery, 'i');
    let books = await Book.find({
      $or: [{ title: regex }, { author: regex }]
    }).limit(10);

    // If fewer than 4 books found and query is >= 3 chars, fetch from Open Library
    if (books.length < 4 && cleanQuery.length >= 3) {
      try {
        const externalBooks = await fetchAndSaveFromOpenLibrary(cleanQuery, 6);
        const existingIds = new Set(books.map(b => b._id.toString()));
        for (const ext of externalBooks) {
          if (!existingIds.has(ext._id.toString())) {
            books.push(ext);
            existingIds.add(ext._id.toString());
          }
        }
      } catch (e) {
        // Ignore external fetch error
      }
    }

    // Sort to prioritize titles starting with or containing query
    const lowerQ = cleanQuery.toLowerCase();
    books.sort((a, b) => {
      const aTitle = (a.title || '').toLowerCase();
      const bTitle = (b.title || '').toLowerCase();
      
      const aStarts = aTitle.startsWith(lowerQ);
      const bStarts = bTitle.startsWith(lowerQ);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      const aWord = aTitle.split(/\s+/).some(w => w.startsWith(lowerQ));
      const bWord = bTitle.split(/\s+/).some(w => w.startsWith(lowerQ));
      if (aWord && !bWord) return -1;
      if (!aWord && bWord) return 1;

      const aIncludes = aTitle.includes(lowerQ);
      const bIncludes = bTitle.includes(lowerQ);
      if (aIncludes && !bIncludes) return -1;
      if (!aIncludes && bIncludes) return 1;

      return 0;
    });

    res.json(books.slice(0, 6));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getBookById = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }
    
    if (book.description === 'No description provided.') {
      let descriptionFound = null;
      
      // 1. Google Books API
      try {
        let queryStr = book.isbn.startsWith('/works/') 
           ? encodeURIComponent(book.title + ' ' + book.author) 
           : `isbn:${book.isbn}`;
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${queryStr}&maxResults=1`);
        if (response.ok) {
          const data = await response.json();
          if (data.items && data.items.length > 0 && data.items[0].volumeInfo.description) {
            descriptionFound = data.items[0].volumeInfo.description;
          }
        }
      } catch (e) {}

      // 2. OpenLibrary Works API Fallback
      if (!descriptionFound) {
        try {
          let workKey = book.isbn;
          if (!workKey.startsWith('/works/')) {
            const res = await fetch(`https://openlibrary.org/isbn/${book.isbn}.json`);
            if (res.ok) {
              const data = await res.json();
              if (data.works && data.works.length > 0) {
                workKey = data.works[0].key;
              }
            }
          }
          if (workKey.startsWith('/works/')) {
            const res = await fetch(`https://openlibrary.org${workKey}.json`);
            if (res.ok) {
              const data = await res.json();
              if (data.description) {
                descriptionFound = typeof data.description === 'string' ? data.description : data.description.value;
              }
            }
          }
        } catch(e) {}
      }
      
      // 3. Generic Fallback
      if (!descriptionFound) {
        descriptionFound = `A fascinating book titled "${book.title}" written by the renowned author ${book.author}. A highly recommended read that delves into intriguing concepts and stories.`;
      }
      
      book.description = descriptionFound;
      await book.save();
    }
    
    res.json(book);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addBook = async (req, res) => {
  try {
    const book = new Book(req.body);
    const createdBook = await book.save();
    res.status(201).json(createdBook);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateShelf = async (req, res) => {
  const { status, customShelf, action } = req.body;
  const bookId = req.params.id;
  const userId = req.user._id;

  try {
    let shelf = await Shelf.findOne({ user: userId, book: bookId });
    if (!shelf) {
      shelf = new Shelf({ user: userId, book: bookId });
    }
    
    if (status !== undefined) {
      if (shelf.status !== status) {
        shelf.status = status;
        if (status === 'read') {
          shelf.readAt = new Date();
        } else {
          shelf.readAt = null;
        }
        if (status) {
          await Activity.create({ user: userId, book: bookId, type: 'shelf_status', status });
        }
      }
    }
    
    if (customShelf) {
      if (action === 'add') {
        if (!shelf.customShelves.includes(customShelf)) {
          shelf.customShelves.push(customShelf);
          await Activity.create({ user: userId, book: bookId, type: 'shelf_custom', customShelf });
        }
      } else if (action === 'remove') {
        shelf.customShelves = shelf.customShelves.filter(s => s !== customShelf);
      }
    }
    
    if (!shelf.status && shelf.customShelves.length === 0) {
      if (shelf._id) await Shelf.findByIdAndDelete(shelf._id);
      return res.json({ message: 'Removed from all shelves' });
    }
    
    await shelf.save();
    res.json(shelf);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getUserShelves = async (req, res) => {
  try {
    const shelves = await Shelf.find({ user: req.user._id }).populate('book');
    res.json(shelves);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const removeShelf = async (req, res) => {
  const bookId = req.params.id;
  const userId = req.user._id;
  try {
    await Shelf.findOneAndDelete({ user: userId, book: bookId });
    res.json({ message: 'Book removed from shelf' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const chatWithBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ message: 'Message is required' });

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ message: 'GEMINI_API_KEY is missing in backend .env file.' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    const systemContext = `You are a helpful and knowledgeable AI "Book Sommelier" for a reading tracking app. 
You are currently discussing the book "${book.title}" by ${book.author}. 
Here is a brief description of the book for context: "${book.description}". 
Answer the user's questions about this book politely, accurately, and without giving away major spoilers unless explicitly asked.`;

    const chatHistory = history ? history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    })) : [];

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemContext + "\n\nDo you understand your role?" }] },
        { role: 'model', parts: [{ text: "Yes, I understand! I am ready to answer any questions about the book." }] },
        ...chatHistory
      ]
    });

    console.log("Sending message to AI...");
    const result = await chat.sendMessage(message);
    console.log("Got result from AI:", result != null);
    const response = await result.response;
    console.log("Got response:", response != null);
    const text = response.text();
    console.log("Got text:", text.length > 0);

    res.json({ reply: text });
  } catch (error) {
    console.error('Chat AI Error Stack:', error.stack || error);
    require('fs').appendFileSync('ai_error.log', new Date().toISOString() + '\\n' + (error.stack || error) + '\\n\\n');
    res.status(500).json({ message: error.message || 'Failed to generate AI response' });
  }
};

const getRecommendation = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    
    const Review = require('../models/Review');
    const userReviews = await Review.find({ user: req.user._id, rating: 5 }).populate('book');
    const favoriteBooks = userReviews.filter(r => r.book).map(r => r.book.title).join(', ');

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    let prompt = `You are an AI book recommender. The user is considering reading "${book.title}" by ${book.author} (Genres: ${book.genres.join(', ')}). Description: ${book.description}. `;
    if (favoriteBooks.length > 0) {
      prompt += `The user has previously rated these books 5 stars: ${favoriteBooks}. Based on this, give a recommendation percentage (0-100%) and a short 2-3 sentence explanation of why they would or wouldn't like it.`;
    } else {
      prompt += `The user has not rated any books 5 stars yet. Based on the book's general appeal, give a recommendation percentage (0-100%) and a short 2-3 sentence explanation of who would enjoy this book.`;
    }

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({ recommendation: text });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getBooks, searchBooks, getBookById, addBook, updateShelf, getUserShelves, removeShelf, liveSearch, chatWithBook, getRecommendation };
