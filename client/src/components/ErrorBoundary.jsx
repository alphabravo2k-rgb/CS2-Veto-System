import React from 'react';
import { GlassPanel, NeonText, NeonButton } from './veto/VetoUIPrimitives';
import { RefreshIcon, HomeIcon } from './SharedUI';

/**
 * 🛡️ UI RESILIENCE LAYER — REACT ERROR BOUNDARY
 * =============================================================================
 * Responsibility: Catching JavaScript errors in the child component tree,
 * logging them to telemetry, and displaying a premium fallback UI instead of 
 * the "White Screen of Death".
 * =============================================================================
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("[CRITICAL ERROR CAUGHT]", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          minHeight: '100vh', 
          background: '#050a14', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '20px'
        }}>
          <GlassPanel style={{ maxWidth: '600px', width: '100%', padding: '40px', textAlign: 'center' }}>
            <div style={{ marginBottom: '24px', display: 'inline-block', padding: '20px', borderRadius: '50%', background: 'rgba(255, 75, 43, 0.1)', border: '2px solid #ff4b2b' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ff4b2b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </div>
            
            <NeonText fontSize="1.5rem" style={{ marginBottom: '16px' }}>SYSTEM ANOMALY DETECTED</NeonText>
            
            <p style={{ color: '#aaa', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '32px' }}>
              The application encountered an unexpected runtime error. We've logged the technical details and our engineering team has been notified.
            </p>

            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <NeonButton onClick={() => window.location.reload()}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RefreshIcon size={16} /> REBOOT SYSTEM
                </div>
              </NeonButton>
              <button 
                onClick={() => window.location.href = '/'}
                className="glass-panel"
                style={{ 
                  padding: '12px 24px', 
                  fontSize: '12px', 
                  fontWeight: 900, 
                  letterSpacing: '2px', 
                  cursor: 'pointer',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HomeIcon size={16} /> RETURN TO BASE
                </div>
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{ marginTop: '40px', textAlign: 'left', background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <summary style={{ fontSize: '10px', color: '#ff4b2b', cursor: 'pointer', fontWeight: 900, letterSpacing: '1px' }}>TECHNICAL TELEMETRY</summary>
                <pre style={{ marginTop: '12px', fontSize: '11px', color: '#666', overflowX: 'auto', fontFamily: 'monospace' }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </GlassPanel>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
