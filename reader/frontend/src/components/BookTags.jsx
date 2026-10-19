import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { Hash, Plus, Check } from 'lucide-react';
import './BookTags.css';


const BookTags = ({ bookId, user, showToast }) => {
  const [tags, setTags] = useState([]);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [inputFocused, setInputFocused] = useState(false);
  const [saving, setSaving] = useState(false);

  const authConfig = () => ({ headers: { Authorization: `Bearer ${user.token}` } });

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const config = user ? authConfig() : {};
        const { data } = await api.get(`/api/books/${bookId}/tags`, config);
        setTags(data);
      } catch (error) {
        console.error(error);
      }
    };
    fetchTags();
  }, [bookId, user]);

  // Debounced autocomplete; with an empty box, offer the most popular tags
  useEffect(() => {
    if (!inputFocused) return;
    const timeoutId = setTimeout(async () => {
      try {
        const { data } = await api.get(`/api/tags?limit=8&q=${encodeURIComponent(input.trim())}`);
        setSuggestions(data);
      } catch (error) {
        console.error(error);
      }
    }, 200);
    return () => clearTimeout(timeoutId);
  }, [input, inputFocused]);

  const addTag = async (tag) => {
    if (!user) return showToast('Please login to tag books.');
    if (!tag.trim() || saving) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/api/books/${bookId}/tags`, { tag }, authConfig());
      setTags(data);
      setInput('');
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to add tag.');
    }
    setSaving(false);
  };

  const removeTag = async (tag) => {
    try {
      const { data } = await api.delete(`/api/books/${bookId}/tags/${encodeURIComponent(tag)}`, authConfig());
      setTags(data);
    } catch {
      showToast('Failed to remove tag.');
    }
  };

  const toggleVote = (t) => {
    if (!user) return showToast('Please login to tag books.');
    return t.mine ? removeTag(t.tag) : addTag(t.tag);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    addTag(input);
  };

  const existing = new Set(tags.map(t => t.tag));
  const visibleSuggestions = suggestions.filter(s => !existing.has(s.tag));

  return (
    <div className="book-tags">
      <div className="book-tags-header">
        <h4><Hash size={16} /> Micro-Tropes</h4>
        <Link to="/tags" className="book-tags-browse">Browse all</Link>
      </div>

      {tags.length > 0 ? (
        <div className="book-tags-list">
          {tags.map(t => (
            <div key={t.tag} className={`tag-chip ${t.mine ? 'mine' : ''}`}>
              <Link to={`/tags?tags=${encodeURIComponent(t.tag)}`} className="tag-chip-label">{t.tag}</Link>
              <button
                className="tag-chip-vote"
                onClick={() => toggleVote(t)}
                title={t.mine ? 'Remove your vote' : 'I agree, this book has this trope'}
              >
                {t.mine ? <Check size={12} /> : <Plus size={12} />}
                {t.count}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="book-tags-empty">No tropes yet. Is it a slow burn? Found family? Tag it!</p>
      )}

      {user && (
        <form className="book-tags-form" onSubmit={handleSubmit}>
          <input
            type="text"
            className="input-field"
            placeholder="Add a trope, e.g. unreliable narrator"
            value={input}
            maxLength={40}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setTimeout(() => setInputFocused(false), 150)}
          />
          <button type="submit" className="btn-primary" disabled={saving || !input.trim()}>Add</button>
          {inputFocused && visibleSuggestions.length > 0 && (
            <div className="book-tags-suggestions">
              {visibleSuggestions.map(s => (
                <button
                  type="button"
                  key={s.tag}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addTag(s.tag)}
                >
                  <span>{s.tag}</span>
                  <span className="suggestion-count">{s.bookCount} {s.bookCount === 1 ? 'book' : 'books'}</span>
                </button>
              ))}
            </div>
          )}
        </form>
      )}
    </div>
  );
};

export default BookTags;
