import React from 'react';
import { Link } from 'react-router-dom';

// Shown in place of members-only content (clubs, the community feed) to signed-out visitors
const SignInPrompt = ({ title = 'Sign in to continue', message }) => (
  <div className="empty-state" style={{ margin: '2rem auto', maxWidth: 520 }}>
    <h3>{title}</h3>
    {message && <p style={{ marginBottom: '1.25rem' }}>{message}</p>}
    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
      <Link to="/login" className="btn-primary">Log in</Link>
      <Link to="/register" className="btn-secondary">Create an account</Link>
    </div>
  </div>
);

export default SignInPrompt;
