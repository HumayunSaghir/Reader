import React from 'react';

// Catches render errors so one broken page doesn't blank the whole app.
// Also recovers from stale lazy chunks after a deploy by offering a reload.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  componentDidUpdate(prevProps) {
    // Navigating elsewhere clears the error
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    const isChunkError = /Loading chunk|dynamically imported module|Importing a module script failed/i.test(this.state.error.message || '');
    return (
      <div className="empty-state" role="alert" style={{ margin: '3rem auto', maxWidth: 520 }}>
        <h3>{isChunkError ? 'A new version is available' : 'Something went wrong'}</h3>
        <p style={{ marginBottom: '1.25rem' }}>
          {isChunkError ? 'Reload to get the latest version of Reader.' : 'This page hit an unexpected error. Reloading usually fixes it.'}
        </p>
        <button className="btn-primary" onClick={() => window.location.reload()}>Reload page</button>
      </div>
    );
  }
}

export default ErrorBoundary;
