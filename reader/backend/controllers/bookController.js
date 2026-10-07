const Book = require('../models/Book');
const Shelf = require('../models/Shelf');

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
    const regex = new RegExp(query, 'i');
    const books = await Book.find({
      $or: [{ title: regex }, { author: regex }]
    }).limit(6);
    res.json(books);
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
  const { status } = req.body;
  const bookId = req.params.id;
  const userId = req.user._id;

  try {
    let shelf = await Shelf.findOne({ user: userId, book: bookId });
    if (shelf) {
      shelf.status = status;
      await shelf.save();
    } else {
      shelf = await Shelf.create({ user: userId, book: bookId, status });
    }
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

module.exports = { getBooks, searchBooks, getBookById, addBook, updateShelf, getUserShelves, removeShelf, liveSearch };
