import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../contexts/AuthContext';
import { FALLBACK_IMAGE } from '../assets/fallbackImage';
import { Send, Eye, EyeOff, Users, BookOpen, Trash2, Check } from 'lucide-react';
import './ClubDetail.css';

const ClubDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext);
  
  const [chatInput, setChatInput] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);
  
  const [revealedSpoilers, setRevealedSpoilers] = useState(new Set());
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchClub();
    const interval = setInterval(fetchClub, 10000); // poll every 10s for new messages
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    scrollToBottom();
  }, [club?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchClub = async () => {
    try {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/clubs/${id}`);
      setClub(data);
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const handleJoinClub = async () => {
    if (!user) return alert('Please login to join the club');
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data: members } = await axios.post(`${import.meta.env.VITE_API_URL}/api/clubs/${id}/join`, {}, config);
      setClub({ ...club, members });
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'Failed to join club');
    }
  };

  const handleToggleChapter = async (chapterIndex, isChecked) => {
    if (!user) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const action = isChecked ? 'add' : 'remove';
      const { data } = await axios.put(`${import.meta.env.VITE_API_URL}/api/clubs/${id}/progress`, { chapterIndex, action }, config);
      
      const updatedMembers = club.members.map(m => 
        m.user._id === user._id ? { ...m, progress: data.progress, readChapters: data.readChapters } : m
      );
      setClub({ ...club, members: updatedMembers });
    } catch (error) {
      console.error(error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!user || !chatInput.trim()) return;

    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data: newMessage } = await axios.post(`${import.meta.env.VITE_API_URL}/api/clubs/${id}/messages`, {
        text: chatInput,
        isSpoiler
      }, config);
      
      setClub({ ...club, messages: [...club.messages, newMessage] });
      setChatInput('');
      setIsSpoiler(false);
    } catch (error) {
      console.error(error);
    }
  };

  const toggleSpoiler = (msgId) => {
    const newRevealed = new Set(revealedSpoilers);
    if (newRevealed.has(msgId)) {
      newRevealed.delete(msgId);
    } else {
      newRevealed.add(msgId);
    }
    setRevealedSpoilers(newRevealed);
  };

  if (loading) return <div className="loading" style={{ padding: '4rem 0' }}><div className="spinner"></div></div>;
  if (!club) return <div className="loading">Club not found</div>;

  const isMember = user ? club.members.some(m => m.user._id === user._id) : false;
  const myMemberInfo = isMember ? club.members.find(m => m.user._id === user._id) : null;
  const creatorId = club?.creator?._id 
    ? club.creator._id.toString() 
    : (club?.creator ? club.creator.toString() : null);
  const currentUserId = user?._id ? user._id.toString() : null;
  const isCreator = Boolean(currentUserId && creatorId && currentUserId === creatorId);

  const handleDeleteClub = async () => {
    if (!window.confirm(`Are you sure you want to delete "${club.name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/clubs/${id}`, config);
      navigate('/clubs');
    } catch (error) {
      console.error('Failed to delete club:', error);
      alert(error.response?.data?.message || 'Failed to delete club');
    }
  };

  return (
    <div className="club-detail-page animate-fade-in">
      <div className="club-detail-header glass-panel">
        <img 
          src={club.book?.coverImage ? club.book.coverImage.replace('-S.jpg', '-M.jpg') : FALLBACK_IMAGE} 
          alt={club.book?.title} 
          className="club-book-cover"
          onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE; }}
        />
        <div className="club-header-info">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0 }}>{club.name}</h1>
            {isCreator && (
              <button 
                onClick={handleDeleteClub}
                className="btn-delete-club"
                title="Delete this book club"
              >
                <Trash2 size={16} /> Delete Club
              </button>
            )}
          </div>
          <p className="description">{club.description || 'No description provided.'}</p>
          <Link to={`/books/${club.book?._id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#10B981', textDecoration: 'none', marginTop: '1rem', fontWeight: 'bold' }}>
            <BookOpen size={18} /> Reading: {club.book?.title}
          </Link>
          
          <div style={{ marginTop: '1.5rem' }}>
            {!isMember ? (
              <button className="btn-primary" onClick={handleJoinClub}>Join Club</button>
            ) : (
              <div className="my-progress-section">
                <div className="progress-header-row">
                  <div className="progress-title-badge">
                    <span>Reading Progress</span>
                    <span className="progress-percent-pill">{myMemberInfo?.progress || 0}%</span>
                  </div>
                  <div className="progress-counter-text">
                    {myMemberInfo?.readChapters?.length || 0} of {club.chapters?.length || club.totalChapters || 10} chapters completed
                  </div>
                </div>

                <div className="my-progress-bar-bg">
                  <div className="my-progress-bar-fill" style={{ width: `${myMemberInfo?.progress || 0}%` }}></div>
                </div>

                <div className="chapter-checklist-grid">
                  {((club.chapters && club.chapters.length > 0)
                    ? club.chapters
                    : Array.from({ length: club.totalChapters || 10 }, (_, i) => `Chapter ${i + 1}`)
                  ).map((chapterTitle, i) => {
                    const chapterNum = i + 1;
                    const isChecked = myMemberInfo?.readChapters?.includes(chapterNum);
                    return (
                      <div 
                        key={chapterNum}
                        onClick={() => handleToggleChapter(chapterNum, !isChecked)}
                        className={`chapter-pill-item ${isChecked ? 'checked' : ''}`}
                        title={chapterTitle}
                      >
                        <div className="custom-check-box">
                          {isChecked && <Check size={12} strokeWidth={3} />}
                        </div>
                        <span className="chapter-pill-label">
                          {chapterTitle}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="club-layout">
        <div className="club-members-panel glass-panel">
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={20}/> Members ({club.members.length})</h3>
          <div className="members-list">
            {club.members.map(member => (
              <div key={member._id} className="member-item">
                <div className="member-info">
                  <div className="avatar small">
                    {member.user.avatar ? (
                      <img src={`${import.meta.env.VITE_API_URL}${member.user.avatar}`} alt="Avatar" />
                    ) : (
                      member.user.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span>{member.user.name}</span>
                </div>
                <div className="progress-container">
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${member.progress || 0}%` }}></div>
                  </div>
                  <span className="progress-text">{member.progress || 0}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="club-chat-panel glass-panel">
          <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>Discussion Room</h3>
          
          <div className="chat-messages">
            {club.messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>
                No messages yet. Be the first to start the discussion!
              </div>
            )}
            
            {club.messages.map(msg => {
              const isMine = user && msg.user._id === user._id;
              const isRevealed = revealedSpoilers.has(msg._id);
              
              return (
                <div key={msg._id} className={`chat-message-wrapper ${isMine ? 'mine' : 'theirs'}`}>
                  {!isMine && (
                    <div className="avatar x-small">
                      {msg.user.avatar ? (
                        <img src={`${import.meta.env.VITE_API_URL}${msg.user.avatar}`} alt="Avatar" />
                      ) : (
                        msg.user.name.charAt(0).toUpperCase()
                      )}
                    </div>
                  )}
                  
                  <div className={`chat-bubble ${msg.isSpoiler && !isRevealed ? 'spoiler-hidden' : ''}`}>
                    {!isMine && <div className="chat-sender-name">{msg.user.name}</div>}
                    
                    {msg.isSpoiler && !isRevealed ? (
                      <div className="spoiler-overlay" onClick={() => toggleSpoiler(msg._id)}>
                        <EyeOff size={16} /> Click to reveal spoiler
                      </div>
                    ) : (
                      <div className="chat-text">
                        {msg.text}
                        {msg.isSpoiler && <button className="hide-spoiler-btn" onClick={() => toggleSpoiler(msg._id)}><Eye size={12}/> Hide</button>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {isMember ? (
            <form onSubmit={handleSendMessage} className="chat-input-area">
              <div className="chat-input-wrapper">
                <input 
                  type="text" 
                  value={chatInput} 
                  onChange={e => setChatInput(e.target.value)} 
                  placeholder="Share your thoughts..." 
                  className="chat-input"
                />
                <button 
                  type="button"
                  className={`spoiler-toggle-btn ${isSpoiler ? 'active' : ''}`}
                  onClick={() => setIsSpoiler(!isSpoiler)}
                  title={isSpoiler ? "Spoiler ON" : "Spoiler OFF"}
                >
                  {isSpoiler ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
                <button type="submit" className="chat-send-btn" disabled={!chatInput.trim()}>
                  <Send size={18} />
                </button>
              </div>
            </form>
          ) : (
            <div className="chat-input-area locked">
              <p>Join the club to participate in the discussion.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClubDetail;
