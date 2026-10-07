import React from 'react';
import { Link } from 'react-router-dom';
import './BookCard.css';

const BookCard = ({ book, bgColor, categoryColor }) => {
  const highResImage = book.coverImage ? book.coverImage.replace('-S.jpg', '-L.jpg').replace('-M.jpg', '-L.jpg') : '';

  return (
    <Link to={`/books/${book._id}`} className="book-card-container">
      <div className="book-card-block" style={{ backgroundColor: bgColor }}>
        <div className="book-cover-wrapper">
          <img src={highResImage} alt={book.title} className="book-cover-img" loading="lazy" />
        </div>
      </div>
      <div className="book-card-meta">
        {book.genres && book.genres.length > 0 && (
          <span className="book-category" style={{ color: categoryColor }}>
            {book.genres[0]}
          </span>
        )}
        <h3 className="book-title">{book.title}</h3>
        <p className="book-title-sub">{book.author}</p>
        
        <div className="book-card-actions">
          <button className="btn-primary card-btn-action">
            See More
          </button>
        </div>
      </div>
    </Link>
  );
};

export default BookCard;
