import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Flame, Trophy, Calendar, Check, BookOpen, Sparkles } from 'lucide-react';
import './ReadingHeatmap.css';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ReadingHeatmap = ({ user }) => {
  const [activityData, setActivityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggingToday, setLoggingToday] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetchActivity();
  }, [user]);

  const fetchActivity = async () => {
    if (!user) return;
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/reading/activity?today=${todayStr}`, config);
      setActivityData(data);
    } catch (error) {
      console.error('Failed to load reading activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogToday = async () => {
    if (!user || loggingToday) return;
    setLoggingToday(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.post(`${import.meta.env.VITE_API_URL}/api/reading/log`, { date: todayStr }, config);
      setActivityData(prev => ({
        ...prev,
        activityMap: data.activityMap,
        currentStreak: data.currentStreak,
        longestStreak: data.longestStreak,
        totalDaysRead: data.totalDaysRead,
        todayLogged: true
      }));
    } catch (error) {
      console.error('Failed to log reading:', error);
    } finally {
      setLoggingToday(false);
    }
  };

  // Generate 52 weeks (365-371 days) leading up to today aligned to week days
  const calendarData = useMemo(() => {
    const today = new Date();
    // Normalize today to UTC midnight
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const dayOfWeek = todayUTC.getUTCDay(); // 0 is Sunday, 6 is Saturday

    // End date is today, start date is 52 weeks ago starting on Sunday
    const totalDays = 52 * 7 + (dayOfWeek + 1);
    const startDate = new Date(todayUTC);
    startDate.setUTCDate(startDate.getUTCDate() - (totalDays - 1));

    const weeks = [];
    let currentWeek = [];
    const monthHeaders = [];

    let iterateDate = new Date(startDate);
    let prevMonth = -1;

    for (let i = 0; i < totalDays; i++) {
      const dateStr = iterateDate.toISOString().split('T')[0];
      const month = iterateDate.getUTCMonth();
      const day = iterateDate.getUTCDay();

      // Check for month label at the start of a week or month change
      if (day === 0) {
        if (month !== prevMonth && i < totalDays - 14) {
          monthHeaders.push({
            weekIndex: weeks.length,
            label: MONTH_NAMES[month]
          });
          prevMonth = month;
        }
      }

      const count = activityData?.activityMap?.[dateStr] || 0;
      let level = 0;
      if (count >= 5) level = 4;
      else if (count >= 3) level = 3;
      else if (count >= 2) level = 2;
      else if (count >= 1) level = 1;

      currentWeek.push({
        date: dateStr,
        count,
        level,
        displayDate: iterateDate.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      });

      if (day === 6 || i === totalDays - 1) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      iterateDate.setUTCDate(iterateDate.getUTCDate() + 1);
    }

    return { weeks, monthHeaders };
  }, [activityData]);

  const handleCellMouseEnter = (e, cell) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 8
    });
    setHoveredCell(cell);
  };

  const handleCellMouseLeave = () => {
    setHoveredCell(null);
  };

  if (loading) {
    return (
      <div className="reading-heatmap-card glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
      </div>
    );
  }

  const { currentStreak = 0, longestStreak = 0, totalDaysRead = 0, todayLogged = false } = activityData || {};

  return (
    <div className="reading-heatmap-card glass-panel animate-fade-in">
      {/* Top Header & Stats */}
      <div className="heatmap-header">
        <div className="heatmap-title-area">
          <h3>
            <Calendar size={22} className="title-icon" /> Reading Activity & Streaks
          </h3>
          <p className="heatmap-subtitle">Track your reading habits and build daily momentum.</p>
        </div>

        <button 
          className={`btn-log-reading ${todayLogged ? 'logged' : ''}`}
          onClick={handleLogToday}
          disabled={todayLogged || loggingToday}
          title={todayLogged ? "You've read today!" : "Record a reading session for today"}
        >
          {todayLogged ? (
            <>
              <Check size={18} strokeWidth={2.5} /> Read Today!
            </>
          ) : (
            <>
              {loggingToday ? (
                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
              ) : (
                <>
                  <BookOpen size={18} /> Log Today's Reading
                </>
              )}
            </>
          )}
        </button>
      </div>

      {/* Streak Metric Badges */}
      <div className="streak-metrics-row">
        <div className={`metric-badge ${currentStreak > 0 ? 'streak-active' : ''}`}>
          <div className="metric-icon-box flame">
            <Flame size={22} />
          </div>
          <div className="metric-details">
            <span className="metric-value">{currentStreak} {currentStreak === 1 ? 'Day' : 'Days'}</span>
            <span className="metric-label">Current Streak</span>
          </div>
        </div>

        <div className="metric-badge">
          <div className="metric-icon-box trophy">
            <Trophy size={22} />
          </div>
          <div className="metric-details">
            <span className="metric-value">{longestStreak} {longestStreak === 1 ? 'Day' : 'Days'}</span>
            <span className="metric-label">Best Streak</span>
          </div>
        </div>

        <div className="metric-badge">
          <div className="metric-icon-box calendar">
            <Sparkles size={22} />
          </div>
          <div className="metric-details">
            <span className="metric-value">{totalDaysRead} {totalDaysRead === 1 ? 'Day' : 'Days'}</span>
            <span className="metric-label">Days Read This Year</span>
          </div>
        </div>
      </div>

      {/* Heatmap Contribution Graph */}
      <div className="heatmap-graph-wrapper custom-scrollbar">
        <div className="heatmap-graph-inner">
          {/* Month labels row */}
          <div className="month-labels-row">
            <div className="day-label-spacer"></div>
            <div className="month-labels-container">
              {calendarData.monthHeaders.map((m, idx) => (
                <span 
                  key={idx} 
                  className="month-label"
                  style={{ left: `${m.weekIndex * 15}px` }}
                >
                  {m.label}
                </span>
              ))}
            </div>
          </div>

          {/* Grid area with day names on the left */}
          <div className="grid-with-day-labels">
            <div className="day-labels-col">
              <span className="day-label">Mon</span>
              <span className="day-label">Wed</span>
              <span className="day-label">Fri</span>
            </div>

            <div className="heatmap-columns">
              {calendarData.weeks.map((week, wIdx) => (
                <div key={wIdx} className="heatmap-week-col">
                  {week.map(cell => (
                    <div
                      key={cell.date}
                      className={`heatmap-cell level-${cell.level}`}
                      onMouseEnter={(e) => handleCellMouseEnter(e, cell)}
                      onMouseLeave={handleCellMouseLeave}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Graph Footer: Legend */}
          <div className="heatmap-footer">
            <span className="footer-tip">
              {todayLogged ? "🎉 Awesome! You've maintained your streak today." : "💡 Tip: Shelving a book, reviewing, or logging chapters counts toward your streak."}
            </span>
            <div className="heatmap-legend">
              <span className="legend-text">Less</span>
              <div className="heatmap-cell level-0" />
              <div className="heatmap-cell level-1" />
              <div className="heatmap-cell level-2" />
              <div className="heatmap-cell level-3" />
              <div className="heatmap-cell level-4" />
              <span className="legend-text">More</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredCell && (
        <div 
          className="heatmap-tooltip animate-fade-in"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`
          }}
        >
          <strong>{hoveredCell.count === 0 ? 'No reading activity' : `${hoveredCell.count} reading action${hoveredCell.count === 1 ? '' : 's'}`}</strong>
          <span>{hoveredCell.displayDate}</span>
        </div>
      )}
    </div>
  );
};

export default ReadingHeatmap;
