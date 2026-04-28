/**
 * ⚡ APP ROUTING — PREMIUM GLOBAL ARCHITECTURE
 * =============================================================================
 * Unified multi-tenant routing with hardware-accelerated transitions.
 * Auth-guarded modules for organizational and administrative domains.
 * Spectator-optimized public routes for live veto theaters.
 * =============================================================================
 */

import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import useAuthStore from './store/useAuthStore';
import { supabase } from './utils/supabase.js';

// Pages
import GlobalHome        from './pages/GlobalHome';
import NotFound          from './pages/NotFound';
import TournamentDashboard from './pages/TournamentDashboard';
import OrgCreate         from './pages/OrgCreate';
import OrgDashboard      from './pages/OrgDashboard';
import OrgList        from './pages/OrgList';
import TournamentPublic from './pages/TournamentPublic';

// Components
import TopNav from './components/layout/TopNav';
import Footer from './components/layout/Footer';
import BrandingProvider from './components/layout/BrandingProvider';

// Lazy-loaded Admin Dashboards
const GlobalAdmin = React.lazy(() => import('./pages/GlobalAdmin'));
const PublicTournament  = React.lazy(() => import('./pages/PublicTournament'));
const EmbedVeto         = React.lazy(() => import('./pages/EmbedVeto'));

const Register      = React.lazy(() => import('./pages/Register'));
const Login         = React.lazy(() => import('./pages/Login'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const UpdatePassword = React.lazy(() => import('./pages/UpdatePassword'));
const PlayerProfile = React.lazy(() => import('./pages/PlayerProfile'));
const VetoRoom    = React.lazy(() => import('./pages/VetoRoom'));
const UpgradePage = React.lazy(() => import('./pages/UpgradePage'));
const ProfileEdit = React.lazy(() => import('./pages/ProfileEdit'));
const SupportHub = React.lazy(() => import('./pages/SupportHub'));
const QuickVeto   = React.lazy(() => import('./pages/QuickVeto'));
const StreamOverlay = React.lazy(() => import('./pages/StreamOverlay')); // NEW: Streamer Mode
const TeamManager = React.lazy(() => import('./pages/TeamManager')); // NEW: Team Repository
const DevPortal = React.lazy(() => import('./pages/DevPortal'));
const MatchResult = React.lazy(() => import('./pages/MatchResult'));

import ErrorBoundary from './components/ErrorBoundary';
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
    const { user, isAuthenticated } = useAuthStore();
    const [adminChecked, setAdminChecked] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    
    useEffect(() => {
      if (!isAuthenticated || !user) {
        setAdminChecked(true);
        return;
      }
      supabase.from('users')
        .select('role')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setIsAdmin(data?.role === 'platform_admin');
          setAdminChecked(true);
        });
    }, [user, isAuthenticated]);
    
    if (!adminChecked) return null;
    if (!isAuthenticated || !isAdmin) return <Navigate to="/" />;
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
                        <ErrorBoundary>
                            <Routes>
                                {/* ── PUBLIC ACCESS ── */}
                                <Route path="/"          element={<GlobalHome />} />
                                <Route path="/login"        element={<Login />} />
                                <Route path="/forgot-password" element={<ForgotPassword />} />
                                <Route path="/update-password" element={<UpdatePassword />} />
                                <Route path="/register"  element={<Register />} />
                                <Route path="/history"   element={<GlobalHome view="history" />} />
                                <Route path="/players/:userId" element={<PlayerProfile />} />
                                <Route path="/org/:orgId/tournament/:tournamentId/live" element={<TournamentPublic />} />
                                <Route path="/embed/veto/:matchId" element={<EmbedVeto />} />
                                <Route path="/support"   element={<SupportHub />} />
                                <Route path="/quick-veto" element={<QuickVeto />} />
                                <Route path="/veto/:matchId" element={<VetoRoom />} />
                                <Route path="/m/:matchId" element={<MatchResult />} />
                                <Route path="/overlay/:matchId" element={<StreamOverlay />} />

                                {/* ── PROTECTED OPERATIONS ── */}
                                <Route path="/profile"     element={<ProtectedRoute><ProfileEdit /></ProtectedRoute>} />
                                <Route path="/profile/edit" element={<ProtectedRoute><ProfileEdit /></ProtectedRoute>} />
                                <Route path="/orgs/create"  element={<ProtectedRoute><OrgCreate /></ProtectedRoute>} />
                                <Route path="/org/:orgId"   element={<ProtectedRoute><OrgDashboard /></ProtectedRoute>} />
                                <Route path="/org/:orgId/upgrade" element={<ProtectedRoute><UpgradePage /></ProtectedRoute>} />
                                <Route path="/orgs"         element={<ProtectedRoute><OrgList /></ProtectedRoute>} />
                                <Route path="/teams"        element={<ProtectedRoute><TeamManager /></ProtectedRoute>} />
                                
                                {/* Unified Tournament Routes */}
                                <Route path="/org/:orgId/tournament/:tournamentId" element={<ProtectedRoute><TournamentDashboard /></ProtectedRoute>} />
                                <Route path="/org/:orgId/developer" element={<ProtectedRoute><DevPortal /></ProtectedRoute>} />
                                <Route path="/org/:orgId/tournament/:tournamentId/veto/:matchId" element={<VetoRoom />} />

                                {/* ── LEGACY SIGNAL COMPATIBILITY ── */}
                                <Route path="/:orgId/:tournamentId" element={<TournamentDashboard />} />
                                <Route path="/:orgId/:tournamentId/veto/:matchId" element={<VetoRoom />} />

                                {/* ── 404: SIGNAL LOST ── */}
                                {/* Master Admin Panel (Platform Admin Only) */}
                                <Route path="/admin"        element={<PlatformAdminRoute><GlobalAdmin /></PlatformAdminRoute>} />
                                
                                <Route path="*"             element={<NotFound />} />
                            </Routes>
                        </ErrorBoundary>
                        <Footer />
                    </BrandingProvider>
                </div>
            </div>
        </React.Suspense>
    );
}
