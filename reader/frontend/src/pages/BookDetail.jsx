import React, { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../contexts/AuthContext';
import './BookDetail.css';
import { FALLBACK_IMAGE } from '../assets/fallbackImage';
import ReviewItem from '../components/ReviewItem';

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
          
          <div className="meta-info">
            {book.publishedYear && <p><strong>Published:</strong> {book.publishedYear}</p>}
            {book.isbn && <p><strong>ISBN:</strong> {book.isbn}</p>}
          </div>
        </div>
      </div>

      <div className="reviews-section">
        <h2>Community Reviews</h2>
        
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
    </div>
  );
};

export default BookDetail;
