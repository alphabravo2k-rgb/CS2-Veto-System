/**
 * ⚡ COMP-OS — VETO ENGINE CLIENT
 * =============================================================================
 * FILE          : App.jsx
 * RESPONSIBILITY: Declarative Multi-Tenant Routing Map
 * LAYER         : Frontend Routing
 * RISK LEVEL    : SECURE (Stateless)
 * =============================================================================
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// 1. IMPORT THE NEWLY CREATED PAGES
import GlobalHome from './pages/GlobalHome';
import NotFound from './pages/NotFound';
import TournamentDashboard from './pages/TournamentDashboard';

// 2. TEMPORARY PLACEHOLDERS FOR PHASE 2 (To prevent build crashes)
// We will extract these into their own files next!
const GlobalAdmin = () => (
  <div style={{ minHeight: '100vh', background: '#0b0f19', color: '#ff4444', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace', textAlign: 'center' }}>
    <h1>[ GLOBAL ADMIN PANEL ]<br/><span style={{fontSize:'1rem', color:'#aaa'}}>System Management Loading...</span></h1>
  </div>
);

const VetoRoom = () => (
  <div style={{ minHeight: '100vh', background: '#0b0f19', color: '#00ff00', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace', textAlign: 'center' }}>
    <h1>[ LIVE VETO ROOM ]<br/><span style={{fontSize:'1rem', color:'#aaa'}}>Initializing WebSockets...</span></h1>
  </div>
);

export default function App() {
  return (
    <Routes>
      {/* Legacy / Global Routes */}
      <Route path="/" element={<GlobalHome />} />
      <Route path="/admin" element={<GlobalAdmin />} />
      <Route path="/history" element={<GlobalHome view="history" />} />

      {/* Multi-Tenant White-Labeled Routes */}
      <Route path="/:orgId" element={<Navigate to="/" replace />} />
      
      {/* The Match Creator Dashboard */}
      <Route path="/:orgId/:tournamentId" element={<TournamentDashboard />} />
      
      {/* The Live Veto Engine */}
      <Route path="/:orgId/:tournamentId/veto/:matchId" element={<VetoRoom />} />

      {/* Fallback 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
