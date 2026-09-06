import React, { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[RUNCLASH ERROR BOUNDARY]', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '30px 20px',
          background: '#0B0B0D',
          color: 'white',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: '16px'
        }}>
          <span style={{ fontSize: '36px' }}>⚠️</span>
          <h2 style={{ margin: 0, color: '#FC4C02', fontSize: '18px', fontWeight: '800', textTransform: 'uppercase' }}>
            Tactical Subsystem Exception
          </h2>
          <div style={{ textAlign: 'left', background: '#222', padding: '10px', borderRadius: '8px', overflow: 'auto', maxHeight: '40vh', width: '90%' }}>
            <p style={{ fontSize: '12px', color: '#ff6b6b', margin: '0 0 10px 0', fontFamily: 'monospace' }}>
              {this.state.error ? this.state.error.toString() : 'An unexpected UI state occurred.'}
            </p>
            {this.state.error?.stack && (
              <pre style={{ fontSize: '10px', color: '#ccc', margin: '0 0 10px 0', whiteSpace: 'pre-wrap' }}>
                {this.state.error.stack}
              </pre>
            )}
            {this.state.errorInfo?.componentStack && (
              <pre style={{ fontSize: '10px', color: '#888', margin: 0, whiteSpace: 'pre-wrap' }}>
                {this.state.errorInfo.componentStack}
              </pre>
            )}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#FC4C02',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '12px',
              fontWeight: '800',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Reboot Interface
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
