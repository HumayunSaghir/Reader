import React, { useContext, useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../contexts/AuthContext';
import { FALLBACK_IMAGE } from '../assets/fallbackImage';
import './Navbar.css';

const Navbar = ({ toggleTheme, theme }) => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [liveResults, setLiveResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (searchQuery.trim().length > 2) {
        setIsSearching(true);
        try {
          const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/books/livesearch?query=${encodeURIComponent(searchQuery)}`);
          setLiveResults(data);
        } catch (e) {
          console.error(e);
        }
        setIsSearching(false);
      } else {
        setLiveResults([]);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMenuOpen(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
      setLiveResults([]);
      setMenuOpen(false);
    }
  };

  const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );

  const MoonIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );

  return (
    <nav className="navbar">
      <div className="container nav-container">
        <Link to="/" className="nav-brand" onClick={() => setMenuOpen(false)}>READER</Link>
        
        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? '✕' : '☰'}
        </button>
        
        <div className={`nav-links-wrapper ${menuOpen ? 'open' : ''}`}>
          {!isAuthPage && (
            <div className="nav-center-links">
              <Link to="/" className="nav-link" onClick={() => setMenuOpen(false)}>Home</Link>
              {user && <Link to="/profile" className="nav-link" onClick={() => setMenuOpen(false)}>My Books</Link>}
              <Link to="/" className="nav-link" onClick={() => setMenuOpen(false)}>Discover</Link>
            </div>
          )}

          <div className="nav-right" style={isAuthPage ? { marginLeft: 'auto' } : {}}>
            {!isAuthPage && (
              <div className="nav-search-container" style={{ position: 'relative' }}>
                <form onSubmit={handleSearch} className="nav-search-form">
                  <input 
                    type="text" 
                    placeholder="Search books or authors..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-field nav-search-input"
                  />
                </form>
                {searchQuery.trim().length > 2 && (
                  <div className="live-search-dropdown" style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, 
                    background: 'var(--bg-app)', border: '1px solid var(--border-color)', 
                    borderRadius: '8px', marginTop: '0.5rem', zIndex: 100, 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', overflow: 'hidden'
                  }}>
                    {isSearching ? <div style={{padding: '1rem', color: 'var(--text-muted)'}}>Searching...</div> : (
                      liveResults.length > 0 ? liveResults.map(b => (
                        <div key={b._id} 
                          onClick={() => { navigate(`/books/${b._id}`); setSearchQuery(''); setLiveResults([]); setMenuOpen(false); }}
                          style={{
                            padding: '0.75rem 1rem', cursor: 'pointer', display: 'flex', gap: '0.75rem', alignItems: 'center', borderBottom: '1px solid var(--border-color)'
                          }}
                        >
                          <img 
                            src={b.coverImage || FALLBACK_IMAGE} 
                            alt="Cover" 
                            style={{width: '32px', height: '48px', objectFit: 'cover', borderRadius: '4px'}} 
                            onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE; }}
                          />
                          <div>
                            <div style={{fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>{b.title}</div>
                            <div style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>{b.author}</div>
                          </div>
                        </div>
                      )) : <div style={{padding: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem'}}>No exact local matches. Press Enter to search globally.</div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <button onClick={toggleTheme} className="theme-toggle-icon" aria-label="Toggle theme">
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>

            {user ? (
              <div className="user-menu" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Link to="/profile" className="nav-link profile-link" onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {user.avatar ? (
                    <img src={`${import.meta.env.VITE_API_URL}${user.avatar}`} alt="Avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--brand-color)', color: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="profile-name">Profile</span>
                </Link>
                <button onClick={handleLogout} className="btn-logout">Logout</button>
              </div>
            ) : (
              <div className="user-menu">
                <Link to="/login" className="nav-link" onClick={() => setMenuOpen(false)}>Login</Link>
                <Link to="/register" className="btn-primary nav-btn-signup" onClick={() => setMenuOpen(false)}>Sign Up</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
