import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Share2, 
  Download, 
  Copy, 
  Check, 
  Flame, 
  BookOpen, 
  ChevronLeft, 
  ChevronRight,
  Calendar,
  Bookmark,
  Target
} from 'lucide-react';
import './ReaderWrappedModal.css';
import { FALLBACK_IMAGE } from '../assets/fallbackImage';

const ReaderWrappedModal = ({ wrappedData, onClose }) => {
  const [activeTab, setActiveTab] = useState('poster'); // 'poster' or 'story'
  const [storyIndex, setStoryIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!wrappedData) return null;

  const {
    year,
    userName,
    userAvatar,
    completedCount,
    target,
    percentage,
    estimatedPages,
    topBook,
    topGenre,
    topGenres = [],
    persona,
    longestStreak,
    totalDaysActive
  } = wrappedData;

  const storySlides = [
    {
      id: 'total',
      tag: 'READING VOLUME',
      title: 'Your Annual Chapter Count',
      content: (
        <div className="story-stat-hero">
          <div className="story-giant-number">{completedCount}</div>
          <p className="story-stat-label">Books Read in {year}</p>
          <div className="story-meta-pills">
            <span className="story-pill">{percentage}% of your {target}-book goal</span>
            <span className="story-pill">~{estimatedPages.toLocaleString()} pages read</span>
          </div>
        </div>
      )
    },
    {
      id: 'persona',
      tag: 'READING PERSONA',
      title: persona?.title || 'The Dedicated Reader',
      content: (
        <div className="story-persona-card">
          <div className="persona-badge-glow">{persona?.badge || 'Story Voyager'}</div>
          <p className="persona-desc">{persona?.description}</p>
        </div>
      )
    },
    {
      id: 'genre',
      tag: 'FAVORITE GENRES',
      title: `Top Category: ${topGenre}`,
      content: (
        <div className="story-genres-list">
          {topGenres.length > 0 ? topGenres.map((g, i) => (
            <div key={g.name} className="story-genre-row">
              <span className="genre-rank">0{i + 1}</span>
              <span className="genre-name">{g.name}</span>
              <div className="genre-bar-track">
                <div className="genre-bar-fill" style={{ width: `${Math.max(15, g.percentage)}%` }}></div>
              </div>
              <span className="genre-pct">{g.percentage}%</span>
            </div>
          )) : (
            <p className="story-muted-note">A wide exploration across diverse literature.</p>
          )}
        </div>
      )
    },
    {
      id: 'topbook',
      tag: 'STANDOUT TITLE',
      title: topBook ? topBook.title : 'Your Next Great Read',
      content: (
        <div className="story-top-book">
          {topBook ? (
            <>
              <div className="story-book-cover-frame">
                <img 
                  src={topBook.coverImage ? topBook.coverImage.replace('-S.jpg', '-L.jpg') : FALLBACK_IMAGE} 
                  alt={topBook.title}
                  onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE; }}
                />
              </div>
              <div className="story-book-details">
                <h4>{topBook.title}</h4>
                <p>by {topBook.author}</p>
                <div className="story-stars">{'★'.repeat(topBook.rating || 5)}</div>
                {topBook.reviewSnippet && (
                  <p className="story-review-quote">"{topBook.reviewSnippet}"</p>
                )}
              </div>
            </>
          ) : (
            <p className="story-muted-note">Keep logging books to spotlight your top-rated favorite of the year.</p>
          )}
        </div>
      )
    },
    {
      id: 'streak',
      tag: 'READING DISCIPLINE',
      title: 'Consistency & Habits',
      content: (
        <div className="story-dedication-grid">
          <div className="story-dedication-box">
            <Flame className="dedication-icon text-amber" size={28} />
            <span className="dedication-num">{longestStreak} {longestStreak === 1 ? 'Day' : 'Days'}</span>
            <span className="dedication-label">Longest Reading Streak</span>
          </div>
          <div className="story-dedication-box">
            <Calendar className="dedication-icon text-emerald" size={28} />
            <span className="dedication-num">{totalDaysActive} {totalDaysActive === 1 ? 'Day' : 'Days'}</span>
            <span className="dedication-label">Active Reading Days</span>
          </div>
        </div>
      )
    }
  ];

  // Generate downloadable high-res image via HTML5 Canvas (Clean luxury design)
  const handleDownloadImage = async () => {
    try {
      setDownloading(true);
      const canvas = document.createElement('canvas');
      const width = 1080;
      const height = 1350;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // 1. Background (Rich Obsidian & Dark Emerald gradient)
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#09150D');
      bgGrad.addColorStop(0.5, '#060E09');
      bgGrad.addColorStop(1, '#040805');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle atmospheric emerald glow
      const radialGlow = ctx.createRadialGradient(250, 200, 50, 250, 200, 650);
      radialGlow.addColorStop(0, 'rgba(16, 185, 129, 0.12)');
      radialGlow.addColorStop(1, 'rgba(16, 185, 129, 0)');
      ctx.fillStyle = radialGlow;
      ctx.fillRect(0, 0, width, height);

      // Card outer frame
      ctx.strokeStyle = 'rgba(204, 251, 192, 0.18)';
      ctx.lineWidth = 3;
      ctx.strokeRect(40, 40, width - 80, height - 80);

      // 2. Header
      ctx.fillStyle = '#CCFBC0';
      ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('READER', 90, 115);

      ctx.fillStyle = 'rgba(234, 252, 228, 0.6)';
      ctx.font = '600 20px "Inter", sans-serif';
      ctx.fillText(`•   ${year} ANNUAL RECAP`, 230, 115);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 26px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(userName, 90, 160);

      // Divider line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(90, 200);
      ctx.lineTo(width - 90, 200);
      ctx.stroke();

      // 3. Hero Metric
      ctx.fillStyle = '#A3EA8C';
      ctx.font = '700 18px "Inter", sans-serif';
      ctx.fillText('TOTAL BOOKS READ', 90, 250);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 120px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${completedCount}`, 90, 375);

      ctx.fillStyle = 'rgba(234, 252, 228, 0.75)';
      ctx.font = '500 24px "Inter", sans-serif';
      ctx.fillText(`${percentage}% of ${target} book goal   •   ~${estimatedPages.toLocaleString()} pages read`, 90, 430);

      // 4. Reading Persona Card
      ctx.fillStyle = 'rgba(204, 251, 192, 0.04)';
      ctx.strokeStyle = 'rgba(204, 251, 192, 0.16)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(90, 480, width - 180, 190, 20);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#10B981';
      ctx.font = '700 18px "Inter", sans-serif';
      ctx.fillText((persona?.badge || 'READING PERSONA').toUpperCase(), 130, 530);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 34px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(persona?.title || 'The Dedicated Reader', 130, 580);

      ctx.fillStyle = 'rgba(234, 252, 228, 0.8)';
      ctx.font = '400 20px "Inter", sans-serif';
      ctx.fillText(persona?.description || '', 130, 625);

      // 5. Stats Grid (2 x 2)
      // Cell 1: Top Genre
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(90, 700, 435, 170, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(234, 252, 228, 0.55)';
      ctx.font = '600 16px "Inter", sans-serif';
      ctx.fillText('TOP GENRE', 125, 745);

      ctx.fillStyle = '#34D399';
      ctx.font = '800 30px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(topGenre, 125, 795);

      ctx.fillStyle = 'rgba(234, 252, 228, 0.65)';
      ctx.font = '400 18px "Inter", sans-serif';
      ctx.fillText('Your most explored category', 125, 835);

      // Cell 2: Consistency
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(555, 700, 435, 170, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(234, 252, 228, 0.55)';
      ctx.font = '600 16px "Inter", sans-serif';
      ctx.fillText('LONGEST STREAK', 590, 745);

      ctx.fillStyle = '#FBBF24';
      ctx.font = '800 30px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${longestStreak} Consecutive Days`, 590, 795);

      ctx.fillStyle = 'rgba(234, 252, 228, 0.65)';
      ctx.font = '400 18px "Inter", sans-serif';
      ctx.fillText(`${totalDaysActive} active reading days in ${year}`, 590, 835);

      // 6. Standout Title Spotlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(90, 900, width - 180, 260, 20);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#10B981';
      ctx.font = '700 16px "Inter", sans-serif';
      ctx.fillText('STANDOUT BOOK OF THE YEAR', 130, 945);

      if (topBook) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 30px "Plus Jakarta Sans", sans-serif';
        const titleSnippet = topBook.title.length > 40 ? topBook.title.slice(0, 40) + '...' : topBook.title;
        ctx.fillText(titleSnippet, 130, 995);

        ctx.fillStyle = 'rgba(234, 252, 228, 0.7)';
        ctx.font = '500 20px "Inter", sans-serif';
        ctx.fillText(`by ${topBook.author}`, 130, 1035);

        ctx.fillStyle = '#FBBF24';
        ctx.font = '700 24px "Inter", sans-serif';
        ctx.fillText('★'.repeat(topBook.rating || 5), 130, 1075);

        if (topBook.reviewSnippet) {
          ctx.fillStyle = 'rgba(234, 252, 228, 0.65)';
          ctx.font = 'italic 18px "Inter", sans-serif';
          ctx.fillText(`"${topBook.reviewSnippet.slice(0, 55)}..."`, 130, 1120);
        }
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '600 22px "Inter", sans-serif';
        ctx.fillText('Continue logging your reads to crown your favorite title.', 130, 1020);
      }

      // 7. Footer Branding
      ctx.fillStyle = 'rgba(234, 252, 228, 0.4)';
      ctx.font = '500 18px "Inter", sans-serif';
      ctx.fillText(`reader.app   •   ${year} Reading Journey`, 90, 1250);

      // Download
      const imageUri = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `Reader_Recap_${year}_${userName.replace(/\s+/g, '_')}.png`;
      downloadLink.href = imageUri;
      downloadLink.click();
    } catch (err) {
      console.error('Failed to generate image:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyShare = async () => {
    try {
      const shareText = `📚 My ${year} Reader Recap!\n\n• Books Read: ${completedCount}/${target} (${percentage}%)\n• Reading Persona: ${persona?.title}\n• Top Genre: ${topGenre}\n• Longest Streak: ${longestStreak} days\n\nTrack your reading at Reader!`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleTweetShare = () => {
    const tweet = `My ${year} Reader Recap: ${completedCount} books read so far! Reading persona: "${persona?.title}". Top genre: ${topGenre}. 📖✨`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="wrapped-modal-overlay" onClick={onClose}>
      <div className="wrapped-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Top Bar */}
        <div className="wrapped-modal-header">
          <div className="wrapped-brand">
            <Sparkles size={18} className="wrapped-header-icon" />
            <span>{year} ANNUAL RECAP</span>
          </div>

          <div className="wrapped-view-tabs">
            <button 
              className={`wrapped-tab-btn ${activeTab === 'poster' ? 'active' : ''}`}
              onClick={() => setActiveTab('poster')}
            >
              Recap Card
            </button>
            <button 
              className={`wrapped-tab-btn ${activeTab === 'story' ? 'active' : ''}`}
              onClick={() => setActiveTab('story')}
            >
              Interactive Story
            </button>
          </div>

          <button className="wrapped-close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="wrapped-modal-body">
          {activeTab === 'poster' ? (
            <div className="wrapped-poster-wrapper">
              {/* Infographic Poster Card - Full & Uncut */}
              <div className="wrapped-poster-card">
                {/* Card Header */}
                <div className="poster-header">
                  <div>
                    <div className="poster-kicker">READER • {year} RECAP</div>
                    <h3 className="poster-user-name">{userName}</h3>
                  </div>
                  {userAvatar ? (
                    <img 
                      src={`${import.meta.env.VITE_API_URL}${userAvatar}`} 
                      alt={userName} 
                      className="poster-avatar"
                    />
                  ) : (
                    <div className="poster-avatar-fallback">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* 2-Column Body Content */}
                <div className="poster-columns-grid">
                  {/* Left Column: Big Stats & Consistency */}
                  <div className="poster-col-left">
                    <div className="poster-hero-metric">
                      <div className="poster-label">BOOKS COMPLETED</div>
                      <div className="poster-big-count">{completedCount}</div>
                      <div className="poster-metric-meta">
                        <span className="poster-pill highlight">{percentage}% of {target} goal</span>
                        <span className="poster-pill">~{estimatedPages.toLocaleString()} pages</span>
                      </div>
                    </div>

                    <div className="poster-grid-stats">
                      <div className="poster-stat-card">
                        <div className="stat-card-label">
                          <Bookmark size={13} />
                          <span>TOP GENRE</span>
                        </div>
                        <h5 className="stat-card-value">{topGenre}</h5>
                        <span className="stat-card-sub">Most explored</span>
                      </div>

                      <div className="poster-stat-card">
                        <div className="stat-card-label">
                          <Flame size={13} />
                          <span>LONGEST STREAK</span>
                        </div>
                        <h5 className="stat-card-value text-amber">{longestStreak} {longestStreak === 1 ? 'Day' : 'Days'}</h5>
                        <span className="stat-card-sub">{totalDaysActive} active days</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Persona & Standout Title */}
                  <div className="poster-col-right">
                    <div className="poster-persona-box">
                      <div className="poster-persona-badge">{persona?.badge || 'Reading Persona'}</div>
                      <h4 className="poster-persona-title">{persona?.title}</h4>
                      <p className="poster-persona-desc">{persona?.description}</p>
                    </div>

                    {topBook ? (
                      <div className="poster-topbook-row">
                        <img 
                          src={topBook.coverImage ? topBook.coverImage.replace('-S.jpg', '-L.jpg') : FALLBACK_IMAGE} 
                          alt={topBook.title}
                          className="poster-book-thumb"
                          onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE; }}
                        />
                        <div className="poster-book-meta">
                          <span className="poster-book-tag">STANDOUT TITLE</span>
                          <div className="poster-book-title">{topBook.title}</div>
                          <div className="poster-book-author">by {topBook.author}</div>
                          <div className="poster-book-stars">{'★'.repeat(topBook.rating || 5)}</div>
                          {topBook.reviewSnippet && (
                            <div className="poster-book-review">"{topBook.reviewSnippet}"</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="poster-topbook-row empty">
                        <BookOpen size={22} style={{ opacity: 0.4, color: '#CCFBC0' }} />
                        <div className="poster-book-meta">
                          <span className="poster-book-tag">READING ODYSSEY</span>
                          <div className="poster-book-title">A New Chapter in {year}</div>
                          <div className="poster-book-author">Log your completed reads to crown your favorite.</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="poster-footer">
                  <span>reader.app</span>
                  <span>{year} Reading Journey</span>
                </div>
              </div>
            </div>
          ) : (
            /* Story Slide View */
            <div className="wrapped-story-wrapper">
              <div className="story-progress-indicators">
                {storySlides.map((s, idx) => (
                  <div 
                    key={s.id} 
                    className={`story-bar-pip ${idx === storyIndex ? 'active' : idx < storyIndex ? 'completed' : ''}`}
                    onClick={() => setStoryIndex(idx)}
                  ></div>
                ))}
              </div>

              <div className="story-slide-card">
                <div className="story-slide-header">
                  <span className="story-slide-tag">{storySlides[storyIndex].tag}</span>
                  <h3 className="story-slide-title">{storySlides[storyIndex].title}</h3>
                </div>

                <div className="story-slide-content">
                  {storySlides[storyIndex].content}
                </div>

                <div className="story-nav-buttons">
                  <button 
                    className="story-nav-btn prev"
                    disabled={storyIndex === 0}
                    onClick={() => setStoryIndex(prev => Math.max(0, prev - 1))}
                  >
                    <ChevronLeft size={18} /> Previous
                  </button>

                  <button 
                    className="story-nav-btn next"
                    onClick={() => {
                      if (storyIndex < storySlides.length - 1) {
                        setStoryIndex(prev => prev + 1);
                      } else {
                        setActiveTab('poster');
                      }
                    }}
                  >
                    {storyIndex < storySlides.length - 1 ? 'Next' : 'View Full Card'}
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Bar */}
        <div className="wrapped-action-bar">
          <button 
            className="wrapped-btn-primary" 
            onClick={handleDownloadImage}
            disabled={downloading}
          >
            <Download size={16} />
            {downloading ? 'Preparing PNG...' : 'Download Infographic (PNG)'}
          </button>

          <button 
            className="wrapped-btn-secondary" 
            onClick={handleCopyShare}
          >
            {copied ? <Check size={16} color="#34D399" /> : <Copy size={16} />}
            {copied ? 'Copied!' : 'Copy Summary'}
          </button>

          <button 
            className="wrapped-btn-secondary" 
            onClick={handleTweetShare}
          >
            <Share2 size={16} />
            Share on X
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReaderWrappedModal;
