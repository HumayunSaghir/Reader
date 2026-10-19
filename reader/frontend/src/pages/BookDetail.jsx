import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Bot, Sparkles, BrainCircuit, MessageSquareText, SendHorizontal, X, Check, Star, Calendar, FileText } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { AuthContext } from '../contexts/AuthContext';
import { FALLBACK_IMAGE } from '../assets/fallbackImage';
import { coverSrc } from '../components/BookCard';
import ReviewItem from '../components/ReviewItem';
import BookTags from '../components/BookTags';
import usePageTitle from '../hooks/usePageTitle';
import './BookDetail.css';

const SHELF_OPTIONS = [
  { value: 'want-to-read', label: 'Want to read' },
  { value: 'currently-reading', label: 'Reading' },
  { value: 'read', label: 'Read' }
];
const SHELF_LABELS = Object.fromEntries(SHELF_OPTIONS.map(o => [o.value, o.label]));
const DESCRIPTION_PREVIEW_CHARS = 600;

// Descriptions arrive as plain text, Markdown or simple HTML
const cleanDescription = (text) => (text || '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>\s*<p>/gi, '\n\n')
  .replace(/<[^>]+>/g, '')
  .replace(/\r\n/g, '\n')
  .trim();

const BookDetailSkeleton = () => (
  <div className="book-layout" aria-busy="true">
    <div className="book-aside"><div className="book-cover skeleton" /></div>
    <div className="book-main">
      <div className="skeleton" style={{ height: '2.5rem', width: '70%', marginBottom: '0.75rem' }} />
      <div className="skeleton" style={{ height: '1.25rem', width: '40%', marginBottom: '2rem' }} />
      {[95, 90, 97, 60].map((w, i) => <div key={i} className="skeleton skeleton-text" style={{ width: `${w}%` }} />)}
    </div>
  </div>
);

const BookDetail = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const userId = user?._id;

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [description, setDescription] = useState(null); // null = still loading
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const [shelfStatus, setShelfStatus] = useState(null);
  const [activeCustomShelves, setActiveCustomShelves] = useState([]);
  const [shelfSaving, setShelfSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimer = useRef(null);

  const [recommendation, setRecommendation] = useState(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null);

  usePageTitle(book ? `${book.title} by ${book.author}` : 'Book');

  const showToast = (msg) => {
    setToastMessage(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    if (chatOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatOpen]);

  const fetchReviews = async () => {
    try {
      const { data } = await api.get(`/api/books/${id}/reviews`);
      setReviews(data);
    } catch (error) {
      console.error(error);
    } finally {
      setReviewsLoading(false);
    }
  };

  // The book renders as soon as it arrives; everything else loads alongside it
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setBook(null);
    setDescription(null);
    setDescriptionExpanded(false);
    setRecommendation(null);
    setReviewSummary(null);
    setChatHistory([]);
    setReviewsLoading(true);

    api.get(`/api/books/${id}`)
      .then(({ data }) => {
        if (cancelled) return;
        setBook(data);
        if (data.description) {
          setDescription(data.description);
        } else {
          api.get(`/api/books/${id}/description`)
            .then(({ data: d }) => { if (!cancelled) setDescription(d.description || ''); })
            .catch(() => { if (!cancelled) setDescription(''); });
        }
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.response?.status === 404 ? 'not-found' : errorMessage(error));
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    fetchReviews();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!userId) {
      setShelfStatus(null);
      setActiveCustomShelves([]);
      return;
    }
    api.get(`/api/books/${id}/shelf`)
      .then(({ data }) => {
        setShelfStatus(data.status || null);
        setActiveCustomShelves(data.customShelves || []);
      })
      .catch(() => {});
  }, [id, userId]);

  // Prefill the form with the user's existing review so posting edits it
  const myReview = userId ? reviews.find(r => r.user?._id === userId) : null;
  useEffect(() => {
    if (myReview) {
      setRating(myReview.rating);
      setReviewText(myReview.reviewText || '');
    }
  }, [myReview?._id]);

  const updateShelf = async (status) => {
    if (!user) return showToast('Log in to add books to your shelves.');
    const previous = shelfStatus;
    const next = status === shelfStatus ? null : status;
    setShelfStatus(next); // optimistic
    setShelfSaving(true);
    try {
      if (next === null && activeCustomShelves.length === 0) {
        await api.delete(`/api/books/${id}/shelf`);
      } else {
        await api.post(`/api/books/${id}/shelf`, { status: next });
      }
      showToast(next ? `Added to ${SHELF_LABELS[next]}` : 'Removed from your shelves');
    } catch (error) {
      setShelfStatus(previous);
      showToast(errorMessage(error, 'Could not update your shelf.'));
    } finally {
      setShelfSaving(false);
    }
  };

  const toggleCustomShelf = async (shelfName) => {
    const isAdding = !activeCustomShelves.includes(shelfName);
    try {
      await api.post(`/api/books/${id}/shelf`, { customShelf: shelfName, action: isAdding ? 'add' : 'remove' });
      setActiveCustomShelves(prev => (isAdding ? [...prev, shelfName] : prev.filter(s => s !== shelfName)));
      showToast(isAdding ? `Added to ${shelfName}` : `Removed from ${shelfName}`);
    } catch (error) {
      showToast(errorMessage(error, 'Could not update the shelf.'));
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!rating) return showToast('Choose a star rating first.');
    setSubmittingReview(true);
    try {
      await api.post(`/api/books/${id}/reviews`, { rating, reviewText });
      await fetchReviews();
      const { data } = await api.get(`/api/books/${id}`);
      setBook(prev => ({ ...prev, averageRating: data.averageRating, ratingsCount: data.ratingsCount }));
      setReviewSummary(null);
      showToast(myReview ? 'Review updated' : 'Review posted');
    } catch (error) {
      showToast(errorMessage(error, 'Could not post your review.'));
    } finally {
      setSubmittingReview(false);
    }
  };

  const sendMessageToAI = async (e) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    if (!user) return showToast('Log in to chat with the Book Sommelier.');

    const newMessage = { role: 'user', content: text };
    const history = [...chatHistory, newMessage];
    setChatHistory(history);
    setChatInput('');
    setChatLoading(true);
    try {
      const { data } = await api.post(`/api/books/${id}/chat`, { message: text, history: chatHistory });
      setChatHistory([...history, { role: 'model', content: data.reply }]);
    } catch (error) {
      setChatHistory([...history, { role: 'model', content: `⚠️ ${errorMessage(error, 'The AI could not answer right now.')}`, isError: true }]);
    } finally {
      setChatLoading(false);
    }
  };

  const getRecommendation = async () => {
    if (!user) return showToast('Log in to get a personalized recommendation.');
    setLoadingRecommendation(true);
    try {
      const { data } = await api.get(`/api/books/${id}/recommendation`);
      setRecommendation(data.recommendation);
    } catch (error) {
      showToast(errorMessage(error, 'Could not get a recommendation.'));
    } finally {
      setLoadingRecommendation(false);
    }
  };

  const getReviewSummary = async () => {
    setLoadingSummary(true);
    try {
      const { data } = await api.get(`/api/books/${id}/reviews/summary`);
      setReviewSummary(data.summary);
    } catch (error) {
      showToast(errorMessage(error, 'Could not summarize reviews.'));
    } finally {
      setLoadingSummary(false);
    }
  };

  if (loading) return <BookDetailSkeleton />;
  if (loadError === 'not-found' || (!book && !loadError)) {
    return (
      <div className="empty-state" style={{ marginTop: '2rem' }}>
        <h3>Book not found</h3>
        <p style={{ marginBottom: '1rem' }}>It may have been removed, or the link is wrong.</p>
        <Link to="/" className="btn-primary">Browse books</Link>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="empty-state" style={{ marginTop: '2rem' }}>
        <h3>Couldn't load this book</h3>
        <p style={{ marginBottom: '1rem' }}>{loadError}</p>
        <button className="btn-primary" onClick={() => window.location.reload()}>Try again</button>
      </div>
    );
  }

  const cleaned = cleanDescription(description);
  const isLong = cleaned.length > DESCRIPTION_PREVIEW_CHARS;
  const shownDescription = isLong && !descriptionExpanded ? `${cleaned.slice(0, DESCRIPTION_PREVIEW_CHARS).replace(/\s+\S*$/, '')}…` : cleaned;

  return (
    <div className="book-detail-page animate-fade-in">
      <div className="toast-region" aria-live="polite">
        {toastMessage && <div className="toast-notification">{toastMessage}</div>}
      </div>

      <div className="book-layout">
        <aside className="book-aside">
          <div className="book-cover">
            <img
              src={coverSrc(book.coverImage)}
              alt={`Cover of ${book.title}`}
              width="300"
              height="450"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_IMAGE; }}
            />
          </div>

          <div className="shelf-picker" role="group" aria-label="Reading status">
            {SHELF_OPTIONS.map(option => (
              <button
                key={option.value}
                className={`shelf-option ${shelfStatus === option.value ? 'is-active' : ''}`}
                aria-pressed={shelfStatus === option.value}
                onClick={() => updateShelf(option.value)}
                disabled={shelfSaving}
              >
                {shelfStatus === option.value && <Check size={15} aria-hidden="true" />}
                {option.label}
              </button>
            ))}
          </div>
          {!user && <p className="shelf-hint"><Link to="/login">Log in</Link> to track this book.</p>}

          {user?.customShelves?.length > 0 && (
            <div className="custom-shelves">
              <span className="custom-shelves-label">Your shelves</span>
              <div className="custom-shelves-list">
                {user.customShelves.map(name => {
                  const active = activeCustomShelves.includes(name);
                  return (
                    <button key={name} className={`chip ${active ? 'is-active' : ''}`} aria-pressed={active} onClick={() => toggleCustomShelf(name)}>
                      {active ? <Check size={12} aria-hidden="true" /> : '+'} {name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        <div className="book-main">
          <h1 className="book-title">{book.title}</h1>
          <p className="book-author">by {book.author}</p>

          <div className="book-facts">
            <span className="book-fact rating">
              <Star size={15} fill="currentColor" aria-hidden="true" />
              {book.ratingsCount > 0 ? `${book.averageRating.toFixed(1)} · ${book.ratingsCount} ${book.ratingsCount === 1 ? 'rating' : 'ratings'}` : 'No ratings yet'}
            </span>
            {book.publishedYear && <span className="book-fact"><Calendar size={14} aria-hidden="true" /> {book.publishedYear}</span>}
            {book.pageCount && <span className="book-fact"><FileText size={14} aria-hidden="true" /> {book.pageCount} pages</span>}
          </div>

          {book.genres?.length > 0 && (
            <div className="book-genres">
              {book.genres.slice(0, 5).map(g => <span key={g} className="genre-chip">{g}</span>)}
            </div>
          )}

          <section className="book-description" aria-label="Description">
            {description === null ? (
              [96, 92, 98, 70].map((w, i) => <div key={i} className="skeleton skeleton-text" style={{ width: `${w}%` }} />)
            ) : cleaned ? (
              <>
                <div className="markdown"><ReactMarkdown>{shownDescription}</ReactMarkdown></div>
                {isLong && (
                  <button className="link-button" onClick={() => setDescriptionExpanded(v => !v)}>
                    {descriptionExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </>
            ) : (
              <p className="muted">No description is available for this book yet.</p>
            )}
          </section>

          <BookTags bookId={id} user={user} showToast={showToast} />

          <section className="ai-card">
            <div className="ai-card-header">
              <BrainCircuit size={18} aria-hidden="true" />
              <div>
                <h2>Should I read this?</h2>
                <p>A personal match score based on the books you've rated 5 stars.</p>
              </div>
            </div>
            {recommendation ? (
              <div className="markdown ai-card-result"><ReactMarkdown>{recommendation}</ReactMarkdown></div>
            ) : (
              <button className="btn-primary" onClick={getRecommendation} disabled={loadingRecommendation}>
                {loadingRecommendation ? 'Analyzing your reading history…' : 'Get my match score'}
              </button>
            )}
          </section>

          {book.isbn && <p className="book-meta-line">ISBN {book.isbn}</p>}
        </div>
      </div>

      <section className="reviews-section">
        <div className="reviews-header">
          <h2>Community reviews</h2>
          <button className="btn-secondary with-icon" onClick={getReviewSummary} disabled={loadingSummary || reviews.length === 0}>
            <Sparkles size={16} aria-hidden="true" />
            {loadingSummary ? 'Summarizing…' : 'Summarize with AI'}
          </button>
        </div>

        {reviewSummary && (
          <div className="review-summary">
            <h4>What readers are saying</h4>
            <div className="markdown"><ReactMarkdown>{reviewSummary}</ReactMarkdown></div>
          </div>
        )}

        {user ? (
          <form className="review-form" onSubmit={submitReview}>
            <h3>{myReview ? 'Your review' : 'Rate and review'}</h3>
            <div className="star-rating-input" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHoverRating(0)}>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  type="button"
                  key={star}
                  role="radio"
                  aria-checked={rating === star}
                  aria-label={`${star} star${star > 1 ? 's' : ''}`}
                  className={`star-icon ${(hoverRating || rating) >= star ? 'active' : ''}`}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                >
                  ★
                </button>
              ))}
            </div>
            <label htmlFor="review-text" className="visually-hidden">Your review</label>
            <textarea
              id="review-text"
              placeholder="What did you think? (optional)"
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              className="input-field"
              rows="4"
              maxLength={5000}
            />
            <button type="submit" className="btn-primary" disabled={submittingReview}>
              {submittingReview ? 'Saving…' : myReview ? 'Update review' : 'Post review'}
            </button>
          </form>
        ) : (
          <div className="empty-state" style={{ marginBottom: '2rem' }}>
            <p><Link to="/login" style={{ textDecoration: 'underline' }}>Log in</Link> to rate and review this book.</p>
          </div>
        )}

        <div className="reviews-list">
          {reviewsLoading ? (
            [0, 1].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12 }} />)
          ) : reviews.length > 0 ? (
            reviews.map(review => <ReviewItem key={review._id} review={review} user={user} bookId={id} fetchReviews={fetchReviews} />)
          ) : (
            <p className="muted">No reviews yet. Be the first to share your thoughts!</p>
          )}
        </div>
      </section>

      <div className="ai-chat-widget">
        {chatOpen ? (
          <div className="ai-chat-window" role="dialog" aria-label="Book Sommelier chat">
            <div className="ai-chat-header">
              <h4><Bot size={20} aria-hidden="true" /> Book Sommelier</h4>
              <button onClick={() => setChatOpen(false)} aria-label="Close chat"><X size={20} /></button>
            </div>

            <div className="ai-chat-messages">
              {chatHistory.length === 0 && (
                <div className="ai-chat-empty">
                  Ask anything about <strong>{book.title}</strong>: themes, characters, or whether it's right for you. Spoiler-free unless you ask.
                </div>
              )}
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`ai-chat-bubble ${msg.role === 'user' ? 'from-user' : 'from-ai'} ${msg.isError ? 'is-error' : ''}`}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ))}
              {chatLoading && (
                <div className="ai-chat-bubble from-ai typing" aria-label="AI is typing">
                  <span /><span /><span />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessageToAI} className="ai-chat-form">
              <label htmlFor="chat-input" className="visually-hidden">Message</label>
              <input
                id="chat-input"
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about the book…"
                maxLength={1000}
                autoComplete="off"
              />
              <button type="submit" disabled={chatLoading || !chatInput.trim()} aria-label="Send">
                <SendHorizontal size={18} />
              </button>
            </form>
          </div>
        ) : (
          <button className="ai-chat-fab" onClick={() => setChatOpen(true)} aria-label="Ask the AI about this book">
            <MessageSquareText size={24} aria-hidden="true" />
            <span>Ask AI</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default BookDetail;
