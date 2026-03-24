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

const TABS = [
    { id: 'overview', label: 'Overview', icon: ShieldIcon },
    { id: 'users', label: 'Users', icon: UsersIcon },
    { id: 'orgs', label: 'Organizations', icon: GlobeIcon },
    { id: 'history', label: 'Match History', icon: ActivityIcon },
    { id: 'audit', label: 'Audit Log', icon: ShieldIcon },
];

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
            alert('Failed to update user status');
        }
    };

    const deleteMatch = async (matchId) => {
        if (!window.confirm('Permanently delete this match?')) return;
        try {
            const res = await authFetch(`/api/admin/matches/${matchId}`, { method: 'DELETE' });
            if (res.ok) {
                setData(prev => ({
                    ...prev,
                    history: prev.history.filter(m => m.id !== matchId)
                }));
            }
        } catch (err) {
            alert('Failed to delete match');
        }
    };

    if (!isPlatformAdmin) return null;

    return (
        <div style={{ minHeight: '100vh', color: '#fff', fontFamily: "'Outfit', sans-serif" }}>
            <AnimatedBackground />
            
            <header style={{ 
                padding: '2rem', 
                background: 'rgba(10, 15, 30, 0.7)', 
                backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                zIndex: 100
            }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', letterSpacing: '2px', color: '#ff4b2b' }}>PLATFORM CONTROL</h1>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>SYSTEM COMMAND & OBSERVABILITY</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={loadAllData} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', padding: '0.8rem', borderRadius: '12px', cursor: 'pointer' }}>
                        <RefreshIcon />
                    </button>
                    <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 0.5rem' }} />
                    <button onClick={() => navigate('/')} style={{ background: '#ff4b2b', border: 'none', color: '#fff', padding: '0.8rem 1.5rem', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                        EXIT PORTAL
                    </button>
                </div>
            </header>

            <main style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
                {/* Navigation Tabs */}
                <nav style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', overflowX: 'auto', paddingBottom: '1rem' }}>
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.8rem',
                                padding: '1rem 1.5rem',
                                background: activeTab === tab.id ? 'rgba(255, 75, 43, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid',
                                borderColor: activeTab === tab.id ? '#ff4b2b' : 'rgba(255, 255, 255, 0.1)',
                                borderRadius: '16px',
                                color: activeTab === tab.id ? '#ff4b2b' : '#fff',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <tab.icon size={20} />
                            <span style={{ fontWeight: '600' }}>{tab.label}</span>
                        </button>
                    ))}
                </nav>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '10rem' }}>
                        <div style={{ width: '50px', height: '50px', border: '3px solid #ff4b2b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto mb-4' }} />
                        <p style={{ color: 'rgba(255,255,255,0.5)' }}>SYNCHRONIZING SYSTEM DATA...</p>
                    </div>
                ) : (
                    <div className="tab-content">
                        {activeTab === 'overview' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                                <StatCard label="Total Users" value={data.stats.totalUsers} icon={UsersIcon} color="#00d4ff" />
                                <StatCard label="Total Organizations" value={data.stats.totalOrgs} icon={GlobeIcon} color="#00ff88" />
                                <StatCard label="Total Matches" value={data.stats.totalMatches} icon={ActivityIcon} color="#ff4b2b" />
                            </div>
                        )}

                        {activeTab === 'users' && (
                            <Table>
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Role</th>
                                        <th>Registration</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.users.map(u => (
                                        <tr key={u.id}>
                                            <td>
                                                <div style={{ fontWeight: '600' }}>{u.display_name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>{u.email}</div>
                                            </td>
                                            <td><span style={{ padding: '4px 8px', borderRadius: '4px', background: u.role === 'platform_admin' ? '#ff4b2b' : 'rgba(255,255,255,0.1)', fontSize: '0.7rem' }}>{u.role.toUpperCase()}</span></td>
                                            <td>{new Date(u.created_at).toLocaleDateString()}</td>
                                            <td>
                                                <span style={{ color: u.suspended ? '#ff4444' : '#00ff88' }}>
                                                    {u.suspended ? 'SUSPENDED' : 'ACTIVE'}
                                                </span>
                                            </td>
                                            <td>
                                                <button 
                                                    onClick={() => toggleUserSuspension(u.id, u.suspended)}
                                                    style={{ background: 'transparent', border: '1px solid #444', color: '#fff', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}
                                                >
                                                    {u.suspended ? 'Unsuspend' : 'Suspend'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        )}

                        {activeTab === 'history' && (
                            <Table>
                                <thead>
                                    <tr>
                                        <th>Match ID</th>
                                        <th>Lineup</th>
                                        <th>Status</th>
                                        <th>Date</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.history.map(m => (
                                        <tr key={m.id}>
                                            <td style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{m.id.slice(0, 8)}</td>
                                            <td style={{ fontWeight: '600' }}>{m.teamA} vs {m.teamB}</td>
                                            <td><span style={{ color: m.finished ? '#888' : '#00ff88' }}>{m.finished ? 'COMPLETED' : 'LIVE'}</span></td>
                                            <td>{new Date(m.date).toLocaleString()}</td>
                                            <td>
                                                <button onClick={() => deleteMatch(m.id)} style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer' }}>
                                                    <TrashIcon size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        )}

                        {activeTab === 'audit' && (
                            <Table>
                                <thead>
                                    <tr>
                                        <th>Timestamp</th>
                                        <th>Actor</th>
                                        <th>Action</th>
                                        <th>Target</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.audit.map((log, i) => (
                                        <tr key={i}>
                                            <td style={{ fontSize: '0.8rem', opacity: 0.6 }}>{new Date(log.created_at).toLocaleString()}</td>
                                            <td>{log.actor_id.slice(0, 8)}</td>
                                            <td><code style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>{log.action}</code></td>
                                            <td>{log.target_id?.slice(0, 8) || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        )}
                    </div>
                )}
            </main>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                tbody tr:hover { background: rgba(255, 255, 255, 0.02); }
            `}</style>
        </div>
    );
}

function StatCard({ label, value, icon: Icon, color }) {
    return (
        <div style={{ 
            background: 'rgba(255, 255, 255, 0.03)', 
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            padding: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '2rem'
        }}>
            <div style={{ 
                width: '64px', 
                height: '64px', 
                borderRadius: '20px', 
                background: `rgba(${color === '#ff4b2b' ? '255,75,43' : color === '#00ff88' ? '0,255,136' : '0,212,255'}, 0.1)`, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: color
            }}>
                <Icon size={32} />
            </div>
            <div>
                <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{value}</div>
            </div>
        </div>
    );
}

function Table({ children }) {
    return (
        <div style={{ 
            background: 'rgba(255, 255, 255, 0.03)', 
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            overflow: 'hidden'
        }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                {children}
            </table>
            <style>{`
                th { padding: 1.5rem; font-size: 0.8rem; color: rgba(255,255,255,0.4); border-bottom: 1px solid rgba(255,255,255,0.08); text-transform: uppercase; letter-spacing: 1px; }
                td { padding: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
                tr:last-child td { border-bottom: none; }
            `}</style>
        </div>
    );
}
