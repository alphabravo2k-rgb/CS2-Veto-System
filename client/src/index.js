// File: client/src/main.jsx (or index.js depending on your Vite setup)
/**
 * ⚡ COMP-OS — REACT MOUNT POINT
 * =============================================================================
 * FILE          : src/main.jsx
 * RESPONSIBILITY: Mounts the React application to the DOM
 * LAYER         : Frontend Entry
 * VERSION       : v2.0.0 (RESILIENT-MOUNT)
 * * FEATURES:
 * - React 18 Concurrent Root API.
 * - StrictMode enforced for development side-effect catching.
 * - CSS Conflict Purged: index.css import removed.
 * - Resilience Guard: Fallback UI injected if root DOM node is missing.
 * =============================================================================
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');

// 🛡️ RESILIENCE FIX: Guard against missing root element (prevents silent white screen)
if (!container) {
    document.body.innerHTML = `
        <div style="color:#ff4444; padding:20px; font-family:monospace; background:#0b0f19; min-height:100vh; font-size:1.2rem; display:flex; align-items:center; justify-content:center; text-align:center;">
            <div>
                <h2>[FATAL ERROR]</h2>
                <p>Root element #root missing from DOM.</p>
                <p>The application cannot mount. Please check your index.html file.</p>
            </div>
        </div>
    `;
    throw new Error('[FATAL] Root element #root missing from DOM.');
}

const root = ReactDOM.createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
