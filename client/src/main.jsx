/**
 * ⚡ COMP-OS — REACT MOUNT POINT
 * =============================================================================
 * FILE          : src/main.jsx
 * RESPONSIBILITY: Mounts the React application to the DOM
 * LAYER         : Frontend Entry
 * VERSION       : v2.2.0 (ROUTED-MOUNT)
 * * FEATURES:
 * - React 19 Concurrent Root API.
 * - StrictMode enforced for development side-effect catching.
 * - Global Error Boundary: Catches React render errors to prevent white-screens.
 * - XSS-Safe Resilience Guard: Fallback UI injected using secure DOM methods.
 * - Multi-Tenant Routing: BrowserRouter injected for dynamic URL parsing.
 * =============================================================================
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // 🛡️ ARCHITECTURE FIX: Inject Router
import App from './App';

// 🛡️ RELIABILITY FIX: Global Error Boundary catches render-phase crashes
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: '#ff4444', padding: '20px', fontFamily: 'monospace', background: '#0b0f19', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div>
            <h2>[APPLICATION CRASH]</h2>
            <p>The CS2 Veto Engine encountered a critical error.</p>
            <button 
              onClick={() => window.location.reload()} 
              style={{ marginTop: '20px', padding: '10px 20px', background: '#ff4444', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
            >
              RELOAD APPLICATION
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const container = document.getElementById('root');

// 🛡️ SECURITY & RESILIENCE FIX: Guard against missing root using XSS-safe DOM methods
if (!container) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = "color:#ff4444; padding:20px; font-family:monospace; background:#0b0f19; min-height:100vh; font-size:1.2rem; display:flex; align-items:center; justify-content:center; text-align:center;";
    
    const contentDiv = document.createElement('div');
    const header = document.createElement('h2');
    header.textContent = "[FATAL ERROR]";
    
    const p1 = document.createElement('p');
    p1.textContent = "Root element #root missing from DOM.";
    
    const p2 = document.createElement('p');
    p2.textContent = "The application cannot mount. Please check your index.html file.";
    
    contentDiv.appendChild(header);
    contentDiv.appendChild(p1);
    contentDiv.appendChild(p2);
    errorDiv.appendChild(contentDiv);
    
    document.body.appendChild(errorDiv);
    
    throw new Error('[FATAL] Root element #root missing from DOM.');
}

const root = ReactDOM.createRoot(container);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
