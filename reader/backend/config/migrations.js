const mongoose = require('mongoose');
const Book = require('../models/Book');

// One-off data migrations, each recorded in the `migrations` collection so it
// runs exactly once per database.
const migrations = [
  {
    id: '2026-10-book-source-keys',
    // Older code stored Open Library work keys in `isbn`. Move them to sourceKey
    // so searches update these records instead of creating duplicates.
    async up() {
      const cursor = Book.find({ isbn: /^\/works\//, sourceKey: { $exists: false } }).select('isbn').lean().cursor();
      for await (const book of cursor) {
        try {
          await Book.updateOne({ _id: book._id }, { $set: { sourceKey: `ol:${book.isbn}` }, $unset: { isbn: 1 } });
        } catch (error) {
          if (error.code !== 11000) throw error; // duplicate work: leave the older copy as is
        }
      }
    }
  },
  {
    id: '2026-10-clear-placeholder-descriptions',
    // These generic texts were saved when no description was found; clear them
    // so the real description is fetched on next view.
    async up() {
      await Book.updateMany(
        { description: { $in: ['No description provided.', /^A fascinating book titled .* A highly recommended read that delves into intriguing concepts and stories\.$/s] } },
        { $unset: { description: 1, descriptionFetchedAt: 1 } }
      );
    }
  },
  {
    id: '2026-10-drop-dead-placeholder-covers',
    // via.placeholder.com no longer serves images; the frontend has its own fallback
    async up() {
      await Book.updateMany({ coverImage: /via\.placeholder\.com/ }, { $unset: { coverImage: 1 } });
    }
  }
];

const runMigrations = async () => {
  const collection = mongoose.connection.db.collection('migrations');
  for (const migration of migrations) {
    const done = await collection.findOne({ _id: migration.id });
    if (done) continue;
    console.log(`Running migration ${migration.id}`);
    await migration.up();
    await collection.insertOne({ _id: migration.id, appliedAt: new Date() });
  }
};

module.exports = { runMigrations };
