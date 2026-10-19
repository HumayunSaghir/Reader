import React, { useState, useEffect, useRef, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Layers, Hash } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import BookCard, { BookGridSkeleton } from '../components/BookCard';
import ActivityFeed from '../components/ActivityFeed';
import { AuthContext } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import './Home.css';

const NICHES = ['All', 'Fiction', 'Fantasy', 'Science Fiction', 'Mystery', 'Thriller', 'Romance', 'History', 'Biography', 'Science', 'Self-help', 'Technology'];
const PAGE_SIZE = 40;

// Session cache so returning from a book page restores the list instantly
const readSession = (key, fallback) => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};
const writeSession = (key, value) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled: skip caching
  }
};

const Home = () => {
  usePageTitle(null);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState(() => readSession('home.view', 'discover'));
  const [niche, setNiche] = useState(() => readSession('home.niche', 'All'));
  const [books, setBooks] = useState(() => readSession('home.books', []));
  const [page, setPage] = useState(() => readSession('home.page', 1));
  const [hasMore, setHasMore] = useState(() => readSession('home.hasMore', true));
  const [loading, setLoading] = useState(books.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    writeSession('home.view', viewMode);
    writeSession('home.niche', niche);
    writeSession('home.books', books);
    writeSession('home.page', page);
    writeSession('home.hasMore', hasMore);
  }, [viewMode, niche, books, page, hasMore]);

  const fetchPage = async (targetNiche, targetPage) => {
    const myRequest = ++requestId.current;
    if (targetPage === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const params = { page: targetPage };
      if (targetNiche !== 'All') params.category = targetNiche.toLowerCase();
      const { data } = await api.get('/api/books', { params });
      if (myRequest !== requestId.current) return;
      setBooks(prev => {
        if (targetPage === 1) return data;
        const seen = new Set(prev.map(b => b._id));
        return [...prev, ...data.filter(b => !seen.has(b._id))];
      });
      setPage(targetPage);
      setHasMore(data.length >= PAGE_SIZE);
    } catch (err) {
      if (myRequest === requestId.current) setError(errorMessage(err, 'Could not load books.'));
    } finally {
      if (myRequest === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  // First visit (nothing cached for this session)
  useEffect(() => {
    if (books.length === 0) fetchPage(niche, 1);
  }, []);

  const changeNiche = (next) => {
    if (next === niche) return;
    setNiche(next);
    setBooks([]);
    fetchPage(next, 1);
  };

  const submitSearch = (e) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="home">
      <section className="home-hero">
        <h1>Find your next favorite book.</h1>
        <p className="home-hero-sub">
          Track what you read, discover books by the tropes you love, and read along with friends.
        </p>
        <form className="home-search" onSubmit={submitSearch} role="search">
          <SearchIcon size={18} aria-hidden="true" />
          <label htmlFor="home-search" className="visually-hidden">Search books or authors</label>
          <input
            id="home-search"
            type="search"
            placeholder="Search by title, author or ISBN"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="btn-primary">Search</button>
        </form>
        <div className="home-hero-links">
          <Link to="/discover"><Layers size={15} /> Swipe to discover</Link>
          <Link to="/tags"><Hash size={15} /> Browse by trope</Link>
          {!user && <Link to="/register">Create a free account</Link>}
        </div>
      </section>

      <div className="home-tabs" role="tablist" aria-label="Home view">
        <button role="tab" aria-selected={viewMode === 'discover'} className={viewMode === 'discover' ? 'active' : ''} onClick={() => setViewMode('discover')}>
          Popular books
        </button>
        <button role="tab" aria-selected={viewMode === 'community'} className={viewMode === 'community' ? 'active' : ''} onClick={() => setViewMode('community')}>
          Community feed
        </button>
      </div>

      {viewMode === 'community' ? (
        <ActivityFeed />
      ) : (
        <>
          <div className="niches-scroller" role="toolbar" aria-label="Genres">
            {NICHES.map(n => (
              <button key={n} className={`niche-pill ${niche === n ? 'active' : ''}`} aria-pressed={niche === n} onClick={() => changeNiche(n)}>
                {n === 'All' ? 'Trending' : n}
              </button>
            ))}
          </div>

          {loading ? (
            <BookGridSkeleton count={18} />
          ) : error && books.length === 0 ? (
            <div className="empty-state">
              <h3>Couldn't load books</h3>
              <p style={{ marginBottom: '1rem' }}>{error}</p>
              <button className="btn-primary" onClick={() => fetchPage(niche, 1)}>Try again</button>
            </div>
          ) : books.length === 0 ? (
            <div className="empty-state"><h3>No books found in this genre</h3></div>
          ) : (
            <>
              <div className="books-grid">
                {books.map((book, index) => <BookCard key={book._id} book={book} eager={index < 6} />)}
              </div>
              {(hasMore || error) && (
                <div className="load-more">
                  {error && <p className="load-more-error">{error}</p>}
                  <button className="btn-secondary" onClick={() => fetchPage(niche, page + 1)} disabled={loadingMore}>
                    {loadingMore ? 'Loading…' : 'Load more books'}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Home;
