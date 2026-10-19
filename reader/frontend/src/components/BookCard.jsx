import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import './BookCard.css';
import { coverUrl, coverSrcSet, onCoverError } from '../utils/covers';

export const coverSrc = (url) => coverUrl(url, 'L');

const BookCard = ({ book, eager = false }) => {
  const genre = book.genres?.[0];
  return (
    <Link to={`/books/${book._id}`} className="book-card" title={`${book.title} by ${book.author}`}>
      <div className="book-card-cover">
        <img
          src={coverUrl(book.coverImage, 'M')}
          srcSet={coverSrcSet(book.coverImage)}
          alt=""
          width="200"
          height="300"
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={onCoverError}
        />
      </div>
      <div className="book-card-meta">
        <h3 className="book-card-title">{book.title}</h3>
        <p className="book-card-author">{book.author}</p>
        <p className="book-card-extra">
          {book.ratingsCount > 0 && (
            <span className="book-card-rating"><Star size={12} fill="currentColor" /> {book.averageRating.toFixed(1)}</span>
          )}
          {genre && <span className="book-card-genre">{genre}</span>}
          {!genre && book.publishedYear && <span>{book.publishedYear}</span>}
        </p>
      </div>
    </Link>
  );
};

/** Placeholder shown while a grid of books loads. */
export const BookCardSkeleton = () => (
  <div className="book-card" aria-hidden="true">
    <div className="book-card-cover skeleton" />
    <div className="book-card-meta">
      <div className="skeleton skeleton-text" style={{ width: '90%' }} />
      <div className="skeleton skeleton-text" style={{ width: '60%' }} />
    </div>
  </div>
);

export const BookGridSkeleton = ({ count = 12 }) => (
  <div className="books-grid" aria-busy="true" aria-label="Loading books">
    {Array.from({ length: count }, (_, i) => <BookCardSkeleton key={i} />)}
  </div>
);

export default memo(BookCard);
