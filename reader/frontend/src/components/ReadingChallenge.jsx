import React, { useState, useEffect } from 'react';
import { coverUrl } from '../utils/covers';
import api from '../api/client';
import { 
  Trophy, 
  Target, 
  Sparkles, 
  Check, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  Flame, 
  BookOpen, 
  Edit3,
  Compass,
  Bookmark
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ReaderWrappedModal from './ReaderWrappedModal';
import { FALLBACK_IMAGE } from '../assets/fallbackImage';
import './ReadingChallenge.css';

const ReadingChallenge = ({ user }) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [challengeData, setChallengeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempTarget, setTempTarget] = useState(20);
  const [savingGoal, setSavingGoal] = useState(false);
  const [showWrappedModal, setShowWrappedModal] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchChallenge = async (year) => {
    try {
      setLoading(true);
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await api.get(
        `/api/reading/challenge?year=${year}`,
        config
      );
      setChallengeData(data);
      setTempTarget(data.target || 20);
    } catch (err) {
      console.error('Failed to load reading challenge:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.token) {
      fetchChallenge(selectedYear);
    }
  }, [user, selectedYear]);

  const handleSaveGoal = async (e) => {
    e.preventDefault();
    const targetNum = parseInt(tempTarget, 10);
    if (!targetNum || targetNum < 1 || targetNum > 1000) {
      setMessage('Goal must be between 1 and 1000 books.');
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    try {
      setSavingGoal(true);
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await api.post(
        `/api/reading/challenge`,
        { year: selectedYear, target: targetNum },
        config
      );
      setChallengeData(data);
      setIsEditingGoal(false);
      setMessage(`Reading goal updated to ${targetNum} books.`);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error('Failed to save goal:', err);
      setMessage('Failed to update goal.');
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSavingGoal(false);
    }
  };

  if (!user) return null;

  const target = challengeData?.target || 20;
  const completedCount = challengeData?.completedCount || 0;
  const percentage = challengeData?.percentage || 0;
  const paceStatus = challengeData?.paceStatus || 'on_track';
  const paceMessage = challengeData?.paceMessage || 'On schedule';
  const readBooks = challengeData?.readBooks || [];
  const wrapped = challengeData?.wrapped;

  return (
    <div className="reading-challenge-container glass-panel">
      {/* Header */}
      <div className="challenge-header">
        <div className="challenge-title-group">
          <div className="challenge-icon-box">
            <Trophy size={20} />
          </div>
          <div>
            <div className="challenge-kicker">ANNUAL READING GOAL</div>
            <h3 className="challenge-title">{selectedYear} Reading Challenge</h3>
          </div>
        </div>

        <div className="challenge-header-actions">
          {/* Year selector */}
          <select 
            className="challenge-year-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
          >
            <option value={currentYear}>{currentYear}</option>
            <option value={currentYear - 1}>{currentYear - 1}</option>
            <option value={currentYear - 2}>{currentYear - 2}</option>
          </select>

          {/* Edit goal toggle */}
          <button 
            className="challenge-btn-secondary"
            onClick={() => setIsEditingGoal(!isEditingGoal)}
            title="Edit Target"
          >
            <Edit3 size={14} />
            <span>{isEditingGoal ? 'Cancel' : 'Edit Goal'}</span>
          </button>

          {/* View Annual Recap Button */}
          <button 
            className="challenge-btn-recap"
            onClick={() => setShowWrappedModal(true)}
            title="View Year Recap Infographic"
          >
            <Sparkles size={15} />
            <span>{selectedYear} Recap</span>
          </button>
        </div>
      </div>

      {/* Feedback message */}
      {message && (
        <div className="challenge-feedback-msg animate-fade-in">
          {message}
        </div>
      )}

      {/* Goal Target Editor Drawer */}
      {isEditingGoal && (
        <form onSubmit={handleSaveGoal} className="challenge-edit-box animate-fade-in">
          <div className="edit-box-label">
            <Target size={16} />
            <span>Set your target for {selectedYear}:</span>
          </div>
          <div className="edit-box-controls">
            <button 
              type="button" 
              className="quick-adjust-btn"
              onClick={() => setTempTarget(Math.max(1, (parseInt(tempTarget, 10) || 0) - 5))}
            >
              -5
            </button>
            <input 
              type="number" 
              min="1" 
              max="1000"
              value={tempTarget}
              onChange={(e) => setTempTarget(e.target.value)}
              className="challenge-target-input"
            />
            <button 
              type="button" 
              className="quick-adjust-btn"
              onClick={() => setTempTarget((parseInt(tempTarget, 10) || 0) + 5)}
            >
              +5
            </button>
            <span className="books-unit">books</span>

            <button 
              type="submit" 
              className="btn-primary edit-save-btn"
              disabled={savingGoal}
            >
              <Check size={15} />
              {savingGoal ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="challenge-loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <>
          {/* Main Progress Row */}
          <div className="challenge-progress-section">
            <div className="challenge-metric-row">
              <div className="metric-counts">
                <span className="metric-completed">{completedCount}</span>
                <span className="metric-divider">/</span>
                <span className="metric-target">{target}</span>
                <span className="metric-label">books completed</span>
                <span className="metric-pct">({percentage}%)</span>
              </div>

              {/* Pace status pill */}
              <div className={`pace-badge pace-${paceStatus}`}>
                {paceStatus === 'ahead' && <TrendingUp size={14} />}
                {paceStatus === 'behind' && <TrendingDown size={14} />}
                {paceStatus === 'completed' && <Trophy size={14} />}
                {paceStatus === 'on_track' && <Check size={14} />}
                <span>{paceMessage}</span>
              </div>
            </div>

            {/* Precision Progress Bar */}
            <div className="challenge-bar-track">
              <div 
                className="challenge-bar-fill" 
                style={{ width: `${Math.min(100, Math.max(completedCount > 0 ? 3 : 0, percentage))}%` }}
              ></div>
              {/* Subtle Hairline Dividers at 25%, 50%, 75% */}
              <span className="bar-notch" style={{ left: '25%' }}></span>
              <span className="bar-notch" style={{ left: '50%' }}></span>
              <span className="bar-notch" style={{ left: '75%' }}></span>
            </div>
          </div>

          {/* Structured 4-Metric Grid */}
          <div className="challenge-metrics-grid">
            <div className="challenge-stat-cell">
              <div className="stat-cell-header">
                <Target size={14} />
                <span>Target Goal</span>
              </div>
              <div className="stat-cell-value">{target} Books</div>
            </div>

            <div className="challenge-stat-cell">
              <div className="stat-cell-header">
                <Flame size={14} />
                <span>Longest Streak</span>
              </div>
              <div className="stat-cell-value">
                {wrapped?.longestStreak || 0} {wrapped?.longestStreak === 1 ? 'Day' : 'Days'}
              </div>
            </div>

            <div className="challenge-stat-cell">
              <div className="stat-cell-header">
                <BookOpen size={14} />
                <span>Est. Pages</span>
              </div>
              <div className="stat-cell-value">
                ~{(wrapped?.estimatedPages || 0).toLocaleString()}
              </div>
            </div>

            <div className="challenge-stat-cell">
              <div className="stat-cell-header">
                <Bookmark size={14} />
                <span>Top Genre</span>
              </div>
              <div className="stat-cell-value">
                {wrapped?.topGenre || 'Varied'}
              </div>
            </div>
          </div>

          {/* Finished Books in selectedYear */}
          <div className="challenge-books-section">
            <div className="challenge-books-header">
              <span className="section-label">Books Read in {selectedYear} ({readBooks.length})</span>
              <button 
                className="open-wrapped-link"
                onClick={() => setShowWrappedModal(true)}
              >
                <span>View Full Year Recap</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {readBooks.length > 0 ? (
              <div className="challenge-books-carousel">
                {readBooks.map(book => (
                  <Link 
                    to={`/books/${book._id}`} 
                    key={book._id} 
                    className="challenge-book-card"
                    title={book.title}
                  >
                    <div className="book-card-cover-wrap">
                      <img 
                        src={coverUrl(book.coverImage, 'M')} 
                        alt={book.title}
                        onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE; }}
                      />
                      <span className="book-check-badge"><Check size={11} /></span>
                    </div>
                    <span className="challenge-book-title">{book.title}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="challenge-empty-state">
                <BookOpen size={20} style={{ opacity: 0.4 }} />
                <span>No books marked as "Read" for {selectedYear} yet. Mark books finished to track your progress!</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Shareable Year Recap Modal */}
      {showWrappedModal && wrapped && (
        <ReaderWrappedModal 
          wrappedData={wrapped}
          onClose={() => setShowWrappedModal(false)}
        />
      )}
    </div>
  );
};

export default ReadingChallenge;
