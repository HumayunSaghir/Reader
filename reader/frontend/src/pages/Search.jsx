import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import BookCard from '../components/BookCard';
import './Home.css';

const Search = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const query = new URLSearchParams(location.search).get('q');

  const bgColors = ['var(--card-bg-1)', '#FDE047', '#FCE7F3', '#DCFCE7'];
  const textColors = ['#3B82F6', '#D97706', '#DB2777', '#16A34A'];

  useEffect(() => {
    const fetchBooks = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/books/search?query=${encodeURIComponent(query)}`);
        setBooks(data);
        setLoading(false);
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };
    if (query) {
      fetchBooks();
    }
  }, [query]);

  return (
    <div className="home">
      <div className="hero-minimal" style={{ padding: '2rem 0' }}>
        <h2>Search Results for "{query}"</h2>
      </div>

      {loading ? (
        <div className="loading" style={{ padding: '4rem 0' }}>
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="books-showcase">
          {books.length > 0 ? books.map((book, index) => (
            <BookCard 
              key={book._id} 
              book={book} 
              bgColor={bgColors[index % bgColors.length]}
              categoryColor={textColors[index % textColors.length]}
            />
          )) : (
            <div className="loading">No books found.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default Search;
