import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../contexts/AuthContext';
import './BookDetail.css';
import { FALLBACK_IMAGE } from '../assets/fallbackImage';
import ReviewItem from '../components/ReviewItem';
import ReactMarkdown from 'react-markdown';
import { Bot, Sparkles, BrainCircuit, MessageSquareText, SendHorizontal, X } from 'lucide-react';

const BookDetail = () => {
  const { id } = useParams();
  const [book, setBook] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext);
  
  // review form state
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  
  const [shelfStatus, setShelfStatus] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // New AI Features State
  const [recommendation, setRecommendation] = useState(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // AI Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (chatOpen) {
      scrollToBottom();
    }
  }, [chatHistory, chatOpen]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchReviews = async () => {
    try {
      const { data: reviewsData } = await axios.get(`${import.meta.env.VITE_API_URL}/api/books/${id}/reviews`);
      setReviews(reviewsData);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const fetchBookAndReviews = async () => {
      try {
        const { data: bookData } = await axios.get(`${import.meta.env.VITE_API_URL}/api/books/${id}`);
        setBook(bookData);
        
        await fetchReviews();

        if (user) {
          const config = { headers: { Authorization: `Bearer ${user.token}` } };
          const { data: shelves } = await axios.get(`${import.meta.env.VITE_API_URL}/api/books/shelves`, config);
          const currentBookShelf = shelves.find(s => s.book._id === id);
          if (currentBookShelf) {
            setShelfStatus(currentBookShelf.status);
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };
    fetchBookAndReviews();
  }, [id, user]);

  const handleShelfUpdate = async (status) => {
    if (!user) return showToast("Please login first to add books.");
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.post(`${import.meta.env.VITE_API_URL}/api/books/${id}/shelf`, { status }, config);
      setShelfStatus(status);
      showToast(`Book successfully added to ${status.replace('-', ' ')}!`);
    } catch (error) {
      console.error(error);
      showToast("Failed to update shelf.");
    }
  };

  const removeShelf = async () => {
    if (!user) return showToast("Please login first.");
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/books/${id}/shelf`, config);
      setShelfStatus(null);
      showToast('Book removed from your shelf.');
    } catch (error) {
      console.error(error);
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!user) return showToast("Please login first to review.");
    if (rating === 0 || rating === '0') return showToast("Please provide a star rating (1-5).");
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.post(`${import.meta.env.VITE_API_URL}/api/books/${id}/reviews`, { rating, reviewText }, config);
      await fetchReviews();
      setReviewText('');
    } catch (error) {
      console.error(error);
    }
  };

  const sendMessageToAI = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    if (!user) {
      showToast("Please login to use the AI Book Sommelier.");
      return;
    }

    const newMessage = { role: 'user', content: chatInput };
    const currentHistory = [...chatHistory, newMessage];
    setChatHistory(currentHistory);
    setChatInput('');
    setChatLoading(true);

    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.post(`${import.meta.env.VITE_API_URL}/api/books/${id}/chat`, {
        message: newMessage.content,
        history: chatHistory
      }, config);
      
      setChatHistory([...currentHistory, { role: 'model', content: data.reply }]);
    } catch (error) {
      console.error(error);
      const errMsg = error.response?.data?.message || "Failed to get AI response.";
      setChatHistory([...currentHistory, { role: 'model', content: `⚠️ Error: ${errMsg}` }]);
    }
    setChatLoading(false);
  };

  const getRecommendation = async () => {
    if (!user) return showToast("Please login first to get a personalized recommendation.");
    setLoadingRecommendation(true);
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/books/${id}/recommendation`, config);
      setRecommendation(data.recommendation);
    } catch (error) {
      console.error(error);
      showToast("Failed to fetch recommendation.");
    }
    setLoadingRecommendation(false);
  };

  const getReviewSummary = async () => {
    setLoadingSummary(true);
    try {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/books/${id}/reviews/summary`);
      setReviewSummary(data.summary);
    } catch (error) {
      console.error(error);
      showToast("Failed to fetch review summary.");
    }
    setLoadingSummary(false);
  };

  if (loading) return (
    <div className="loading" style={{ padding: '4rem 0' }}>
      <div className="spinner"></div>
    </div>
  );
  if (!book) return <div className="loading">Book not found</div>;

  return (
    <div className="book-detail-page animate-fade-in">
      {toastMessage && (
        <div className="toast-notification">
          {toastMessage}
        </div>
      )}
      
      <div className="book-header">
        <div className="book-cover-large-container">
          <img 
            src={book.coverImage ? book.coverImage.replace('-S.jpg', '-L.jpg').replace('-M.jpg', '-L.jpg') : FALLBACK_IMAGE} 
            alt={book.title} 
            className="book-cover-large" 
            onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE; }}
          />
        </div>
        <div className="book-details-info">
          <h1>{book.title}</h1>
          <h3 className="author">by {book.author}</h3>
          
          <div className="stats">
            <span className="rating-pill">⭐ {book.averageRating?.toFixed(1) || '0.0'}</span>
            <span className="review-count">{book.ratingsCount || 0} reviews</span>
          </div>

          <div className="shelf-actions">
            <button className="btn-primary" onClick={() => handleShelfUpdate('want-to-read')}>Want to Read</button>
            <button className="btn-secondary" onClick={() => handleShelfUpdate('currently-reading')}>Reading</button>
            <button className="btn-secondary" onClick={() => handleShelfUpdate('read')}>Read</button>
            {shelfStatus && (
              <button className="btn-secondary" style={{ color: '#EF4444', borderColor: '#EF4444' }} onClick={removeShelf}>Remove from Shelf</button>
            )}
          </div>

          <p className="description">{book.description}</p>
          
          <div className="recommendation-box glass-panel" style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-secondary)' }}>
            <button className="btn-primary" onClick={getRecommendation} disabled={loadingRecommendation} style={{ width: '100%', marginBottom: recommendation ? '1rem' : '0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <BrainCircuit size={18} />
              {loadingRecommendation ? 'Analyzing your reading history...' : 'Should I Read This?'}
            </button>
            {recommendation && (
              <div className="recommendation-result" style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
                <ReactMarkdown>{recommendation}</ReactMarkdown>
              </div>
            )}
          </div>
          
          <div className="meta-info">
            {book.publishedYear && <p><strong>Published:</strong> {book.publishedYear}</p>}
            {book.isbn && <p><strong>ISBN:</strong> {book.isbn}</p>}
          </div>
        </div>
      </div>

      <div className="reviews-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0 }}>Community Reviews</h2>
          <button className="btn-secondary" onClick={getReviewSummary} disabled={loadingSummary || reviews.length === 0} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={16} />
            {loadingSummary ? 'Summarizing...' : 'Summarize with AI'}
          </button>
        </div>
        
        {reviewSummary && (
          <div className="review-summary-box glass-panel" style={{ padding: '1rem', marginBottom: '2rem', background: 'var(--bg-secondary)', borderLeft: '4px solid #10B981' }}>
            <h4 style={{ marginTop: 0, color: '#10B981' }}>AI Community Summary</h4>
            <ReactMarkdown>{reviewSummary}</ReactMarkdown>
          </div>
        )}
        
        {user ? (
          <form className="review-form glass-panel" onSubmit={submitReview}>
            <h4>Write a Review</h4>
            <div className="form-group">
              <label style={{ marginBottom: '0.5rem', display: 'block' }}>Rating</label>
              <div className="star-rating-input">
                {[1, 2, 3, 4, 5].map(star => (
                  <span 
                    key={star} 
                    className={`star-icon ${(hoverRating || rating) >= star ? 'active' : ''}`} 
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>
            <div className="form-group">
              <textarea placeholder="What did you think of this book?" value={reviewText} onChange={e => setReviewText(e.target.value)} className="input-field" rows="4"></textarea>
            </div>
            <button type="submit" className="btn-primary">Post Review</button>
          </form>
        ) : (
          <div className="login-prompt glass-panel">
            <p>Please login to leave a review.</p>
          </div>
        )}

        <div className="reviews-list">
          {reviews.map(review => (
            <ReviewItem key={review._id} review={review} user={user} bookId={id} fetchReviews={fetchReviews} />
          ))}
          {reviews.length === 0 && <p className="no-reviews">No reviews yet. Be the first!</p>}
        </div>
      </div>

      {/* AI Chat Floating Widget */}
      <div className="ai-chat-widget" style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 1000 }}>
        {!chatOpen && (
          <button 
            className="ai-chat-fab"
            onClick={() => setChatOpen(true)}
            style={{
              width: '60px', height: '60px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #10B981, #059669)',
              color: 'white', border: 'none', boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'transform 0.2s'
            }}
          >
            <MessageSquareText size={28} />
          </button>
        )}
        
        {chatOpen && (
          <div className="ai-chat-window glass-panel" style={{
            width: '350px', height: '500px', display: 'flex', flexDirection: 'column',
            borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            background: 'var(--bg-app)', border: '1px solid var(--border-color)'
          }}>
            <div className="ai-chat-header" style={{
              padding: '1rem', background: 'linear-gradient(135deg, #10B981, #059669)',
              color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bot size={20} /> Book Sommelier AI
              </h4>
              <button onClick={() => setChatOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
            </div>
            
            <div className="ai-chat-messages" style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {chatHistory.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem', fontSize: '0.9rem' }}>
                  Ask me anything about <strong>{book.title}</strong>! <br/>I can discuss themes, characters, or give a spoiler-free recommendation.
                </div>
              )}
              {chatHistory.map((msg, idx) => (
                <div key={idx} style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  background: msg.role === 'user' ? 'var(--bg-accent)' : 'var(--bg-secondary)',
                  color: msg.role === 'user' ? 'var(--text-main)' : 'var(--text-main)',
                  padding: '0.75rem 1rem', borderRadius: '12px', maxWidth: '85%',
                  borderBottomRightRadius: msg.role === 'user' ? '0' : '12px',
                  borderBottomLeftRadius: msg.role === 'model' ? '0' : '12px',
                  fontSize: '0.9rem', lineHeight: '1.5'
                }}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ))}
              {chatLoading && (
                <div style={{ alignSelf: 'flex-start', background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: '12px', borderBottomLeftRadius: '0' }}>
                  <div className="typing-indicator" style={{ display: 'flex', gap: '4px' }}>
                    <span style={{ animation: 'bounce 1s infinite' }}>.</span>
                    <span style={{ animation: 'bounce 1s infinite 0.2s' }}>.</span>
                    <span style={{ animation: 'bounce 1s infinite 0.4s' }}>.</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            
            <form onSubmit={sendMessageToAI} style={{ display: 'flex', padding: '0.75rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about the book..." 
                style={{ flex: 1, padding: '0.5rem 1rem', borderRadius: '20px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-main)' }}
              />
              <button type="submit" disabled={chatLoading} style={{
                background: 'var(--text-main)', color: 'var(--bg-app)', border: 'none', borderRadius: '50%',
                width: '36px', height: '36px', marginLeft: '0.5rem', cursor: chatLoading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <SendHorizontal size={18} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookDetail;
