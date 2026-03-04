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

// -----------------------------------------------------------------------------
// 🚧 TEMPORARY PLACEHOLDERS: To prevent build crashes during the fracture.
// These will be extracted into client/src/pages/ in the upcoming steps.
// -----------------------------------------------------------------------------
const GlobalHome = ({ view }) => (
  <div style={{ minHeight: '100vh', background: '#0b0f19', color: '#00d4ff', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace', textAlign: 'center' }}>
    <h1>[ GLOBAL {view === 'history' ? 'HISTORY' : 'HOME'} PAGE ]<br/><span style={{fontSize:'1rem', color:'#aaa'}}>Select Organization</span></h1>
  </div>
);

const GlobalAdmin = () => (
  <div style={{ minHeight: '100vh', background: '#0b0f19', color: '#ff4444', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace', textAlign: 'center' }}>
    <h1>[ GLOBAL ADMIN PANEL ]<br/><span style={{fontSize:'1rem', color:'#aaa'}}>System Management</span></h1>
  </div>
);

const TournamentDashboard = () => (
  <div style={{ minHeight: '100vh', background: '#0b0f19', color: '#ffd700', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace', textAlign: 'center' }}>
    <h1>[ TOURNAMENT DASHBOARD ]<br/><span style={{fontSize:'1rem', color:'#aaa'}}>/:orgId/:tournamentId</span></h1>
  </div>
);

const VetoRoom = () => (
  <div style={{ minHeight: '100vh', background: '#0b0f19', color: '#00ff00', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace', textAlign: 'center' }}>
    <h1>[ LIVE VETO ROOM ]<br/><span style={{fontSize:'1rem', color:'#aaa'}}>/:orgId/:tournamentId/veto/:matchId</span></h1>
  </div>
);

const NotFound = () => (
  <div style={{ minHeight: '100vh', background: '#0b0f19', color: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace' }}>
    <h1>404 - SECTOR NOT FOUND</h1>
  </div>
);
// -----------------------------------------------------------------------------

export default function App() {
  return (
    <Routes>
      {/* Legacy / Global Routes */}
      <Route path="/" element={<GlobalHome />} />
      <Route path="/admin" element={<GlobalAdmin />} />
      <Route path="/history" element={<GlobalHome view="history" />} />

      {/* Multi-Tenant White-Labeled Routes */}
      <Route path="/:orgId" element={<Navigate to="/" replace />} />
      <Route path="/:orgId/:tournamentId" element={<TournamentDashboard />} />
      <Route path="/:orgId/:tournamentId/veto/:matchId" element={<VetoRoom />} />

      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
