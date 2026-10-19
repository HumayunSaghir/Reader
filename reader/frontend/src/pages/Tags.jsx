import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { X, Layers } from 'lucide-react';
import BookCard, { BookGridSkeleton } from '../components/BookCard';
import usePageTitle from '../hooks/usePageTitle';
import './Home.css';
import './Tags.css';

const MAX_FILTER_TAGS = 5;

const Tags = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = (searchParams.get('tags') || '').split(',').map(t => t.trim()).filter(Boolean);
  const selectedKey = selected.join(',');

  const [allTags, setAllTags] = useState([]);
  const [tagQuery, setTagQuery] = useState('');
  const [books, setBooks] = useState([]);
  // Page is tied to the tag selection so changing tags always restarts at page 1
  const [pageState, setPageState] = useState({ key: selectedKey, page: 1 });
  const page = pageState.key === selectedKey ? pageState.page : 1;
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  usePageTitle(selected.length ? selected.map(t => `#${t}`).join(' + ') : 'Browse by trope');

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      try {
        const { data } = await api.get(`/api/tags?limit=40&q=${encodeURIComponent(tagQuery.trim())}`);
        setAllTags(data);
      } catch (error) {
        console.error(error);
      }
    }, 200);
    return () => clearTimeout(timeoutId);
  }, [tagQuery]);

  useEffect(() => {
    if (!selectedKey) {
      setBooks([]);
      setHasMore(false);
      return;
    }
    let cancelled = false;
    const fetchBooks = async () => {
      setLoading(true);
      if (page === 1) setBooks([]);
      try {
        const { data } = await api.get(`/api/tags/books?tags=${encodeURIComponent(selectedKey)}&page=${page}`);
        if (cancelled) return;
        setBooks(prev => (page === 1 ? data.books : [...prev, ...data.books]));
        setHasMore(data.hasMore);
      } catch (error) {
        console.error(error);
      }
      if (!cancelled) setLoading(false);
    };
    fetchBooks();
    return () => { cancelled = true; };
  }, [selectedKey, page]);

  const setSelected = (tags) => {
    if (tags.length === 0) setSearchParams({});
    else setSearchParams({ tags: tags.join(',') });
  };

  const toggleTag = (tag) => {
    if (selected.includes(tag)) setSelected(selected.filter(t => t !== tag));
    else if (selected.length < MAX_FILTER_TAGS) setSelected([...selected, tag]);
  };

  return (
    <div className="home tags-page">
      <div className="hero-minimal" style={{ padding: '2rem 0' }}>
        <span className="hero-tag">MICRO-TROPES</span>
        <h1>Find books by the<br/>tiny things you love.</h1>
        <p className="hero-subtext">Pick one or more tropes. We'll show books readers tagged with all of them.</p>
      </div>

      <div className="tags-filter">
        <input
          type="text"
          className="input-field tags-search"
          placeholder="Search tropes..."
          value={tagQuery}
          onChange={(e) => setTagQuery(e.target.value)}
        />
        <div className="tags-cloud">
          {allTags.map(t => (
            <button
              key={t.tag}
              className={`niche-pill ${selected.includes(t.tag) ? 'active' : ''}`}
              onClick={() => toggleTag(t.tag)}
              disabled={!selected.includes(t.tag) && selected.length >= MAX_FILTER_TAGS}
            >
              #{t.tag} <span className="tags-cloud-count">{t.bookCount}</span>
            </button>
          ))}
          {allTags.length === 0 && (
            <p className="tags-empty">
              {tagQuery ? 'No tropes match that search.' : 'No tropes yet. Open any book and be the first to tag it!'}
            </p>
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="tags-selected-bar">
          <div className="tags-selected">
            <span className="tags-selected-label">Showing books with</span>
            {selected.map(tag => (
              <button key={tag} className="tags-selected-pill" onClick={() => toggleTag(tag)}>
                #{tag} <X size={14} />
              </button>
            ))}
            {selected.length > 1 && (
              <button className="tags-clear" onClick={() => setSelected([])}>Clear all</button>
            )}
          </div>
          <Link to={`/discover?tags=${encodeURIComponent(selectedKey)}`} className="btn-primary tags-swipe-btn">
            <Layers size={16} /> Swipe through these
          </Link>
        </div>
      )}

      {selected.length === 0 ? null : loading && books.length === 0 ? (
        <BookGridSkeleton count={12} />
      ) : (
        <>
          <div className="books-grid">
            {books.map((book) => <BookCard key={book._id} book={book} />)}
          </div>
          {books.length === 0 && (
            <div className="empty-state">No books have all of these tropes yet. Try removing one.</div>
          )}
          {hasMore && (
            <div className="load-more">
              <button className="btn-secondary" onClick={() => setPageState({ key: selectedKey, page: page + 1 })} disabled={loading}>
                {loading ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Tags;
