import React, { useContext, useState, useEffect, useRef } from 'react';
import { coverUrl } from '../utils/covers';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Moon, Sun, Menu, X, Search as SearchIcon } from 'lucide-react';
import api, { assetUrl } from '../api/client';
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef(null);

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  // Close menus whenever the route changes
  useEffect(() => {
    setMenuOpen(false);
    setDropdownOpen(false);
  }, [location.pathname]);

  // Lock page scroll behind the full-screen mobile menu
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  // Debounced typeahead; stale responses are ignored. Search is members-only, so
  // signed-out visitors get no suggestions (submitting shows a sign-in prompt).
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3 || !user) {
      setLiveResults([]);
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        const { data } = await api.get('/api/books/livesearch', { params: { query: q } });
        if (!cancelled) {
          setLiveResults(data);
          setHighlighted(-1);
        }
      } catch {
        if (!cancelled) setLiveResults([]);
      }
      if (!cancelled) setIsSearching(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [searchQuery, user]);

  useEffect(() => {
    const onClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const openBook = (book) => {
    navigate(`/books/${book._id}`);
    setSearchQuery('');
    setLiveResults([]);
    setDropdownOpen(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (highlighted >= 0 && liveResults[highlighted]) {
      openBook(liveResults[highlighted]);
      return;
    }
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setLiveResults([]);
      setDropdownOpen(false);
    }
  };

  const onSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      setDropdownOpen(false);
      return;
    }
    if (!liveResults.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDropdownOpen(true);
      setHighlighted(i => (i + 1) % liveResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(i => (i <= 0 ? liveResults.length - 1 : i - 1));
    }
  };

  const showDropdown = dropdownOpen && searchQuery.trim().length >= 3;
  const navClass = ({ isActive }) => `nav-link ${isActive ? 'active' : ''}`;

  return (
    <nav className="navbar" aria-label="Main">
      <div className="container nav-container">
        <Link to="/" className="nav-brand">READER</Link>

        <button
          className="hamburger"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={26} /> : <Menu size={26} />}
        </button>

        <div className={`nav-links-wrapper ${menuOpen ? 'open' : ''}`}>
          {!isAuthPage && (
            <div className="nav-center-links">
              <NavLink to="/" end className={navClass}>Home</NavLink>
              <NavLink to="/discover" className={navClass}>Swipe</NavLink>
              <NavLink to="/tags" className={navClass}>Tropes</NavLink>
              <NavLink to="/clubs" className={navClass}>Book Clubs</NavLink>
              {user && <NavLink to="/profile" className={navClass}>My Books</NavLink>}
            </div>
          )}

          <div className="nav-right" style={isAuthPage ? { marginLeft: 'auto' } : {}}>
            {!isAuthPage && (
              <div className="nav-search-container" ref={searchRef}>
                <form onSubmit={handleSearch} className="nav-search-form" role="search">
                  <SearchIcon size={16} className="nav-search-icon" aria-hidden="true" />
                  <input
                    type="search"
                    placeholder="Search books or authors…"
                    aria-label="Search books or authors"
                    aria-expanded={showDropdown}
                    aria-controls="live-search-results"
                    autoComplete="off"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setDropdownOpen(true); }}
                    onFocus={() => setDropdownOpen(true)}
                    onKeyDown={onSearchKeyDown}
                    className="input-field nav-search-input"
                  />
                </form>
                {showDropdown && (
                  <div className="live-search-dropdown" id="live-search-results" role="listbox">
                    {!user ? (
                      <div className="live-search-status"><Link to="/login">Log in</Link> to search books.</div>
                    ) : isSearching && liveResults.length === 0 ? (
                      <div className="live-search-status">Searching…</div>
                    ) : liveResults.length > 0 ? (
                      <>
                        {liveResults.map((b, i) => (
                          <button
                            key={b._id}
                            type="button"
                            role="option"
                            aria-selected={highlighted === i}
                            className={`live-search-item ${highlighted === i ? 'highlighted' : ''}`}
                            onMouseEnter={() => setHighlighted(i)}
                            onClick={() => openBook(b)}
                          >
                            <img
                              src={coverUrl(b.coverImage, 'S')}
                              alt=""
                              width="32"
                              height="48"
                              loading="lazy"
                              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_IMAGE; }}
                            />
                            <span>
                              <span className="live-search-title">{b.title}</span>
                              <span className="live-search-author">{b.author}</span>
                            </span>
                          </button>
                        ))}
                        <button type="button" className="live-search-all" onClick={handleSearch}>
                          See all results for “{searchQuery.trim()}”
                        </button>
                      </>
                    ) : (
                      <div className="live-search-status">No quick matches. Press Enter to search everywhere.</div>
                    )}
                  </div>
                )}
              </div>
            )}

            <button onClick={toggleTheme} className="theme-toggle-icon" aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            {user ? (
              <div className="user-menu">
                <Link to="/profile" className="nav-link profile-link">
                  {user.avatar ? (
                    <img src={assetUrl(user.avatar)} alt="" className="nav-avatar" />
                  ) : (
                    <span className="nav-avatar nav-avatar-initial">{user.name.charAt(0).toUpperCase()}</span>
                  )}
                  <span className="profile-name">{user.name.split(' ')[0]}</span>
                </Link>
                <button onClick={handleLogout} className="btn-logout">Log out</button>
              </div>
            ) : (
              <div className="user-menu">
                <Link to="/login" className="nav-link">Log in</Link>
                <Link to="/register" className="btn-primary nav-btn-signup">Sign up</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
