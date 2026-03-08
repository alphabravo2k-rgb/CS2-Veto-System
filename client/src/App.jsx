/**
 * ⚡ APP ROUTING — UPDATED WITH AUTH SYSTEM
 * =============================================================================
 * Added: /login, /register, /orgs/create, /org/:orgId, /profile, /profile/edit
 * Auth guard: ProtectedRoute redirects unauthenticated users to /login.
 * Spectator veto routes remain public (no auth required).
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

// Lazy placeholder for existing pages not yet extracted
const GlobalAdmin = React.lazy(() =>
    import('./pages/GlobalAdmin').catch(() => ({
        default: () => (
            <div style={{ minHeight:'100vh', background:'#0b0f19', color:'#ff4444', display:'flex', justifyContent:'center', alignItems:'center', fontFamily:'monospace', textAlign:'center' }}>
                <h1>[ GLOBAL ADMIN PANEL ]<br/><span style={{fontSize:'1rem', color:'#aaa'}}>System Management Loading...</span></h1>
            </div>
        )
    }))
);
const VetoRoom = React.lazy(() =>
    import('./pages/VetoRoom').catch(() => ({
        default: () => (
            <div style={{ minHeight:'100vh', background:'#0b0f19', color:'#00ff00', display:'flex', justifyContent:'center', alignItems:'center', fontFamily:'monospace', textAlign:'center' }}>
                <h1>[ LIVE VETO ROOM ]<br/><span style={{fontSize:'1rem', color:'#aaa'}}>Initializing WebSockets...</span></h1>
            </div>
        )
    }))
);

/**
 * Redirect to /login if not authenticated.
 * Preserves the intended destination via `state.from` for post-login redirect.
 */
function ProtectedRoute({ children }) {
    const { isAuthenticated, isLoading } = useAuthStore();
    const location = useLocation();

    if (isLoading) {
        return (
            <div style={{ minHeight:'100vh', background:'#050a14', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <div style={{ width:32, height:32, border:'3px solid rgba(0,212,255,0.2)', borderTopColor:'#00d4ff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
                <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
}

export default function App() {
    const { initialize } = useAuthStore();

    useEffect(() => {
        initialize();
    }, []);

    return (
        <React.Suspense fallback={<div style={{ minHeight:'100vh', background:'#050a14' }} />}>
            <Routes>
                {/* ── Public routes ── */}
                <Route path="/"          element={<GlobalHome />} />
                <Route path="/login"     element={<Login />} />
                <Route path="/register"  element={<Register />} />
                <Route path="/history"   element={<GlobalHome view="history" />} />

                {/* ── Player profiles (public) ── */}
                <Route path="/players/:userId" element={<PlayerProfile />} />

                {/* ── Protected routes ── */}
                <Route path="/orgs/create" element={<ProtectedRoute><OrgCreate /></ProtectedRoute>} />
                <Route path="/org/:orgId"  element={<ProtectedRoute><OrgDashboard /></ProtectedRoute>} />
                <Route path="/profile"     element={<ProtectedRoute><ProfileEdit /></ProtectedRoute>} />
                <Route path="/profile/edit" element={<ProtectedRoute><ProfileEdit /></ProtectedRoute>} />

                {/* ── Admin (protected) ── */}
                <Route path="/admin" element={<ProtectedRoute><GlobalAdmin /></ProtectedRoute>} />

                {/* ── Legacy multi-tenant tournament routes (kept for backward compat) ── */}
                <Route path="/:orgId/:tournamentId" element={<TournamentDashboard />} />

                {/* ── Veto room (PUBLIC — spectators need no auth) ── */}
                <Route path="/:orgId/:tournamentId/veto/:matchId" element={
                    <React.Suspense fallback={null}><VetoRoom /></React.Suspense>
                } />

                {/* ── 404 ── */}
                <Route path="*" element={<NotFound />} />
            </Routes>
        </React.Suspense>
    );
}
