import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import { 
    AnimatedBackground, 
    RefreshIcon, 
    TrashIcon, 
    CheckIcon, 
    ShieldIcon, 
    UsersIcon, 
    GlobeIcon, 
    ActivityIcon 
} from '../components/SharedUI';

/**
 * ⚡ UI LAYER — GLOBAL ADMIN DASHBOARD
 * =============================================================================
 * Responsibility: Platform-wide observability and control.
 * Features: Multi-tab telemetry, user management, and audit trailing.
 * =============================================================================
 */
export default function GlobalAdmin() {
    const navigate = useNavigate();
    const { user, authFetch } = useAuthStore();
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState({
        users: [],
        orgs: [],
        history: [],
        audit: [],
        stats: { totalMatches: 0, totalUsers: 0, totalOrgs: 0 }
    });

    const isPlatformAdmin = user?.role === 'platform_admin';

    useEffect(() => {
        if (!isPlatformAdmin) {
            navigate('/');
            return;
        }
        loadAllData();
    }, [isPlatformAdmin]);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const [usersRes, orgsRes, histRes, auditRes] = await Promise.all([
                authFetch('/api/admin/users'),
                authFetch('/api/admin/orgs'),
                authFetch('/api/admin/history'),
                authFetch('/api/admin/audit')
            ]);

            const [usersData, orgsData, histData, auditData] = await Promise.all([
                usersRes.json(),
                orgsRes.json(),
                histRes.json(),
                auditRes.json()
            ]);

            setData({
                users: usersData.users || [],
                orgs: orgsData || [],
                history: histData.matches || [],
                audit: auditData || [],
                stats: {
                    totalUsers: usersData.total || 0,
                    totalOrgs: orgsData.length || 0,
                    totalMatches: histData.total || 0
                }
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleUserSuspension = async (userId, isSuspended) => {
        try {
            const res = await authFetch(`/api/admin/users/${userId}/suspend`, {
                method: 'POST',
                body: JSON.stringify({ suspended: !isSuspended })
            });
            if (res.ok) {
                setData(prev => ({
                    ...prev,
                    users: prev.users.map(u => u.id === userId ? { ...u, suspended: !isSuspended } : u)
                }));
            }
        } catch (err) {
            alert('Security protocol failed: Could not update user status.');
        }
    };

    if (!isPlatformAdmin) return null;

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <AnimatedBackground />
            
            <div style={{ padding: '2.5rem', flex: 1, position: 'relative', zIndex: 10, maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
                {/* 🛡️ HEADER */}
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <ShieldIcon size={48} color="var(--brand-primary)" />
                        <div>
                            <h1 className="neon-text" style={{ margin: 0, fontSize: '2.5rem', fontWeight: 900, letterSpacing: '3px' }}>ADMIN DASHBOARD</h1>
                            <div style={{ fontSize: '0.8rem', opacity: 0.5, letterSpacing: '5px', fontWeight: 900, color: 'var(--brand-primary)' }}>PLATFORM ADMINISTRATION</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={loadAllData} className="glass-panel" style={{ padding: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <RefreshIcon />
                        </button>
                        <button onClick={() => navigate('/')} className="premium-button">EXIT ADMIN</button>
                    </div>
                </header>

                {/* 📊 ANALYTICS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
                    <StatCard label="Total Users" value={data.stats.totalUsers} icon={<UsersIcon />} color="#00d4ff" />
                    <StatCard label="Active Organizations" value={data.stats.totalOrgs} icon={<GlobeIcon />} color="#ff4b2b" />
                    <StatCard label="Total Matches" value={data.stats.totalMatches} icon={<ActivityIcon />} color="#00ff88" />
                    <StatCard label="System Status" value="ONLINE" icon={<ShieldIcon />} color="#ffbb00" />
                </div>

                {/* 🎛️ MAIN INTERFACE */}
                <div className="glass-panel" style={{ minHeight: '600px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        {['overview', 'users', 'orgs', 'history', 'audit'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                style={{
                                    flex: 1, padding: '1.5rem', background: activeTab === tab ? 'rgba(0, 212, 255, 0.05)' : 'transparent',
                                    border: 'none', borderBottom: activeTab === tab ? '3px solid var(--brand-primary)' : 'none',
                                    color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: 900, cursor: 'pointer',
                                    textTransform: 'uppercase', letterSpacing: '2px', transition: 'all 0.3s'
                                }}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div style={{ padding: '2rem', flex: 1, overflowY: 'auto' }}>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '5rem' }}>
                                <div style={{ width: '40px', height: '40px', border: '3px solid var(--brand-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1.5rem' }} />
                                <p style={{ opacity: 0.5, letterSpacing: '2px' }}>LOADING DATA...</p>
                            </div>
                        ) : (
                            <>
                                {activeTab === 'overview' && <OverviewView data={data} />}
                                {activeTab === 'users' && <UserTable users={data.users} onToggle={toggleUserSuspension} />}
                                {activeTab === 'orgs' && <OrgTable orgs={data.orgs} />}
                                {activeTab === 'history' && <MatchTable matches={data.history} />}
                                {activeTab === 'audit' && <AuditTable logs={data.audit} />}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

const StatCard = ({ label, value, icon, color }) => (
    <div className="glass-panel" style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', background: `${color}15`, borderRadius: '20px', color: color }}>
            {React.cloneElement(icon, { size: 32 })}
        </div>
        <div>
            <div style={{ fontSize: '0.8rem', opacity: 0.5, fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff' }}>{value}</div>
        </div>
        <div style={{ position: 'absolute', bottom: '-20px', right: '-20px', fontSize: '6rem', opacity: 0.02, pointerEvents: 'none' }}>{icon}</div>
    </div>
);

const OverviewView = ({ data }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="glass-panel" style={{ padding: '2rem', background: 'rgba(255,255,255,0.01)' }}>
            <h3 className="neon-text" style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>RECENT AUDIT LOGS</h3>
            {data.audit.slice(0, 5).map((log, i) => (
                <div key={i} style={{ padding: '1rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--brand-primary)', fontWeight: 800 }}>[{new Date(log.created_at).toLocaleTimeString()}]</span> {log.action}
                </div>
            ))}
        </div>
        <div className="glass-panel" style={{ padding: '2rem', background: 'rgba(255,255,255,0.01)' }}>
            <h3 className="neon-text" style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>LATEST ORGANIZATIONS</h3>
            {data.orgs.slice(0, 5).map((org, i) => (
                <div key={i} style={{ padding: '1rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 800 }}>{org.name}</span>
                    <span style={{ opacity: 0.4, fontSize: '0.8rem' }}>/{org.slug}</span>
                </div>
            ))}
        </div>
    </div>
);

const UserTable = ({ users, onToggle }) => (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
            <tr style={{ textAlign: 'left', color: 'var(--brand-primary)', fontSize: '0.75rem', letterSpacing: '2px', textTransform: 'uppercase' }}>
                <th style={{ padding: '1rem' }}>User</th>
                <th style={{ padding: '1rem' }}>Role</th>
                <th style={{ padding: '1rem' }}>Status</th>
                <th style={{ padding: '1rem' }}>Actions</th>
            </tr>
        </thead>
        <tbody>
            {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1.5rem 1rem' }}>
                        <div style={{ fontWeight: 800 }}>{u.display_name || u.username}</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.4 }}>{u.id}</div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                        <span style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', fontSize: '0.7rem' }}>{u.role}</span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                        <span style={{ color: u.suspended ? '#ff4b2b' : '#00ff88', fontWeight: 900, fontSize: '0.75rem' }}>{u.suspended ? 'SUSPENDED' : 'ACTIVE'}</span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                        <button className="premium-button" style={{ padding: '6px 12px', fontSize: '0.7rem', background: u.suspended ? 'var(--brand-primary)' : '#ff4b2b' }} onClick={() => onToggle(u.id, u.suspended)}>
                            {u.suspended ? 'RESTORE' : 'SUSPEND'}
                        </button>
                    </td>
                </tr>
            ))}
        </tbody>
    </table>
);

const OrgTable = ({ orgs }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {orgs.map(o => (
            <div key={o.id} className="glass-panel" style={{ padding: '2rem', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ fontWeight: 900, fontSize: '1.2rem', marginBottom: '0.5rem' }}>{o.name}</div>
                <div style={{ color: 'var(--brand-primary)', fontSize: '0.8rem', fontWeight: 900, marginBottom: '1.5rem' }}>/{o.slug}</div>
                <button className="premium-button" style={{ width: '100%', justifyContent: 'center' }}>MANAGE ORGANIZATION</button>
            </div>
        ))}
    </div>
);

const MatchTable = ({ matches }) => (
    <div style={{ textAlign: 'center', padding: '4rem', opacity: 0.3 }}>
        <ActivityIcon size={64} color="var(--brand-primary)" />
        <p style={{ marginTop: '1.5rem', letterSpacing: '3px', fontWeight: 900 }}>NO ACTIVE MATCHES</p>
    </div>
);

const AuditTable = ({ logs }) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
        {logs.map((log, i) => (
            <div key={i} style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '1.5rem', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--brand-primary)', fontWeight: 900, minWidth: '100px' }}>[{new Date(log.created_at).toLocaleTimeString()}]</span>
                <span style={{ fontWeight: 600, width: '150px' }}>{log.action}</span>
                <span style={{ opacity: 0.4 }}>Actor: {log.actor_id?.slice(0, 8)}</span>
                <span style={{ marginLeft: 'auto', opacity: 0.2, fontSize: '0.7rem' }}>{log.id}</span>
            </div>
        ))}
    </div>
);
