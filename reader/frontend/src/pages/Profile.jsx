import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { AuthContext } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import './Profile.css';
import { FALLBACK_IMAGE } from '../assets/fallbackImage';

const Profile = () => {
  const [shelves, setShelves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookToRemove, setBookToRemove] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);
  const { user, updateUser } = useContext(AuthContext);

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

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    try {
      setUploadingPhoto(true);
      const config = { 
        headers: { 
          Authorization: `Bearer ${user.token}`,
          'Content-Type': 'multipart/form-data'
        } 
      };
      const { data } = await axios.put(`${import.meta.env.VITE_API_URL}/api/auth/profile/photo`, formData, config);
      updateUser(data);
    } catch (error) {
      console.error(error);
      alert('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
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
        <div className="avatar" style={{ position: 'relative', cursor: 'pointer', overflow: 'hidden' }} onClick={() => fileInputRef.current?.click()} title="Change Photo">
          {user.avatar ? (
            <img src={`${import.meta.env.VITE_API_URL}${user.avatar}`} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            user.name.charAt(0).toUpperCase()
          )}
          {uploadingPhoto && <div style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><div className="spinner" style={{width: '20px', height: '20px', borderTopColor: '#fff', borderRightColor: '#fff'}}></div></div>}
        </div>
        <div className="profile-info">
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <button className="btn-secondary" style={{ marginTop: '1rem', padding: '0.4rem 0.8rem', fontSize: '0.9rem' }} onClick={() => fileInputRef.current?.click()}>
            Change Photo
          </button>
          <input type="file" style={{ display: 'none' }} ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" />
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
                        <img 
                          src={book.coverImage ? book.coverImage.replace('-S.jpg', '-L.jpg').replace('-M.jpg', '-L.jpg') : FALLBACK_IMAGE} 
                          alt={book.title} 
                          onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE; }}
                        />
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
