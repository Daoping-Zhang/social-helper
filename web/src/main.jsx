import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import './styles.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[App Error]', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ maxWidth: 560, margin: '40px auto', padding: 20, fontFamily: 'sans-serif', color: '#111' }}>
          <h2 style={{ marginTop: 0 }}>页面出错了</h2>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#fee2e2', color: '#b91c1c', padding: 14, borderRadius: 10, fontSize: 13, overflow: 'auto' }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 16px', cursor: 'pointer' }}>刷新页面</button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </ErrorBoundary>
);
