import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
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
  Calendar
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
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
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/reading/challenge?year=${year}`,
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
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/reading/challenge`,
        { year: selectedYear, target: targetNum },
        config
      );
      setChallengeData(data);
      setIsEditingGoal(false);
      setMessage(`Goal set to ${targetNum} books!`);
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
          <div className="challenge-trophy-badge">
            <Trophy size={22} className="trophy-icon" />
          </div>
          <div>
            <div className="challenge-tagline">ANNUAL MILESTONE</div>
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
            <Edit3 size={15} />
            <span>{isEditingGoal ? 'Cancel' : 'Edit Goal'}</span>
          </button>

          {/* View Spotify Wrapped Button */}
          <button 
            className="challenge-btn-wrapped"
            onClick={() => setShowWrappedModal(true)}
            title="View Spotify Wrapped-style Infographic"
          >
            <Sparkles size={16} className="sparkle-anim" />
            <span>View {selectedYear} Wrapped</span>
          </button>
        </div>
      </div>

      {/* Success / Info Feedback */}
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
            <span>Set your reading target for {selectedYear}:</span>
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
              <Check size={16} />
              {savingGoal ? 'Saving...' : 'Save Goal'}
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
          {/* Main Metric & Pace */}
          <div className="challenge-metric-row">
            <div className="metric-counts">
              <span className="metric-completed">{completedCount}</span>
              <span className="metric-divider">/</span>
              <span className="metric-target">{target}</span>
              <span className="metric-label">books read</span>
              <span className="metric-pct">({percentage}%)</span>
            </div>

            {/* Pace status pill */}
            <div className={`pace-badge pace-${paceStatus}`}>
              {paceStatus === 'ahead' && <TrendingUp size={15} />}
              {paceStatus === 'behind' && <TrendingDown size={15} />}
              {paceStatus === 'completed' && <Trophy size={15} />}
              {paceStatus === 'on_track' && <Check size={15} />}
              <span>{paceMessage}</span>
            </div>
          </div>

          {/* Progress Bar with Milestone Markers */}
          <div className="challenge-bar-container">
            <div className="challenge-bar-track">
              <div 
                className="challenge-bar-fill" 
                style={{ width: `${Math.min(100, Math.max(3, percentage))}%` }}
              >
                <div className="bar-shimmer"></div>
              </div>
            </div>

            {/* Milestones markers */}
            <div className="bar-milestones">
              <span className={`milestone-pip ${percentage >= 25 ? 'reached' : ''}`} style={{ left: '25%' }}>25%</span>
              <span className={`milestone-pip ${percentage >= 50 ? 'reached' : ''}`} style={{ left: '50%' }}>50%</span>
              <span className={`milestone-pip ${percentage >= 75 ? 'reached' : ''}`} style={{ left: '75%' }}>75%</span>
              <span className={`milestone-pip ${percentage >= 100 ? 'reached' : ''}`} style={{ left: '100%' }}>100%</span>
            </div>
          </div>

          {/* Highlights Mini Pills */}
          <div className="challenge-pills-row">
            {wrapped?.persona && (
              <div className="challenge-stat-chip">
                <Sparkles size={14} className="text-purple" />
                <span>Persona: <strong>{wrapped.persona.title}</strong></span>
              </div>
            )}
            <div className="challenge-stat-chip">
              <Flame size={14} className="text-amber" />
              <span>Streak: <strong>{wrapped?.longestStreak || 0} days</strong></span>
            </div>
            <div className="challenge-stat-chip">
              <BookOpen size={14} className="text-emerald" />
              <span>Est. Pages: <strong>~{(wrapped?.estimatedPages || 0).toLocaleString()}</strong></span>
            </div>
            {wrapped?.topGenre && (
              <div className="challenge-stat-chip">
                <span>Top Genre: <strong>{wrapped.topGenre}</strong></span>
              </div>
            )}
          </div>

          {/* Recently Completed Books Row */}
          <div className="challenge-books-section">
            <div className="challenge-books-header">
              <span className="section-label">BOOKS FINISHED IN {selectedYear} ({readBooks.length})</span>
              {readBooks.length > 0 && (
                <button 
                  className="open-wrapped-link"
                  onClick={() => setShowWrappedModal(true)}
                >
                  Generate Infographic <ChevronRight size={14} />
                </button>
              )}
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
                        src={book.coverImage ? book.coverImage.replace('-S.jpg', '-L.jpg') : FALLBACK_IMAGE} 
                        alt={book.title}
                        onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE; }}
                      />
                      <span className="book-check-badge"><Check size={12} /></span>
                    </div>
                    <span className="challenge-book-title">{book.title}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="challenge-empty-state">
                <BookOpen size={24} style={{ opacity: 0.4 }} />
                <p>No books completed yet in {selectedYear}. Set books to "Read" to track your progress!</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Shareable Spotify Wrapped Modal */}
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
