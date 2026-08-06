import React from 'react';
import { RefreshCw, Trash2, AlertOctagon } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ERROR BOUNDARY] error captured:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleClearCacheAndRetry = () => {
    try {
      localStorage.removeItem('clash_user');
      localStorage.removeItem('runclash-supabase-auth');
      localStorage.removeItem('clash_identity_migrated_v1');
    } catch (e) {
      console.warn('[ERROR BOUNDARY] Cache clear warning:', e);
    }
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#0B0B0B',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '420px',
            width: '100%',
            backgroundColor: '#141414',
            border: '1px solid #2A2A2A',
            borderRadius: '20px',
            padding: '32px 24px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(252, 76, 2, 0.1)',
              border: '1px solid rgba(252, 76, 2, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto'
            }}>
              <AlertOctagon size={32} style={{ color: '#FC4C02' }} />
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
              RunClash could not start
            </h2>

            <p style={{ fontSize: '13px', color: '#A0A0A0', margin: '0 0 28px 0', lineHeight: '1.5' }}>
              A temporary initialization error occurred. Your workout and territory progress is safe.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={this.handleRetry}
                style={{
                  height: '46px',
                  backgroundColor: '#FC4C02',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <RefreshCw size={16} />
                Retry
              </button>

              <button
                onClick={this.handleClearCacheAndRetry}
                style={{
                  height: '46px',
                  backgroundColor: 'transparent',
                  color: '#A0A0A0',
                  border: '1px solid #2A2A2A',
                  borderRadius: '12px',
                  fontWeight: '600',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Trash2 size={16} />
                Clear Stale Cache & Retry
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
