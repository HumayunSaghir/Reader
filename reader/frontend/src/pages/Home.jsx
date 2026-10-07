import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BookCard from '../components/BookCard';
import './Home.css';

const heroContentOptions = [
  {
    tag: "ABOUT US",
    title: <>Transforming the way reading is<br/>discovered, organized, & experienced.</>,
    subtext: "At Reader, we unlock the world's best books and create the digital library infrastructure you've been missing."
  },
  {
    tag: "DISCOVER",
    title: <>Expand your mind with stories<br/>that challenge and inspire.</>,
    subtext: "Curated collections, personalized recommendations, and a community built around the joy of reading."
  },
  {
    tag: "LIBRARY",
    title: <>Your personal sanctuary for<br/>knowledge, tracking, and growth.</>,
    subtext: "Organize your reading journey effortlessly and keep all your favorite books in one beautifully designed space."
  },
  {
    tag: "COMMUNITY",
    title: <>Join a network of readers<br/>sharing their favorite discoveries.</>,
    subtext: "Read reviews, explore new niches, and connect with people who share your passion for great literature."
  }
];

const Home = () => {
  const [activeNiche, setActiveNiche] = useState(() => sessionStorage.getItem('homeNiche') || 'All');
  const [page, setPage] = useState(() => parseInt(sessionStorage.getItem('homePage')) || 1);
  const [books, setBooks] = useState(() => {
    const cached = sessionStorage.getItem('homeBooks');
    return cached ? JSON.parse(cached) : [];
  });
  const [hasMore, setHasMore] = useState(() => sessionStorage.getItem('homeHasMore') !== 'false');
  
  const [loading, setLoading] = useState(books.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [heroContent, setHeroContent] = useState(heroContentOptions[0]);

  const lastFetched = React.useRef({ niche: activeNiche, page: page, loaded: books.length > 0 });

  const niches = ['All', 'Fiction', 'Science', 'History', 'Technology', 'Fantasy', 'Mystery', 'Romance', 'Thriller'];
  const bgColors = ['var(--card-bg-1)', 'var(--card-bg-2)', 'var(--card-bg-3)', 'var(--card-bg-4)'];
  const textColors = ['var(--text-main)', 'var(--text-main)', 'var(--text-main)', 'var(--text-main)'];

  useEffect(() => {
    sessionStorage.setItem('homeNiche', activeNiche);
    sessionStorage.setItem('homePage', page.toString());
    sessionStorage.setItem('homeBooks', JSON.stringify(books));
    sessionStorage.setItem('homeHasMore', hasMore.toString());
  }, [activeNiche, page, books, hasMore]);

  const handleNicheChange = (niche) => {
    if (niche === activeNiche) return;
    setActiveNiche(niche);
    setPage(1);
    setBooks([]);
    setHasMore(true);
    setLoading(true);
  };

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * heroContentOptions.length);
    setHeroContent(heroContentOptions[randomIndex]);
  }, []);



  useEffect(() => {
    if (lastFetched.current.niche === activeNiche && 
        lastFetched.current.page === page && 
        lastFetched.current.loaded) {
      return;
    }

    lastFetched.current = { niche: activeNiche, page: page, loaded: true };

    const fetchBooks = async () => {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        const url = activeNiche === 'All' 
          ? `${import.meta.env.VITE_API_URL}/api/books?page=${page}` 
          : `${import.meta.env.VITE_API_URL}/api/books?category=${activeNiche.toLowerCase()}&page=${page}`;
        const { data } = await axios.get(url);
        
        if (data.length === 0) {
          setHasMore(false);
          setBooks([]);
        } else {
          setBooks(data);
          setHasMore(data.length === 50); // If less than 50 returned, it's the last page
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    };
    fetchBooks();
  }, [activeNiche, page]);

  return (
    <div className="home">
      <div className="hero-minimal">
        <span className="hero-tag">{heroContent.tag}</span>
        <h1>{heroContent.title}</h1>
        <p className="hero-subtext">{heroContent.subtext}</p>
      </div>

      <div className="niches-container">
        {niches.map(niche => (
          <button 
            key={niche} 
            className={`niche-pill ${activeNiche === niche ? 'active' : ''}`}
            onClick={() => handleNicheChange(niche)}
          >
            {niche}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading" style={{ padding: '4rem 0' }}>
          <div className="spinner"></div>
        </div>
      ) : (
        <>
          <div className="books-showcase">
            {books.length > 0 ? books.map((book, index) => (
              <BookCard 
                key={`${book._id}-${index}`} 
                book={book} 
                bgColor={bgColors[index % bgColors.length]}
                categoryColor={textColors[index % textColors.length]}
              />
            )) : (
              <div className="loading">No books found in this niche.</div>
            )}
          </div>
          
          <div className="pagination-controls" style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '3rem', paddingBottom: '3rem' }}>
            <button 
              className="btn-secondary" 
              disabled={page === 1}
              onClick={() => { setPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              style={{ minWidth: '120px' }}
            >
              Previous
            </button>
            <span style={{ display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>Page {page}</span>
            <button 
              className="btn-primary" 
              disabled={!hasMore}
              onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              style={{ minWidth: '120px' }}
            >
              Next Page
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Home;
