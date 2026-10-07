const mongoose = require('mongoose');
const Book = require('./models/Book');

const test = async () => {
  try {
    console.log("Connecting to DB...");
    await mongoose.connect('mongodb://localhost:27017/reader', { serverSelectionTimeoutMS: 2000 });
    console.log("Connected.");
    
    console.log("Fetching from OpenLibrary...");
    const url = `https://openlibrary.org/search.json?q=sapiens&limit=2`;
    const response = await fetch(url);
    const data = await response.json();
    console.log("Fetched.", data.docs?.length, "items.");
    
    for (let item of data.docs) {
      console.log("Checking item:", item.title, "Has author?", !!item.author_name, "Has ISBN?", !!item.isbn);
      if (!item.title || !item.author_name || !item.isbn || item.isbn.length === 0) {
          console.log("Skipping...");
          continue;
      }
      const isbn = item.isbn[0];
      let book = await Book.findOne({ isbn });
      if (!book) {
         book = await Book.create({
          title: item.title,
          author: item.author_name.join(', '),
          description: 'No description provided.',
          coverImage: '',
          isbn: isbn,
          publishedYear: item.first_publish_year || null,
          genres: item.subject ? item.subject.slice(0, 3) : []
        });
      }
      console.log("Saved:", book.title);
    }
    console.log("Done");
    process.exit(0);
  } catch (err) {
    console.error("ERROR:", err);
    process.exit(1);
  }
};
test();
