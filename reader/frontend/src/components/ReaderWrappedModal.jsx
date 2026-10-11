import React, { useState, useRef } from 'react';
import { 
  X, 
  Sparkles, 
  Share2, 
  Download, 
  Copy, 
  Check, 
  Flame, 
  BookOpen, 
  Award, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  Calendar
} from 'lucide-react';
import './ReaderWrappedModal.css';
import { FALLBACK_IMAGE } from '../assets/fallbackImage';

const ReaderWrappedModal = ({ wrappedData, onClose }) => {
  const [activeTab, setActiveTab] = useState('poster'); // 'poster' or 'story'
  const [storyIndex, setStoryIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const posterRef = useRef(null);

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
      tag: 'THE VOYAGE',
      title: 'Your 2026 Chapter Count',
      content: (
        <div className="story-stat-hero">
          <div className="story-giant-number">{completedCount}</div>
          <p className="story-stat-label">Books Completed This Year</p>
          <div className="story-meta-pills">
            <span className="story-pill">{percentage}% of your {target}-book goal</span>
            <span className="story-pill">~{estimatedPages.toLocaleString()} pages explored</span>
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
          <div className="persona-badge-glow">{persona?.badge || '✨ Story Voyager'}</div>
          <p className="persona-desc">{persona?.description}</p>
        </div>
      )
    },
    {
      id: 'genre',
      tag: 'YOUR UNIVERSE',
      title: `Top Genre: ${topGenre}`,
      content: (
        <div className="story-genres-list">
          {topGenres.length > 0 ? topGenres.map((g, i) => (
            <div key={g.name} className="story-genre-row">
              <span className="genre-rank">#{i + 1}</span>
              <span className="genre-name">{g.name}</span>
              <div className="genre-bar-track">
                <div className="genre-bar-fill" style={{ width: `${Math.max(15, g.percentage)}%` }}></div>
              </div>
              <span className="genre-pct">{g.percentage}%</span>
            </div>
          )) : (
            <p style={{ color: 'rgba(255,255,255,0.7)' }}>A diverse mix of captivating titles.</p>
          )}
        </div>
      )
    },
    {
      id: 'topbook',
      tag: 'HIGHEST PRAISE',
      title: 'Your Standout Title',
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
            <p style={{ color: 'rgba(255,255,255,0.7)' }}>No ratings logged yet. Finish your next read to crown a champion!</p>
          )}
        </div>
      )
    },
    {
      id: 'streak',
      tag: 'DEDICATION',
      title: 'Habits of a Bookworm',
      content: (
        <div className="story-dedication-grid">
          <div className="story-dedication-box">
            <Flame className="dedication-icon text-amber" size={32} />
            <span className="dedication-num">{longestStreak} Days</span>
            <span className="dedication-label">Longest Reading Streak</span>
          </div>
          <div className="story-dedication-box">
            <Calendar className="dedication-icon text-emerald" size={32} />
            <span className="dedication-num">{totalDaysActive} Days</span>
            <span className="dedication-label">Active Reading Days</span>
          </div>
        </div>
      )
    }
  ];

  // Generate downloadable high-res image via HTML5 Canvas
  const handleDownloadImage = async () => {
    try {
      setDownloading(true);
      const canvas = document.createElement('canvas');
      const width = 1080;
      const height = 1350;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // 1. Background gradient (Spotify Wrapped dark obsidian with mesh colors)
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#09130D');
      bgGrad.addColorStop(0.35, '#0E1F14');
      bgGrad.addColorStop(0.7, '#15132B');
      bgGrad.addColorStop(1, '#060B08');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Radial glowing bursts
      const rad1 = ctx.createRadialGradient(180, 200, 10, 180, 200, 500);
      rad1.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
      rad1.addColorStop(1, 'rgba(16, 185, 129, 0)');
      ctx.fillStyle = rad1;
      ctx.fillRect(0, 0, width, height);

      const rad2 = ctx.createRadialGradient(900, 1000, 10, 900, 1000, 600);
      rad2.addColorStop(0, 'rgba(168, 85, 247, 0.3)');
      rad2.addColorStop(1, 'rgba(168, 85, 247, 0)');
      ctx.fillStyle = rad2;
      ctx.fillRect(0, 0, width, height);

      // Border outline glow
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 4;
      ctx.strokeRect(30, 30, width - 60, height - 60);

      // 2. Header Branding
      ctx.fillStyle = '#A3EA8C';
      ctx.font = '800 36px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`READER WRAPPED '${String(year).slice(-2)}`, 80, 110);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 24px "Inter", sans-serif';
      ctx.fillText(`${userName}'s Reading Journey`, 80, 155);

      // 3. Giant Stat
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '600 22px "Inter", sans-serif';
      ctx.fillText('TOTAL BOOKS READ', 80, 240);

      ctx.fillStyle = '#CCFBC0';
      ctx.font = '900 130px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${completedCount}`, 80, 370);

      ctx.fillStyle = '#E5E7EB';
      ctx.font = '600 26px "Inter", sans-serif';
      ctx.fillText(`${percentage}% of ${target} book goal  •  ~${estimatedPages.toLocaleString()} pages`, 80, 420);

      // Divider line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(80, 465);
      ctx.lineTo(width - 80, 465);
      ctx.stroke();

      // 4. Persona Card
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.roundRect(80, 500, width - 160, 170, 24);
      ctx.fill();

      ctx.fillStyle = '#E879F9';
      ctx.font = '700 20px "Inter", sans-serif';
      ctx.fillText(persona?.badge?.toUpperCase() || 'READING PERSONA', 115, 545);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 36px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(persona?.title || 'The Dedicated Reader', 115, 595);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '400 20px "Inter", sans-serif';
      ctx.fillText(persona?.description || '', 115, 635);

      // 5. Highlights Grid
      // Box 1: Top Genre
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.roundRect(80, 700, 440, 170, 24);
      ctx.fill();

      ctx.fillStyle = '#34D399';
      ctx.font = '600 18px "Inter", sans-serif';
      ctx.fillText('#1 TOP GENRE', 115, 745);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 32px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(topGenre, 115, 795);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '400 18px "Inter", sans-serif';
      ctx.fillText(`Your most explored realm`, 115, 835);

      // Box 2: Longest Streak
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.roundRect(560, 700, 440, 170, 24);
      ctx.fill();

      ctx.fillStyle = '#FBBF24';
      ctx.font = '600 18px "Inter", sans-serif';
      ctx.fillText('🔥 LONGEST STREAK', 595, 745);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 32px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${longestStreak} Consecutive Days`, 595, 795);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '400 18px "Inter", sans-serif';
      ctx.fillText(`${totalDaysActive} active reading days`, 595, 835);

      // 6. Top Book Spotlight Box
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.roundRect(80, 900, width - 160, 280, 24);
      ctx.fill();

      ctx.fillStyle = '#60A5FA';
      ctx.font = '600 18px "Inter", sans-serif';
      ctx.fillText('STANDOUT BOOK OF THE YEAR', 120, 945);

      if (topBook) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 30px "Plus Jakarta Sans", sans-serif';
        const bookTitle = topBook.title.length > 38 ? topBook.title.slice(0, 38) + '...' : topBook.title;
        ctx.fillText(bookTitle, 120, 995);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.font = '500 22px "Inter", sans-serif';
        ctx.fillText(`by ${topBook.author}`, 120, 1035);

        ctx.fillStyle = '#FBBF24';
        ctx.font = '700 24px "Inter", sans-serif';
        ctx.fillText('★'.repeat(topBook.rating || 5), 120, 1075);

        if (topBook.reviewSnippet) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.font = 'italic 18px "Inter", sans-serif';
          ctx.fillText(`"${topBook.reviewSnippet.slice(0, 50)}..."`, 120, 1125);
        }
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '600 22px "Inter", sans-serif';
        ctx.fillText('Keep logging your reads to spotlight your favorite!', 120, 1000);
      }

      // 7. Footer
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '500 18px "Inter", sans-serif';
      ctx.fillText('reader.app • Built for passionate readers', 80, 1260);

      // Trigger download
      const imageUri = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `Reader_Wrapped_${year}_${userName.replace(/\s+/g, '_')}.png`;
      downloadLink.href = imageUri;
      downloadLink.click();
    } catch (err) {
      console.error('Failed to generate image:', err);
    } finally {
      setDownloading(false);
    }
  };

  // Copy shareable summary text / image
  const handleCopyShare = async () => {
    try {
      const shareText = `📚 My Reader Wrapped ${year}!\n\n• Books Read: ${completedCount}/${target} (${percentage}%)\n• Reading Persona: ${persona?.title}\n• Top Genre: ${topGenre}\n• Longest Streak: ${longestStreak} days\n\nTrack your reading at Reader! #ReaderWrapped${year}`;
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  // Share on Twitter/X
  const handleTweetShare = () => {
    const tweet = `My ${year} Reader Wrapped is here! 📖✨ I've read ${completedCount} books so far and my reading persona is "${persona?.title}". Top genre: ${topGenre}! #ReaderWrapped${year}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="wrapped-modal-overlay" onClick={onClose}>
      <div className="wrapped-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Top Bar */}
        <div className="wrapped-modal-header">
          <div className="wrapped-brand">
            <Sparkles className="wrapped-sparkle-icon" size={20} />
            <span>READER WRAPPED <strong>'{String(year).slice(-2)}</strong></span>
          </div>

          <div className="wrapped-view-tabs">
            <button 
              className={`wrapped-tab-btn ${activeTab === 'poster' ? 'active' : ''}`}
              onClick={() => setActiveTab('poster')}
            >
              Poster Card
            </button>
            <button 
              className={`wrapped-tab-btn ${activeTab === 'story' ? 'active' : ''}`}
              onClick={() => setActiveTab('story')}
            >
              Interactive Story
            </button>
          </div>

          <button className="wrapped-close-btn" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="wrapped-modal-body">
          {activeTab === 'poster' ? (
            <div className="wrapped-poster-wrapper">
              {/* Infographic Poster Card */}
              <div className="wrapped-poster-card" ref={posterRef}>
                <div className="poster-ambient-glow-1"></div>
                <div className="poster-ambient-glow-2"></div>

                <div className="poster-inner">
                  {/* Card Header */}
                  <div className="poster-header">
                    <div>
                      <div className="poster-tag">READER WRAPPED '{String(year).slice(-2)}</div>
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

                  {/* Big Hero Number */}
                  <div className="poster-hero-metric">
                    <span className="poster-subtext">BOOKS COMPLETED</span>
                    <div className="poster-big-count">{completedCount}</div>
                    <div className="poster-pills-row">
                      <span className="poster-pill highlight">{percentage}% of {target} goal</span>
                      <span className="poster-pill">~{estimatedPages.toLocaleString()} pages</span>
                    </div>
                  </div>

                  {/* Persona Feature */}
                  <div className="poster-persona-box">
                    <div className="poster-persona-badge">{persona?.badge}</div>
                    <h4 className="poster-persona-title">{persona?.title}</h4>
                    <p className="poster-persona-desc">{persona?.description}</p>
                  </div>

                  {/* Two Column Highlights */}
                  <div className="poster-grid-stats">
                    <div className="poster-stat-card">
                      <span className="stat-card-label">TOP GENRE</span>
                      <h5 className="stat-card-value text-emerald">{topGenre}</h5>
                      <span className="stat-card-sub">Your favorite territory</span>
                    </div>

                    <div className="poster-stat-card">
                      <span className="stat-card-label">LONGEST STREAK</span>
                      <h5 className="stat-card-value text-amber">{longestStreak} Days</h5>
                      <span className="stat-card-sub">{totalDaysActive} active days</span>
                    </div>
                  </div>

                  {/* Standout Book */}
                  {topBook && (
                    <div className="poster-topbook-row">
                      <img 
                        src={topBook.coverImage ? topBook.coverImage.replace('-S.jpg', '-L.jpg') : FALLBACK_IMAGE} 
                        alt={topBook.title}
                        className="poster-book-thumb"
                        onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE; }}
                      />
                      <div className="poster-book-meta">
                        <span className="poster-book-tag">TOP RATED READ</span>
                        <div className="poster-book-title">{topBook.title}</div>
                        <div className="poster-book-author">by {topBook.author}</div>
                        <div className="poster-book-stars">{'★'.repeat(topBook.rating || 5)}</div>
                      </div>
                    </div>
                  )}

                  {/* Poster Footer */}
                  <div className="poster-footer">
                    <span>reader.app</span>
                    <span>#ReaderWrapped{year}</span>
                  </div>
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
                    <ChevronLeft size={22} />
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
                    {storyIndex < storySlides.length - 1 ? <ChevronRight size={22} /> : 'See Poster'}
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
            <Download size={18} />
            {downloading ? 'Generating PNG...' : 'Download Infographic (PNG)'}
          </button>

          <button 
            className="wrapped-btn-secondary" 
            onClick={handleCopyShare}
          >
            {copied ? <Check size={18} color="#34D399" /> : <Copy size={18} />}
            {copied ? 'Copied Stats!' : 'Copy Summary'}
          </button>

          <button 
            className="wrapped-btn-secondary tweet-btn" 
            onClick={handleTweetShare}
          >
            <Share2 size={18} />
            Share on X
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReaderWrappedModal;
