import usePageTitle from '../hooks/usePageTitle';
import { coverUrl, coverSrcSet, onCoverError } from '../utils/covers';
import React, { useState, useEffect, useContext, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { Heart, X, RotateCcw, Info, Layers } from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';
import './Home.css';
import './Discover.css';

const SWIPE_THRESHOLD = 110;
const REFILL_AT = 5;
const MAX_UNDO = 20;
const NO_DESCRIPTION = 'No description provided.';
const CATEGORIES = ['All', 'Fiction', 'Fantasy', 'Mystery', 'Romance', 'Thriller', 'Science Fiction', 'History', 'Horror'];

// Medium covers are pre-cached by the server; high-density screens get the large one
const deckCover = (book) => coverUrl(book.coverImage, 'M');
const stripHtml = (text) => text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const Discover = () => {
  usePageTitle('Swipe to discover');
  const { user } = useContext(AuthContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const tagsParam = searchParams.get('tags') || '';
  const tagList = tagsParam.split(',').map(t => t.trim()).filter(Boolean);

  const [category, setCategory] = useState('All');
  const [deck, setDeck] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [descriptions, setDescriptions] = useState({});
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [leaving, setLeaving] = useState(null); // { id, direction } while the top card flies off
  const [expanded, setExpanded] = useState(false);
  const [likedCount, setLikedCount] = useState(0);
  const [toastMessage, setToastMessage] = useState(null);

  const dragStart = useRef(null);
  const busy = useRef(false);
  const requestId = useRef(0);
  const hydrating = useRef(new Set());
  const deckRef = useRef(deck);
  useEffect(() => {
    deckRef.current = deck;
  });

  const filterKey = `${category}|${tagsParam}`;

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const authConfig = () => ({ headers: { Authorization: `Bearer ${user.token}` } });

  const loadCards = async (reset) => {
    if (!user) return;
    // A reset invalidates any refill still in flight for the old filter
    const myRequest = reset ? ++requestId.current : requestId.current;
    if (reset) setLoading(true);
    else setFetchingMore(true);

    const params = new URLSearchParams({ limit: '20' });
    if (tagsParam) params.set('tags', tagsParam);
    else if (category !== 'All') params.set('category', category.toLowerCase());
    const currentIds = reset ? [] : deckRef.current.map(b => b._id);
    if (currentIds.length > 0) params.set('exclude', currentIds.join(','));

    try {
      const { data } = await api.get(`/api/books/discover?${params}`, authConfig());
      if (myRequest !== requestId.current) return;
      const known = new Set(currentIds);
      const fresh = data.filter(b => !known.has(b._id));
      setDeck(prev => (reset ? fresh : [...prev, ...fresh]));
      setExhausted(fresh.length === 0);
    } catch (error) {
      console.error(error);
      if (myRequest !== requestId.current) return;
      showToast('Failed to load books.');
      setExhausted(true);
    }
    if (myRequest === requestId.current) {
      setLoading(false);
      setFetchingMore(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setDeck([]);
    setExhausted(false);
    loadCards(true);
  }, [filterKey, user]);

  useEffect(() => {
    if (user && !loading && !fetchingMore && !exhausted && deck.length < REFILL_AT) {
      loadCards(false);
    }
  }, [deck.length, loading, fetchingMore, exhausted]);

  // Open Library covers are slow, so start loading them before cards reach the top
  useEffect(() => {
    deck.slice(3, 10).forEach(book => {
      const img = new Image();
      img.src = deckCover(book);
    });
  }, [deck]);

  // Most Open Library books arrive without a description; fetching the book fills it in
  useEffect(() => {
    deck.slice(0, 3).forEach(async (book) => {
      if (book.description && book.description !== NO_DESCRIPTION) return;
      if (hydrating.current.has(book._id)) return;
      hydrating.current.add(book._id);
      try {
        const { data } = await api.get(`/api/books/${book._id}/description`);
        setDescriptions(prev => ({ ...prev, [book._id]: data.description }));
      } catch {
        setDescriptions(prev => ({ ...prev, [book._id]: '' }));
      }
    });
  }, [deck]);

  const swipe = async (direction) => {
    const book = deck[0];
    if (!book || busy.current) return;
    busy.current = true;
    setLeaving({ id: book._id, direction });
    try {
      const [{ data }] = await Promise.all([
        api.post(`/api/books/${book._id}/swipe`, { direction }, authConfig()),
        new Promise(resolve => setTimeout(resolve, 300))
      ]);
      setDeck(prev => prev.filter(b => b._id !== book._id));
      setHistory(prev => [...prev.slice(-(MAX_UNDO - 1)), { book, direction, added: data.added }]);
      if (direction === 'right') {
        if (data.added) setLikedCount(c => c + 1);
        else showToast('Already on your shelves.');
      }
    } catch (error) {
      console.error(error);
      showToast('Could not save that swipe. Try again.');
    }
    setLeaving(null);
    setExpanded(false);
    setDrag({ x: 0, y: 0, active: false });
    busy.current = false;
  };

  const undo = async () => {
    const last = history[history.length - 1];
    if (!last || busy.current) return;
    busy.current = true;
    try {
      // A right swipe on an already-shelved book changed nothing, so there's nothing to revert
      if (last.direction === 'left' || last.added) {
        await api.delete(`/api/books/${last.book._id}/swipe?direction=${last.direction}`, authConfig());
      }
      setHistory(prev => prev.slice(0, -1));
      setDeck(prev => [last.book, ...prev.filter(b => b._id !== last.book._id)]);
      if (last.direction === 'right' && last.added) setLikedCount(c => Math.max(0, c - 1));
      setExpanded(false);
    } catch (error) {
      console.error(error);
      showToast('Could not undo. Try again.');
    }
    busy.current = false;
  };

  // Keyboard shortcuts always call the latest handlers
  const handlers = useRef({ swipe, undo });
  useEffect(() => {
    handlers.current = { swipe, undo };
  });
  useEffect(() => {
    const onKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowRight') handlers.current.swipe('right');
      else if (e.key === 'ArrowLeft') handlers.current.swipe('left');
      else if (e.key === 'Backspace' || e.key.toLowerCase() === 'z') handlers.current.undo();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const onPointerDown = (e) => {
    if (busy.current || e.button > 0) return;
    dragStart.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ x: 0, y: 0, active: true });
  };

  const onPointerMove = (e) => {
    if (!dragStart.current) return;
    setDrag({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y, active: true });
  };

  const onPointerUp = () => {
    if (!dragStart.current) return;
    dragStart.current = null;
    if (Math.abs(drag.x) > SWIPE_THRESHOLD) {
      setDrag(d => ({ ...d, active: false }));
      swipe(drag.x > 0 ? 'right' : 'left');
    } else {
      // Barely moved: treat it as a tap that toggles the full description
      if (Math.abs(drag.x) < 5 && Math.abs(drag.y) < 5) setExpanded(v => !v);
      setDrag({ x: 0, y: 0, active: false });
    }
  };

  const changeCategory = (cat) => {
    if (cat === category && !tagsParam) return;
    if (tagsParam) setSearchParams({});
    setCategory(cat);
  };

  const topCardStyle = () => {
    let { x, y } = drag;
    if (leaving) {
      x = (leaving.direction === 'right' ? 1 : -1) * Math.max(window.innerWidth, 800);
      y = drag.y + 60;
    }
    const rotate = Math.max(-25, Math.min(25, x / 18));
    return {
      transform: `translate(${x}px, ${y}px) rotate(${rotate}deg)`,
      transition: drag.active ? 'none' : 'transform 0.3s ease'
    };
  };

  // Cards underneath grow towards the front as the top card is dragged away
  const dragProgress = leaving ? 1 : Math.min(Math.abs(drag.x) / SWIPE_THRESHOLD, 1);
  const stackCardStyle = (depth) => {
    const effective = Math.max(depth - dragProgress, 0);
    return {
      transform: `translateY(${effective * 14}px) scale(${1 - effective * 0.05})`,
      transition: drag.active ? 'none' : 'transform 0.3s ease'
    };
  };

  const likeOpacity = leaving ? (leaving.direction === 'right' ? 1 : 0) : Math.max(0, Math.min(drag.x / 100, 1));
  const nopeOpacity = leaving ? (leaving.direction === 'left' ? 1 : 0) : Math.max(0, Math.min(-drag.x / 100, 1));

  if (!user) {
    return (
      <div className="discover-page">
        <div className="hero-minimal" style={{ padding: '2rem 0' }}>
          <span className="hero-tag">DISCOVER</span>
          <h1>Swipe your way to<br/>your next read.</h1>
          <p className="hero-subtext">Swipe right to add a book to Want to Read, left to skip it.</p>
        </div>
        <div className="discover-empty">
          <p>Log in to start swiping.</p>
          <Link to="/login" className="btn-primary">Login</Link>
        </div>
      </div>
    );
  }

  const visible = deck.slice(0, 3);
  const top = deck[0];

  return (
    <div className="discover-page">
      {toastMessage && <div className="toast-notification">{toastMessage}</div>}

      <div className="discover-header">
        <h1>Swipe your way to your next read.</h1>
        <p className="hero-subtext">Right adds it to Want to Read. Left skips it for good.</p>
      </div>

      {tagList.length > 0 ? (
        <div className="discover-filter-banner">
          <Layers size={16} />
          <span>Books tagged</span>
          {tagList.map(t => <strong key={t}>#{t}</strong>)}
          <button className="discover-clear" onClick={() => setSearchParams({})}>Clear</button>
        </div>
      ) : (
        <div className="discover-categories">
          {CATEGORIES.map(cat => (
            <button key={cat} className={`niche-pill ${category === cat ? 'active' : ''}`} onClick={() => changeCategory(cat)}>
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="discover-stage">
        {loading ? (
          <div className="discover-empty"><div className="spinner"></div></div>
        ) : visible.length === 0 ? (
          <div className="discover-empty">
            {fetchingMore ? (
              <div className="spinner"></div>
            ) : (
              <>
                <h3>You've reached the end of this stack.</h3>
                <p>Try another genre or trope, or check back later for more.</p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                  <button className="btn-primary" onClick={() => { setExhausted(false); loadCards(true); }}>Try again</button>
                  <Link to="/tags" className="btn-secondary">Browse tropes</Link>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="swipe-deck">
            {visible.slice().reverse().map((book) => {
              const depth = deck.indexOf(book);
              const isTop = depth === 0;
              const rawDescription = descriptions[book._id] || book.description;
              const description = rawDescription && rawDescription !== NO_DESCRIPTION ? stripHtml(rawDescription) : null;
              return (
                <div
                  key={book._id}
                  className={`swipe-card ${isTop ? 'top' : ''} ${isTop && expanded ? 'expanded' : ''}`}
                  style={isTop ? topCardStyle() : stackCardStyle(depth)}
                  onPointerDown={isTop ? onPointerDown : undefined}
                  onPointerMove={isTop ? onPointerMove : undefined}
                  onPointerUp={isTop ? onPointerUp : undefined}
                  onPointerCancel={isTop ? onPointerUp : undefined}
                  aria-hidden={!isTop}
                >
                  <div className="swipe-card-cover">
                    <div className="swipe-card-cover-bg" style={{ backgroundImage: `url("${deckCover(book)}")` }} />
                    <img
                      src={deckCover(book)}
                      srcSet={coverSrcSet(book.coverImage)}
                      alt={book.title}
                      draggable={false}
                      onError={onCoverError}
                    />
                    {isTop && (
                      <>
                        <span className="swipe-stamp like" style={{ opacity: likeOpacity }}>WANT</span>
                        <span className="swipe-stamp nope" style={{ opacity: nopeOpacity }}>SKIP</span>
                      </>
                    )}
                  </div>
                  <div className="swipe-card-body">
                    <h2 className="swipe-card-title">{book.title}</h2>
                    <p className="swipe-card-author">
                      {book.author}{book.publishedYear ? ` · ${book.publishedYear}` : ''}
                    </p>
                    {(book.topTags?.length > 0 || book.genres?.length > 0) && (
                      <div className="swipe-card-tags">
                        {book.topTags?.map(t => <span key={t} className="swipe-tag trope">#{t}</span>)}
                        {book.genres?.slice(0, 2).map(g => <span key={g} className="swipe-tag">{g}</span>)}
                      </div>
                    )}
                    <p className="swipe-card-description">
                      {description || (descriptions[book._id] === undefined ? 'Loading description...' : 'No description available.')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="swipe-controls">
        <button className="swipe-btn small" onClick={undo} disabled={history.length === 0} title="Undo (Z)" aria-label="Undo last swipe">
          <RotateCcw size={20} />
        </button>
        <button className="swipe-btn nope" onClick={() => swipe('left')} disabled={!top} title="Skip (←)" aria-label="Skip">
          <X size={30} />
        </button>
        <button className="swipe-btn like" onClick={() => swipe('right')} disabled={!top} title="Want to read (→)" aria-label="Want to read">
          <Heart size={28} />
        </button>
        {top ? (
          <Link to={`/books/${top._id}`} className="swipe-btn small" title="Book details" aria-label="Book details">
            <Info size={20} />
          </Link>
        ) : (
          <button className="swipe-btn small" disabled aria-label="Book details"><Info size={20} /></button>
        )}
      </div>

      <p className="swipe-hint">
        Drag the card or use ← → keys · Tap a card for the full description
        {likedCount > 0 && (
          <> · <Link to="/profile">{likedCount} added to Want to Read</Link></>
        )}
      </p>
    </div>
  );
};

export default Discover;
