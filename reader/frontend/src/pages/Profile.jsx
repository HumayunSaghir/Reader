import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import './Profile.css';

const Profile = () => {
  const [shelves, setShelves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookToRemove, setBookToRemove] = useState(null);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    const fetchShelves = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/books/shelves`, config);
        setShelves(data);
        setLoading(false);
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };
    if (user) fetchShelves();
  }, [user]);

  const confirmRemoveBook = async () => {
    if (!bookToRemove) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/books/${bookToRemove}/shelf`, config);
      setShelves(shelves.filter(s => s.book._id !== bookToRemove));
      setBookToRemove(null);
    } catch (error) {
      console.error(error);
    }
  };

  if (!user) return <div className="loading">Please login</div>;
  if (loading) return (
    <div className="loading" style={{ padding: '4rem 0' }}>
      <div className="spinner"></div>
    </div>
  );

  const getBooksByStatus = (status) => shelves.filter(s => s.status === status).map(s => s.book);

  return (
    <div className="profile-page animate-fade-in">
      {bookToRemove && (
        <div className="custom-modal-overlay">
          <div className="custom-modal">
            <h3>Remove Book</h3>
            <p>Are you sure you want to remove this book from your shelf?</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setBookToRemove(null)}>Cancel</button>
              <button className="btn-primary" style={{ background: '#EF4444', borderColor: '#EF4444' }} onClick={confirmRemoveBook}>Remove</button>
            </div>
          </div>
        </div>
      )}

      <div className="profile-header">
        <div className="avatar">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="profile-info">
          <h2>{user.name}</h2>
          <p>{user.email}</p>
        </div>
      </div>

      <div className="shelves-container">
        {['currently-reading', 'want-to-read', 'read'].map(status => (
          <div key={status} className="shelf-section">
            <h3 className="shelf-title">{status.replace('-', ' ').toUpperCase()}</h3>
            <div className="shelf-books">
              {getBooksByStatus(status).length > 0 ? (
                <div className="mini-books-grid">
                  {getBooksByStatus(status).map(book => (
                    <div key={book._id} className="mini-book-wrapper">
                      <Link to={`/books/${book._id}`} className="mini-book-card">
                        <img src={book.coverImage ? book.coverImage.replace('-S.jpg', '-L.jpg').replace('-M.jpg', '-L.jpg') : 'https://via.placeholder.com/100x150?text=No+Cover'} alt={book.title} />
                        <p>{book.title}</p>
                      </Link>
                      <button className="remove-book-btn" onClick={(e) => { e.preventDefault(); setBookToRemove(book._id); }}>✕</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-shelf">No books in this shelf.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Profile;
