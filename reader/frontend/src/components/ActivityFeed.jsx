import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { FALLBACK_IMAGE } from '../assets/fallbackImage';
import './ActivityFeed.css';

const ActivityFeed = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/activities`);
        setActivities(data);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch activities:', error);
        setLoading(false);
      }
    };
    fetchActivities();
  }, []);

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(diff / 86400000);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="loading" style={{ padding: '4rem 0' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (activities.length === 0) {
    return <div className="loading">No recent activity found.</div>;
  }

  return (
    <div className="activity-feed">
      {activities.map((activity) => (
        <div key={activity._id} className="activity-card glass-panel">
          <div className="activity-header">
            <div className="user-info">
              <div className="avatar small">
                {activity.user?.avatar ? (
                  <img src={`${import.meta.env.VITE_API_URL}${activity.user.avatar}`} alt="Avatar" />
                ) : (
                  activity.user?.name?.charAt(0).toUpperCase()
                )}
              </div>
              <span className="user-name">{activity.user?.name}</span>
            </div>
            <span className="timestamp">{formatTime(activity.createdAt)}</span>
          </div>
          
          <div className="activity-content">
            <div className="activity-action">
              {activity.type === 'review' && (
                <p>
                  rated a book <strong>{activity.rating} stars</strong> and wrote a review.
                </p>
              )}
              {activity.type === 'shelf_status' && (
                <p>
                  added a book to <strong>{activity.status.replace('-', ' ')}</strong>.
                </p>
              )}
              {activity.type === 'shelf_custom' && (
                <p>
                  added a book to <strong>{activity.customShelf}</strong>.
                </p>
              )}
            </div>
            
            {activity.book && (
              <Link to={`/books/${activity.book._id}`} className="activity-book-card">
                <img 
                  src={activity.book.coverImage ? activity.book.coverImage.replace('-S.jpg', '-M.jpg') : FALLBACK_IMAGE} 
                  alt={activity.book.title}
                  onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE; }}
                />
                <div className="book-info">
                  <h4>{activity.book.title}</h4>
                  <p>{activity.book.author}</p>
                </div>
              </Link>
            )}
            
            {activity.type === 'review' && activity.reviewText && (
              <div className="activity-review-quote">
                "{activity.reviewText.length > 150 ? activity.reviewText.substring(0, 150) + '...' : activity.reviewText}"
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActivityFeed;
