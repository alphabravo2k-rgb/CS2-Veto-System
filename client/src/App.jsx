/**
 * ⚡ APP ROUTING — PREMIUM GLOBAL ARCHITECTURE
 * =============================================================================
 * Unified multi-tenant routing with hardware-accelerated transitions.
 * Auth-guarded sectors for organizational and administrative domains.
 * Spectator-optimized public routes for live veto theaters.
 * =============================================================================
 */

import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import useAuthStore from './store/useAuthStore';

// Pages
import GlobalHome        from './pages/GlobalHome';
import NotFound          from './pages/NotFound';
import TournamentDashboard from './pages/TournamentDashboard';
import Login             from './pages/Login';
import Register          from './pages/Register';
import OrgCreate         from './pages/OrgCreate';
import OrgDashboard      from './pages/OrgDashboard';
import PlayerProfile     from './pages/PlayerProfile';
import ProfileEdit       from './pages/ProfileEdit';

// Components
import TopNav from './components/layout/TopNav';
import BrandingProvider from './components/layout/BrandingProvider';

// Lazy-loaded Command Centers
const GlobalAdmin = React.lazy(() => import('./pages/GlobalAdmin'));
const VetoRoom    = React.lazy(() => import('./pages/VetoRoom'));

/**
 * 🛰️ SECURE SECTOR GUARD
 * Redirects unauthorized signals to the authentication portal.
 */
function ProtectedRoute({ children }) {
    const { isAuthenticated, isLoading } = useAuthStore();
    const location = useLocation();

    if (isLoading) return <div style={{ minHeight: '100vh', background: '#050a14' }} />;

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
}

export default function App() {
    const { initialize } = useAuthStore();

    useEffect(() => {
        initialize();
    }, [initialize]);

    return (
        <React.Suspense fallback={<div style={{ minHeight: '100vh', background: '#050a14' }} />}>
            <div className="app-container" style={{ minHeight: '100vh', background: '#050a14', color: '#fff' }}>
                <TopNav />
                
                <div className="app-content" style={{ paddingTop: '56px' }}>
                    <BrandingProvider>
                        <Routes>
                            {/* ── SECTOR 0: PUBLIC ACCESS ── */}
                            <Route path="/"          element={<GlobalHome />} />
                            <Route path="/login"     element={<Login />} />
                            <Route path="/register"  element={<Register />} />
                            <Route path="/history"   element={<GlobalHome view="history" />} />
                            <Route path="/players/:userId" element={<PlayerProfile />} />

                            {/* ── SECTOR 1: PROTECTED OPERATIONS ── */}
                            <Route path="/profile"     element={<ProtectedRoute><ProfileEdit /></ProtectedRoute>} />
                            <Route path="/profile/edit" element={<ProtectedRoute><ProfileEdit /></ProtectedRoute>} />
                            <Route path="/orgs/create"  element={<ProtectedRoute><OrgCreate /></ProtectedRoute>} />
                            <Route path="/org/:orgId"   element={<ProtectedRoute><OrgDashboard /></ProtectedRoute>} />
                            
                            {/* Unified Tournament Routes */}
                            <Route path="/org/:orgId/tournament/:tournamentId" element={<ProtectedRoute><TournamentDashboard /></ProtectedRoute>} />
                            <Route path="/org/:orgId/tournament/:tournamentId/veto/:matchId" element={<VetoRoom />} />

                            {/* ── SECTOR 9: COMMAND & CONTROL ── */}
                            <Route path="/admin" element={<ProtectedRoute><GlobalAdmin /></ProtectedRoute>} />

                            {/* ── LEGACY SIGNAL COMPATIBILITY ── */}
                            <Route path="/:orgId/:tournamentId" element={<TournamentDashboard />} />
                            <Route path="/:orgId/:tournamentId/veto/:matchId" element={<VetoRoom />} />

                            {/* ── 404: SIGNAL LOST ── */}
                            <Route path="*" element={<NotFound />} />
                        </Routes>
                    </BrandingProvider>
                </div>
            </div>
        </React.Suspense>
    );
}
