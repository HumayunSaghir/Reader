import React, { useState, useEffect, useContext, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthContext } from './contexts/AuthContext';
import usePageTitle from './hooks/usePageTitle';

// Each page is its own chunk, so the first visit only downloads what it shows
const Home = lazy(() => import('./pages/Home'));
const Search = lazy(() => import('./pages/Search'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const BookDetail = lazy(() => import('./pages/BookDetail'));
const Profile = lazy(() => import('./pages/Profile'));
const Clubs = lazy(() => import('./pages/Clubs'));
const ClubDetail = lazy(() => import('./pages/ClubDetail'));
const Discover = lazy(() => import('./pages/Discover'));
const Tags = lazy(() => import('./pages/Tags'));

const PageFallback = () => (
  <div className="loading" style={{ padding: '4rem 0' }} aria-busy="true">
    <div className="spinner" />
  </div>
);

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

// Signed-in users have no reason to see the login/register forms
const GuestOnly = ({ children }) => {
  const { user } = useContext(AuthContext);
  return user ? <Navigate to="/" replace /> : children;
};

const NotFound = () => {
  usePageTitle('Page not found');
  return (
    <div className="empty-state" style={{ margin: '3rem auto', maxWidth: 520 }}>
      <h3>Page not found</h3>
      <p style={{ marginBottom: '1.25rem' }}>The page you're looking for doesn't exist or has moved.</p>
      <Link to="/" className="btn-primary">Back to home</Link>
    </div>
  );
};

const Footer = () => (
  <footer className="site-footer">
    <div className="container">
      <span>© {new Date().getFullYear()} Reader. Book data from Open Library.</span>
      <nav aria-label="Footer">
        <Link to="/">Home</Link>
        <Link to="/discover">Swipe</Link>
        <Link to="/tags">Tropes</Link>
        <Link to="/clubs">Book Clubs</Link>
      </nav>
    </div>
  </footer>
);

const AppRoutes = () => {
  const location = useLocation();
  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
          <Route path="/books/:id" element={<BookDetail />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/clubs" element={<Clubs />} />
          <Route path="/clubs/:id" element={<ClubDetail />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/tags" element={<Tags />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

function App() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('theme') || 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // Storage unavailable: theme just won't persist
    }
  }, [theme]);

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  return (
    <Router>
      <ScrollToTop />
      <div className="app-container">
        <a href="#main" className="visually-hidden">Skip to content</a>
        <Navbar toggleTheme={toggleTheme} theme={theme} />
        <main id="main" className="main-content container">
          <AppRoutes />
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
