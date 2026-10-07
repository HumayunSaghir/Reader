import React, { useState } from 'react';
import axios from 'axios';
import './ReviewItem.css';

const ReplyNode = ({ reply, allReplies, user, bookId, reviewId, fetchReviews, setShowLikesModal, toggleLikeReply, requestDeleteReply }) => {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState('');
  
  const hasLikedReply = user && reply.likes?.some(l => l._id === user._id);
  const children = allReplies.filter(r => r.parentReplyId === reply._id);

  const deleteReplyAction = () => {
    requestDeleteReply(reply._id);
  };

  const submitReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.post(`${import.meta.env.VITE_API_URL}/api/books/${bookId}/reviews/${reviewId}/replies`, { 
        text: replyText,
        parentReplyId: reply._id
      }, config);
      setReplyText('');
      setShowReplyForm(false);
      fetchReviews();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="reply-item">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
        {reply.user?.avatar ? (
          <img src={`${import.meta.env.VITE_API_URL}${reply.user.avatar}`} alt="Avatar" className="reply-avatar" />
        ) : (
          <div className="reply-avatar-placeholder">{reply.user?.name?.charAt(0).toUpperCase() || 'A'}</div>
        )}
        <span className="reply-user">{reply.user?.name || 'Anonymous'}</span>
        <span className="reply-date">{new Date(reply.createdAt).toLocaleDateString()}</span>
      </div>
      <p className="reply-text">{reply.text}</p>
      <div className="reply-actions">
        <button className={`action-btn small ${hasLikedReply ? 'liked' : ''}`} onClick={() => toggleLikeReply(reply._id)}>
          {hasLikedReply ? '❤️' : '🤍'} Like ({reply.likes?.length || 0})
        </button>
        {reply.likes?.length > 0 && (
          <span className="view-likes-link small" onClick={() => setShowLikesModal({ show: true, title: 'Reply Likes', likes: reply.likes })}>View Likes</span>
        )}
        <button className="action-btn small" onClick={() => setShowReplyForm(!showReplyForm)}>💬 Reply</button>
        {user && reply.user?._id === user._id && (
          <button className="action-btn small" style={{ color: '#EF4444' }} onClick={deleteReplyAction}>🗑️ Delete</button>
        )}
      </div>

      {showReplyForm && (
        <form className="reply-form" onSubmit={submitReply} style={{ marginTop: '10px' }}>
          <input type="text" placeholder="Write a reply..." value={replyText} onChange={e => setReplyText(e.target.value)} className="input-field" style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }} />
          <button type="submit" className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Post</button>
        </form>
      )}

      {children.length > 0 && (
        <div className="replies-list" style={{ marginTop: '10px' }}>
          {children.map(child => (
            <ReplyNode 
              key={child._id} 
              reply={child} 
              allReplies={allReplies} 
              user={user} 
              bookId={bookId} 
              reviewId={reviewId} 
              fetchReviews={fetchReviews} 
              setShowLikesModal={setShowLikesModal} 
              toggleLikeReply={toggleLikeReply} 
              requestDeleteReply={requestDeleteReply}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ReviewItem = ({ review, user, bookId, fetchReviews }) => {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showLikesModal, setShowLikesModal] = useState({ show: false, title: '', likes: [] });
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'review' | 'reply', id: string }

  const hasLikedReview = user && review.likes?.some(like => like._id === user._id);
  const rootReplies = (review.replies || []).filter(r => !r.parentReplyId);

  const requestDeleteReview = () => {
    setDeleteTarget({ type: 'review', id: review._id });
  };

  const requestDeleteReply = (replyId) => {
    setDeleteTarget({ type: 'reply', id: replyId });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      if (deleteTarget.type === 'review') {
        await axios.delete(`${import.meta.env.VITE_API_URL}/api/books/${bookId}/reviews/${review._id}`, config);
      } else {
        await axios.delete(`${import.meta.env.VITE_API_URL}/api/books/${bookId}/reviews/${review._id}/replies/${deleteTarget.id}`, config);
      }
      setDeleteTarget(null);
      fetchReviews();
    } catch (error) {
      console.error(error);
      alert('Failed to delete');
    }
  };

  const toggleLikeReview = async () => {
    if (!user) return alert('Please login to like');
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.put(`${import.meta.env.VITE_API_URL}/api/books/${bookId}/reviews/${review._id}/like`, {}, config);
      fetchReviews();
    } catch (error) {
      console.error(error);
    }
  };

  const submitReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.post(`${import.meta.env.VITE_API_URL}/api/books/${bookId}/reviews/${review._id}/replies`, { text: replyText }, config);
      setReplyText('');
      setShowReplyForm(false);
      fetchReviews();
    } catch (error) {
      console.error(error);
    }
  };

  const toggleLikeReply = async (replyId) => {
    if (!user) return alert('Please login to like');
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.put(`${import.meta.env.VITE_API_URL}/api/books/${bookId}/reviews/${review._id}/replies/${replyId}/like`, {}, config);
      fetchReviews();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="review-card glass-panel">
      <div className="review-header" style={{ marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {review.user?.avatar ? (
            <img src={`${import.meta.env.VITE_API_URL}${review.user.avatar}`} alt="Avatar" className="reviewer-avatar" />
          ) : (
            <div className="reviewer-avatar-placeholder">{review.user?.name?.charAt(0).toUpperCase() || 'A'}</div>
          )}
          <div>
            <span className="reviewer-name" style={{ display: 'block' }}>{review.user?.name || 'Anonymous'}</span>
            <span className="review-date" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(review.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <span className="review-rating">{'⭐'.repeat(review.rating)}</span>
      </div>
      <p className="review-text" style={{ marginTop: '0.5rem' }}>{review.reviewText}</p>
      
      <div className="review-actions">
        <button className={`action-btn ${hasLikedReview ? 'liked' : ''}`} onClick={toggleLikeReview}>
          {hasLikedReview ? '❤️' : '🤍'} Like ({review.likes?.length || 0})
        </button>
        {review.likes?.length > 0 && (
          <span className="view-likes-link" onClick={() => setShowLikesModal({ show: true, title: 'Review Likes', likes: review.likes })}>View Likes</span>
        )}
        <button className="action-btn" onClick={() => setShowReplyForm(!showReplyForm)}>💬 Reply ({review.replies?.length || 0})</button>
        {user && review.user?._id === user._id && (
          <button className="action-btn" style={{ color: '#EF4444' }} onClick={requestDeleteReview}>🗑️ Delete</button>
        )}
      </div>

      {showReplyForm && (
        <form className="reply-form" onSubmit={submitReply}>
          <input type="text" placeholder="Write a reply..." value={replyText} onChange={e => setReplyText(e.target.value)} className="input-field" style={{ flex: 1 }} />
          <button type="submit" className="btn-secondary">Post</button>
        </form>
      )}

      {rootReplies.length > 0 && (
        <div className="replies-list">
          {rootReplies.map(reply => (
            <ReplyNode 
              key={reply._id} 
              reply={reply} 
              allReplies={review.replies} 
              user={user} 
              bookId={bookId} 
              reviewId={review._id} 
              fetchReviews={fetchReviews} 
              setShowLikesModal={setShowLikesModal} 
              toggleLikeReply={toggleLikeReply} 
              requestDeleteReply={requestDeleteReply}
            />
          ))}
        </div>
      )}

      {showLikesModal.show && (
        <div className="custom-modal-overlay">
          <div className="custom-modal" style={{ maxWidth: '400px' }}>
            <h3>{showLikesModal.title}</h3>
            <div className="likes-list" style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '1rem' }}>
              {showLikesModal.likes.map(likeUser => (
                <div key={likeUser._id} style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0', padding: '10px', background: 'var(--bg-app)', borderRadius: '8px' }}>
                  {likeUser.avatar ? (
                    <img src={`${import.meta.env.VITE_API_URL}${likeUser.avatar}`} alt="Avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--brand-color)', color: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{likeUser.name.charAt(0).toUpperCase()}</div>
                  )}
                  <span style={{ fontWeight: 600 }}>{likeUser.name}</span>
                </div>
              ))}
            </div>
            <div className="modal-actions" style={{ marginTop: '1rem' }}>
              <button className="btn-secondary" onClick={() => setShowLikesModal({ show: false, title: '', likes: [] })}>Close</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="custom-modal-overlay">
          <div className="custom-modal" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '1rem' }}>Confirm Deletion</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              Are you sure you want to delete this {deleteTarget.type}? This action cannot be undone.
            </p>
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn-primary" style={{ background: '#EF4444', borderColor: '#EF4444', color: '#fff' }} onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewItem;
