/**
 * ⚡ APP ROUTING — PREMIUM GLOBAL ARCHITECTURE
 * =============================================================================
 * Unified multi-tenant routing with hardware-accelerated transitions.
 * Auth-guarded modules for organizational and administrative domains.
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
import OrgList        from './pages/OrgList';
import TournamentPublic from './pages/TournamentPublic';

// Components
import TopNav from './components/layout/TopNav';
import BrandingProvider from './components/layout/BrandingProvider';

// Lazy-loaded Admin Dashboards
const GlobalAdmin = React.lazy(() => import('./pages/GlobalAdmin'));
const VetoRoom    = React.lazy(() => import('./pages/VetoRoom'));
const UpgradePage = React.lazy(() => import('./pages/UpgradePage'));
const ProfileEdit = React.lazy(() => import('./pages/ProfileEdit'));

import AuthVerificationGuard from './components/auth/AuthVerificationGuard';

/**
 * 🛰️ SECURE ROUTE GUARDS
 * =============================================================================
 */
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuthStore();
    const location = useLocation();

    if (loading) return <div>Checking security clearance...</div>;
    if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
    
    return children;
};

const PlatformAdminRoute = ({ children }) => {
    const { isAuthenticated, user, loading } = useAuthStore();
    const location = useLocation();

    if (loading) return <div>Validating terminal credentials...</div>;
    if (!isAuthenticated || user?.role !== 'platform_admin') {
        return <Navigate to="/" replace />;
    }
    
    return children;
};

export default function App() {
    const { initialize } = useAuthStore();

    useEffect(() => {
        initialize();
    }, [initialize]);

    return (
        <React.Suspense fallback={<div style={{ minHeight: '100vh', background: '#050a14' }} />}>
            <AuthVerificationGuard />
            <div className="app-container" style={{ minHeight: '100vh', background: '#050a14', color: '#fff' }}>
                <TopNav />
                
                <div className="app-content" style={{ paddingTop: '56px' }}>
                    <BrandingProvider>
                        <Routes>
                            {/* ── PUBLIC ACCESS ── */}
                            <Route path="/"          element={<GlobalHome />} />
                            <Route path="/login"     element={<Login />} />
                            <Route path="/register"  element={<Register />} />
                            <Route path="/history"   element={<GlobalHome view="history" />} />
                            <Route path="/players/:userId" element={<PlayerProfile />} />
                            <Route path="/org/:orgId/tournament/:tournamentId/live" element={<TournamentPublic />} />

                            {/* ── PROTECTED OPERATIONS ── */}
                            <Route path="/profile"     element={<ProtectedRoute><ProfileEdit /></ProtectedRoute>} />
                            <Route path="/profile/edit" element={<ProtectedRoute><ProfileEdit /></ProtectedRoute>} />
                            <Route path="/orgs/create"  element={<ProtectedRoute><OrgCreate /></ProtectedRoute>} />
                            <Route path="/org/:orgId"   element={<ProtectedRoute><OrgDashboard /></ProtectedRoute>} />
                            <Route path="/org/:orgId/upgrade" element={<ProtectedRoute><UpgradePage /></ProtectedRoute>} />
                            <Route path="/orgs"         element={<ProtectedRoute><OrgList /></ProtectedRoute>} />
                            
                            {/* Unified Tournament Routes */}
                            <Route path="/org/:orgId/tournament/:tournamentId" element={<ProtectedRoute><TournamentDashboard /></ProtectedRoute>} />
                            <Route path="/org/:orgId/tournament/:tournamentId/veto/:matchId" element={<VetoRoom />} />

                            {/* ── LEGACY SIGNAL COMPATIBILITY ── */}
                            <Route path="/:orgId/:tournamentId" element={<TournamentDashboard />} />
                            <Route path="/:orgId/:tournamentId/veto/:matchId" element={<VetoRoom />} />

                            {/* ── 404: SIGNAL LOST ── */}
                            {/* Master Admin Panel (Platform Admin Only) */}
                            <Route path="/admin"        element={<PlatformAdminRoute><GlobalAdmin /></PlatformAdminRoute>} />
                            
                            <Route path="*"             element={<NotFound />} />
                        </Routes>
                    </BrandingProvider>
                </div>
            </div>
        </React.Suspense>
    );
}
