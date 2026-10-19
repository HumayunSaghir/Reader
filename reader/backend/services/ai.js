const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { gemini } = require('../config/env');
const cache = require('./cache');

// All Gemini calls go through here so cost controls live in one place:
// - a configurable model (GEMINI_MODEL) so a cheaper tier can be swapped in
// - hard caps on output tokens per feature
// - truncated prompt context and trimmed chat history
// - cached answers for anything deterministic enough to reuse

const MAX_CONTEXT_CHARS = 1500;
const MAX_CHAT_TURNS = 8;
const MAX_MESSAGE_CHARS = 1000;

class AiUnavailableError extends Error {
  constructor() {
    super('AI features are not configured on this server.');
    this.status = 503;
  }
}

let client = null;
const getClient = () => {
  if (!gemini.apiKey) throw new AiUnavailableError();
  if (!client) client = new GoogleGenerativeAI(gemini.apiKey);
  return client;
};

const truncate = (text, max) => {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

const hash = (value) => crypto.createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 16);

const model = (systemInstruction, maxOutputTokens) => getClient().getGenerativeModel({
  model: gemini.model,
  systemInstruction,
  generationConfig: { maxOutputTokens, temperature: 0.7 }
});

const bookContext = (book) =>
  `"${book.title}" by ${book.author}${book.genres?.length ? ` (genres: ${book.genres.slice(0, 5).join(', ')})` : ''}.` +
  (book.description ? `\nDescription: ${truncate(book.description, MAX_CONTEXT_CHARS)}` : '');

/** Book Q&A chat. Not cached (conversations are unique), but history and length are capped. */
const chatAboutBook = async (book, message, history = []) => {
  const system = `You are the "Book Sommelier" in a reading app, discussing ${bookContext(book)}
Answer questions about this book accurately and concisely (under 200 words). Avoid major spoilers unless the user explicitly asks for them. If you don't know something, say so.`;

  const trimmed = (Array.isArray(history) ? history : [])
    .filter(m => m && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_CHAT_TURNS)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: truncate(m.content, MAX_MESSAGE_CHARS) }] }));

  // Gemini requires the history to start with a user turn
  while (trimmed.length && trimmed[0].role !== 'user') trimmed.shift();

  const chat = model(system, 500).startChat({ history: trimmed });
  const result = await chat.sendMessage(truncate(message, MAX_MESSAGE_CHARS));
  return result.response.text();
};

/**
 * "Should I read this?" Cached per user + book for a week, and automatically
 * recomputed when the user's set of 5-star books changes.
 */
const recommendBook = async (book, favoriteTitles) => {
  const favorites = favoriteTitles.slice(0, 20);
  const key = `ai:rec:${book._id}:${hash(favorites)}`;
  return cache.getOrSet(key, async () => {
    const system = 'You are a book recommender. Reply in Markdown: first line "**Match: NN%**", then 2-3 short sentences explaining why. No preamble.';
    const prompt = favorites.length > 0
      ? `The reader rated these books 5 stars: ${favorites.join('; ')}.\nShould they read ${bookContext(book)}`
      : `The reader hasn't rated any books yet. Who would enjoy ${bookContext(book)}`;
    const result = await model(system, 200).generateContent(prompt);
    return result.response.text();
  }, { ttlSeconds: 7 * 24 * 3600 });
};

/**
 * Community review summary. Cached per book and keyed on the review set, so it
 * is only regenerated when reviews are added, edited or removed.
 */
const summarizeReviews = async (book, reviews) => {
  // Keep the prompt bounded: most-liked and most recent reviews first
  const sample = [...reviews]
    .sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0) || new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 40);
  const key = `ai:summary:${book._id}:${hash(reviews.map(r => [r._id, r.updatedAt]))}`;
  return cache.getOrSet(key, async () => {
    const system = 'You summarize community book reviews in 2-3 sentences: overall sentiment and the most common praise and criticism. Never quote or list individual reviews.';
    const text = sample.map(r => `- ${r.rating}/5: ${truncate(r.reviewText || '(no text)', 500)}`).join('\n');
    const result = await model(system, 200).generateContent(`Reviews of "${book.title}" by ${book.author}:\n${text}`);
    return result.response.text();
  }, { ttlSeconds: 30 * 24 * 3600 });
};

module.exports = { chatAboutBook, recommendBook, summarizeReviews, AiUnavailableError, MAX_MESSAGE_CHARS };
