import React, { useState, useEffect, useRef, useContext } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../api/client';
import { AuthContext } from '../contexts/AuthContext';
import BookCard, { BookGridSkeleton } from '../components/BookCard';
import SignInPrompt from '../components/SignInPrompt';
import usePageTitle from '../hooks/usePageTitle';
import './Home.css';

const PAGE_SIZE = 24;

const Search = () => {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get('q') || '').trim();
  const { user } = useContext(AuthContext);
  usePageTitle(query ? `“${query}”` : 'Search');

  const [books, setBooks] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(Boolean(query));
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const requestId = useRef(0);

  const fetchPage = async (targetPage) => {
    const myRequest = ++requestId.current;
    if (targetPage === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const { data } = await api.get('/api/books/search', { params: { query, page: targetPage } });
      if (myRequest !== requestId.current) return;
      setBooks(prev => {
        if (targetPage === 1) return data;
        const seen = new Set(prev.map(b => b._id));
        return [...prev, ...data.filter(b => !seen.has(b._id))];
      });
      setPage(targetPage);
      setHasMore(data.length >= PAGE_SIZE);
    } catch (err) {
      if (myRequest === requestId.current) setError(errorMessage(err, 'Search failed.'));
    } finally {
      if (myRequest === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    setBooks([]);
    // Search is members-only on the API
    if (query && user) fetchPage(1);
    else setLoading(false);
  }, [query, user]);

  if (!user) {
    return <SignInPrompt message="Sign in to search for books by title, author or ISBN." />;
  }

  if (!query) {
    return (
      <div className="empty-state" style={{ marginTop: '2rem' }}>
        <h3>Search for a book</h3>
        <p>Use the search bar to find books by title, author or ISBN.</p>
      </div>
    );
  }

  return (
    <div className="search-page">
      <header className="page-header">
        <h1>Results for “{query}”</h1>
        {!loading && !error && <p>{books.length}{hasMore ? '+' : ''} {books.length === 1 ? 'book' : 'books'} found</p>}
      </header>

      {loading ? (
        <BookGridSkeleton count={12} />
      ) : error && books.length === 0 ? (
        <div className="empty-state">
          <h3>Search is temporarily unavailable</h3>
          <p style={{ marginBottom: '1rem' }}>{error}</p>
          <button className="btn-primary" onClick={() => fetchPage(1)}>Try again</button>
        </div>
      ) : books.length === 0 ? (
        <div className="empty-state">
          <h3>No books match “{query}”</h3>
          <p>Check the spelling, try fewer words, or search by author. You can also <Link to="/tags" style={{ textDecoration: 'underline' }}>browse by trope</Link>.</p>
        </div>
      ) : (
        <>
          <div className="books-grid">
            {books.map((book, i) => <BookCard key={book._id} book={book} eager={i < 6} />)}
          </div>
          {(hasMore || error) && (
            <div className="load-more">
              {error && <p className="load-more-error">{error}</p>}
              <button className="btn-secondary" onClick={() => fetchPage(page + 1)} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Show more results'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Search;
