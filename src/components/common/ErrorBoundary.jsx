import React, { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[RUNCLASH ERROR BOUNDARY]', error, errorInfo);
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
          <p style={{ fontSize: '12px', color: '#888888', maxWidth: '320px', margin: 0, lineHeight: 1.5 }}>
            {this.state.error ? this.state.error.toString() : 'An unexpected UI state occurred.'}
          </p>
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
