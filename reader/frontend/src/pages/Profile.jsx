import usePageTitle from '../hooks/usePageTitle';
import { coverUrl } from '../utils/covers';
import React, { useState, useEffect, useContext, useRef } from 'react';
import api, { assetUrl } from '../api/client';
import { AuthContext } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import './Profile.css';
import { FALLBACK_IMAGE } from '../assets/fallbackImage';
import { Trash2, Plus } from 'lucide-react';
import ReadingHeatmap from '../components/ReadingHeatmap';
import ReadingChallenge from '../components/ReadingChallenge';

const Profile = () => {
  usePageTitle('My books');
  const [shelves, setShelves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookToRemove, setBookToRemove] = useState(null);
  const [shelfToRemove, setShelfToRemove] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [newShelfName, setNewShelfName] = useState('');
  const [creatingShelf, setCreatingShelf] = useState(false);
  const fileInputRef = useRef(null);
  const { user, updateUser } = useContext(AuthContext);

  useEffect(() => {
    const fetchShelves = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        const { data } = await api.get(`/api/books/shelves`, config);
        setShelves(data);
        setLoading(false);
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };
    if (user) fetchShelves();
  }, [user]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const confirmRemoveBook = async () => {
    if (!bookToRemove) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      if (bookToRemove.customShelf) {
        await api.post(`/api/books/${bookToRemove.id}/shelf`, {
          action: 'remove',
          customShelf: bookToRemove.customShelf
        }, config);
        
        setShelves(shelves.map(s => {
          if (s.book._id === bookToRemove.id) {
            return { ...s, customShelves: s.customShelves.filter(cs => cs !== bookToRemove.customShelf) };
          }
          return s;
        }).filter(s => s.status || (s.customShelves && s.customShelves.length > 0)));
      } else {
        await api.delete(`/api/books/${bookToRemove.id}/shelf`, config);
        setShelves(shelves.filter(s => s.book._id !== bookToRemove.id));
      }
      setBookToRemove(null);
      showToast('Book removed from shelf.');
    } catch (error) {
      console.error(error);
      showToast('Failed to remove book.');
    }
  };

  const handleCreateShelf = async (e) => {
    e.preventDefault();
    const shelfName = newShelfName.trim();
    if (!shelfName) return;
    
    if (['read', 'want-to-read', 'currently-reading'].includes(shelfName.toLowerCase().replace(' ', '-'))) {
      return showToast("Cannot use standard shelf names.");
    }
    if (user.customShelves && user.customShelves.some(s => s.toLowerCase() === shelfName.toLowerCase())) {
      return showToast("Shelf already exists!");
    }
    
    try {
      setCreatingShelf(true);
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await api.post(`/api/auth/profile/shelves`, { shelfName }, config);
      updateUser({ ...user, customShelves: data });
      setNewShelfName('');
      showToast(`Created shelf "${shelfName}"`);
    } catch (error) {
      console.error(error);
      showToast("Failed to create shelf.");
    } finally {
      setCreatingShelf(false);
    }
  };

  const confirmDeleteShelf = async () => {
    if (!shelfToRemove) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await api.delete(`/api/auth/profile/shelves/${encodeURIComponent(shelfToRemove)}`, config);
      updateUser({ ...user, customShelves: data });
      setShelves(shelves.map(s => ({
        ...s,
        customShelves: (s.customShelves || []).filter(cs => cs !== shelfToRemove)
      })).filter(s => s.status || (s.customShelves && s.customShelves.length > 0)));
      showToast(`Deleted shelf "${shelfToRemove}"`);
    } catch (error) {
      console.error(error);
      showToast("Failed to delete shelf.");
    } finally {
      setShelfToRemove(null);
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
      const { data } = await api.put(`/api/auth/profile/photo`, formData, config);
      updateUser(data);
      showToast('Profile photo updated successfully!');
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.message || 'Failed to upload photo';
      showToast(msg);
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!user) return <div className="loading">Please login</div>;
  if (loading) return (
    <div className="loading" style={{ padding: '4rem 0' }}>
      <div className="spinner"></div>
    </div>
  );

  const getBooksByStatus = (status) => shelves.filter(s => s.status === status).map(s => s.book);
  const getBooksByCustomShelf = (shelfName) => shelves.filter(s => s.customShelves && s.customShelves.includes(shelfName)).map(s => s.book);

  return (
    <div className="profile-page animate-fade-in">
      {toastMessage && (
        <div className="toast-notification">
          {toastMessage}
        </div>
      )}

      {bookToRemove && (
        <div className="custom-modal-overlay">
          <div className="custom-modal">
            <h3>Remove Book</h3>
            <p>Are you sure you want to remove this book from {bookToRemove.customShelf ? `"${bookToRemove.customShelf}"` : 'all your shelves'}?</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setBookToRemove(null)}>Cancel</button>
              <button className="btn-primary" style={{ background: '#EF4444', borderColor: '#EF4444' }} onClick={confirmRemoveBook}>Remove</button>
            </div>
          </div>
        </div>
      )}
      
      {shelfToRemove && (
        <div className="custom-modal-overlay">
          <div className="custom-modal">
            <h3>Delete Shelf</h3>
            <p>Are you sure you want to delete the shelf "{shelfToRemove}"? Books in this shelf will remain in their other shelves.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShelfToRemove(null)}>Cancel</button>
              <button className="btn-primary" style={{ background: '#EF4444', borderColor: '#EF4444' }} onClick={confirmDeleteShelf}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="profile-header">
        <div className="avatar" style={{ position: 'relative', cursor: 'pointer', overflow: 'hidden' }} onClick={() => fileInputRef.current?.click()} title="Change Photo">
          {user.avatar ? (
            <img src={assetUrl(user.avatar)} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
      
      {/* Yearly Reading Challenge & Spotify Wrapped */}
      <ReadingChallenge user={user} />

      {/* Reading Streaks & Heatmap Contribution Graph */}
      <ReadingHeatmap user={user} />
      
      <div className="create-shelf-section glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, whiteSpace: 'nowrap' }}>Custom Shelves</h3>
        <form onSubmit={handleCreateShelf} style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '250px' }}>
          <input 
            type="text" 
            placeholder="New shelf name... (e.g. Favorites 2026)" 
            value={newShelfName} 
            onChange={(e) => setNewShelfName(e.target.value)} 
            className="input-field" 
            style={{ margin: 0, flex: 1 }}
          />
          <button type="submit" className="btn-primary" disabled={creatingShelf || !newShelfName.trim()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} /> Add
          </button>
        </form>
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
                          src={coverUrl(book.coverImage, 'M')} 
                          alt={book.title} 
                          onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE; }}
                        />
                        <p>{book.title}</p>
                      </Link>
                      <button className="remove-book-btn" onClick={(e) => { e.preventDefault(); setBookToRemove({ id: book._id, customShelf: null }); }}>✕</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-shelf">No books in this shelf.</p>
              )}
            </div>
          </div>
        ))}
        
        {user.customShelves && user.customShelves.map(shelfName => (
          <div key={shelfName} className="shelf-section custom-shelf-section" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <h3 className="shelf-title" style={{ margin: 0, borderBottom: 'none', padding: 0 }}>{shelfName}</h3>
              <button 
                onClick={() => setShelfToRemove(shelfName)}
                style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}
              >
                <Trash2 size={16} /> Delete Shelf
              </button>
            </div>
            <div className="shelf-books">
              {getBooksByCustomShelf(shelfName).length > 0 ? (
                <div className="mini-books-grid">
                  {getBooksByCustomShelf(shelfName).map(book => (
                    <div key={book._id} className="mini-book-wrapper">
                      <Link to={`/books/${book._id}`} className="mini-book-card">
                        <img 
                          src={coverUrl(book.coverImage, 'M')} 
                          alt={book.title} 
                          onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE; }}
                        />
                        <p>{book.title}</p>
                      </Link>
                      <button className="remove-book-btn" onClick={(e) => { e.preventDefault(); setBookToRemove({ id: book._id, customShelf: shelfName }); }}>✕</button>
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
