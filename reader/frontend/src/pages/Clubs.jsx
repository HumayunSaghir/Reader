import usePageTitle from '../hooks/usePageTitle';
import { coverUrl } from '../utils/covers';
import React, { useState, useEffect, useContext } from 'react';
import api from '../api/client';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { Users, Plus, Search, Trash2 } from 'lucide-react';
import { FALLBACK_IMAGE } from '../assets/fallbackImage';
import SignInPrompt from '../components/SignInPrompt';
import './Clubs.css';

const Clubs = () => {
  usePageTitle('Book clubs');
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  // Create form state
  const [clubName, setClubName] = useState('');
  const [clubDesc, setClubDesc] = useState('');
  const [totalChapters, setTotalChapters] = useState(12);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // Clubs are members-only on the API
    if (user) fetchClubs();
  }, [user]);

  // Live suggestions debounced as user types
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const query = searchQuery.trim();
        const { data } = await api.get(`/api/books/livesearch?query=${encodeURIComponent(query)}`);
        setSearchResults(data || []);
      } catch (error) {
        console.error('Book search error:', error);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchClubs = async () => {
    try {
      const { data } = await api.get(`/api/clubs`);
      setClubs(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch clubs', error);
      setLoading(false);
    }
  };

  const handleDeleteClub = async (e, clubToDelete) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${clubToDelete.name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await api.delete(`/api/clubs/${clubToDelete._id}`, config);
      setClubs(prev => prev.filter(c => c._id !== clubToDelete._id));
    } catch (error) {
      console.error('Failed to delete club:', error);
      alert(error.response?.data?.message || 'Failed to delete club');
    }
  };

  const handleSearchBook = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const { data } = await api.get(`/api/books/livesearch?query=${encodeURIComponent(searchQuery.trim())}`);
      setSearchResults(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setSearching(false);
    }
  };

  const handleCreateClub = async (e) => {
    e.preventDefault();
    if (!user) return alert('Please login to create a club');
    if (!selectedBook || !clubName) return alert('Please fill all fields and select a book');
    setCreating(true);

    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await api.post(`/api/clubs`, {
        name: clubName,
        description: clubDesc,
        bookId: selectedBook._id,
        totalChapters: Math.max(1, parseInt(totalChapters) || 10)
      }, config);
      navigate(`/clubs/${data._id}`);
    } catch (error) {
      console.error(error);
      alert('Failed to create club');
    } finally {
      setCreating(false);
    }
  };

  if (!user) {
    return <SignInPrompt message="Join a club to read together, track progress and chat without spoilers." />;
  }

  if (loading) {
    return <div className="loading" style={{ padding: '4rem 0' }}><div className="spinner"></div></div>;
  }

  return (
    <div className="clubs-page animate-fade-in">
      <div className="clubs-header glass-panel">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.5rem 0' }}><Users /> Live Book Clubs</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Read together, track progress, and chat without spoilers.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={18} /> {showCreate ? 'Cancel' : 'Create Club'}
        </button>
      </div>

      {showCreate && (
        <div className="create-club-form glass-panel animate-fade-in" style={{ marginBottom: '2rem', padding: '1.5rem', background: 'var(--bg-secondary)' }}>
          <h3>Create a New Book Club</h3>
          <form onSubmit={handleCreateClub}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Club Name</label>
              <input type="text" className="input-field" value={clubName} onChange={e => setClubName(e.target.value)} placeholder="e.g. Sci-Fi Sundays" required />
            </div>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Description</label>
              <textarea className="input-field" value={clubDesc} onChange={e => setClubDesc(e.target.value)} placeholder="What's this club about?"></textarea>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Total Chapters</label>
              <input 
                type="number" 
                min="1" 
                max="300"
                className="input-field" 
                value={totalChapters} 
                onChange={e => setTotalChapters(e.target.value)} 
                placeholder="e.g. 12" 
                required 
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginTop: '0.25rem' }}>
                Specify how many chapters are in this book to track member progress.
              </small>
            </div>
            
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Select a Book to Read</label>
              {selectedBook ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid #10B981' }}>
                  <img src={coverUrl(selectedBook.coverImage, 'S')} alt="Cover" style={{ height: '60px', width: '40px', objectFit: 'cover', borderRadius: '4px' }} onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE; }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedBook.title}</strong>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{selectedBook.author}</span>
                  </div>
                  <button type="button" className="btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => setSelectedBook(null)}>Change</button>
                </div>
              ) : (
                <div>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={searchQuery} 
                      onChange={e => setSearchQuery(e.target.value)} 
                      placeholder="Start typing book name (e.g. brief)..." 
                      style={{ width: '100%', paddingRight: '40px' }} 
                    />
                    <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                      {searching ? <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div> : <Search size={18} />}
                    </div>
                  </div>
                  
                  {searchResults.length > 0 && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }} className="custom-scrollbar">
                      {searchResults.map(book => (
                        <div 
                          key={book._id} 
                          onClick={() => { setSelectedBook(book); setSearchResults([]); setSearchQuery(''); }} 
                          style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 0.8rem', background: 'var(--bg-app)', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border-color)', transition: 'background 0.2s, border-color 0.2s' }} 
                          className="search-result-hover"
                        >
                          <img 
                            src={coverUrl(book.coverImage, 'S')} 
                            alt="Cover" 
                            style={{ height: '48px', width: '32px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} 
                            onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE; }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong style={{ display: 'block', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.title}</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{book.author}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                      No matching books found. Try a different title or keyword.
                    </div>
                  )}
                </div>
              )}
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center' }} disabled={!selectedBook || !clubName || creating}>
              {creating ? <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px', borderColor: 'var(--bg-app)', borderTopColor: 'transparent' }}></div> : 'Create Club'}
            </button>
          </form>
        </div>
      )}

      <div className="clubs-grid">
        {clubs.length === 0 && !showCreate && <p style={{ color: 'var(--text-muted)', textAlign: 'center', gridColumn: '1 / -1', padding: '3rem' }}>No book clubs found. Be the first to create one!</p>}
        {clubs.map(club => {
          const creatorId = club?.creator?._id 
            ? club.creator._id.toString() 
            : (club?.creator ? club.creator.toString() : null);
          const currentUserId = user?._id ? user._id.toString() : null;
          const isCreator = Boolean(currentUserId && creatorId && currentUserId === creatorId);

          return (
            <Link to={`/clubs/${club._id}`} key={club._id} className="club-card glass-panel" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', gap: '1rem', transition: 'transform 0.2s', padding: '1.5rem', position: 'relative' }}>
              <img 
                src={coverUrl(club.book?.coverImage, 'M')} 
                alt={club.book?.title} 
                style={{ width: '80px', height: '120px', objectFit: 'cover', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} 
                onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE; }}
              />
              <div className="club-info" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-main)', fontSize: '1.2rem' }}>{club.name}</h3>
                  {isCreator && (
                    <button 
                      onClick={(e) => handleDeleteClub(e, club)} 
                      title="Delete club"
                      className="card-delete-btn"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                <p style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)', fontSize: '0.9rem', flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {club.description || `Reading: ${club.book?.title}`}
                </p>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <Users size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    {club.members?.length || 0} Members
                  </div>
                  {club.creator && (
                    <div style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Created by {club.creator.name}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default Clubs;
