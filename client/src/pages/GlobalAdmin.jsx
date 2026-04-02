/**
 * ⚡ PAGE — GLOBAL PLATFORM ADMINISTRATION
 * =============================================================================
 * Responsibility: Master-level control over users, orgs, and platform revenue.
 * Restricted: platform_admin only.
 * =============================================================================
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../store/useAuthStore';
import { GlassPanel, NeonText, GlowButton } from '../components/veto/VetoUIPrimitives';

const GlobalAdmin = () => {
    const { authFetch } = useAuthStore();
    const [activeTab, setActiveTab] = useState('overview');
    const [data, setData] = useState({ users: [], orgs: [], payments: [], stats: {} });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAdminData();
    }, []);

    const fetchAdminData = async () => {
        setLoading(true);
        try {
            const [users, orgs, payments] = await Promise.all([
                authFetch('/api/admin/users'),
                authFetch('/api/admin/orgs'),
                authFetch('/api/payments/all')
            ]);
            
            const totalRev = payments.reduce((acc, p) => p.status === 'confirmed' ? acc + parseFloat(p.amount_usd) : acc, 0);
            
            setData({ 
                users, 
                orgs, 
                payments,
                stats: {
                    totalRevenue: totalRev.toFixed(2),
                    activeOrgs: orgs.length,
                    totalUsers: users.length,
                    pendingPayments: payments.filter(p => p.status === 'pending').length
                }
            });
        } catch (err) {
            console.error('[Admin] Fetch failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (endpoint, method = 'POST', body = null) => {
        try {
            await authFetch(endpoint, { method, body: body ? JSON.stringify(body) : null });
            fetchAdminData(); // Refresh
        } catch (err) {
            alert(`Action failed: ${err.message}`);
        }
    };

    if (loading) return <div style={{ minHeight: '100vh', background: '#050a14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><NeonText>LOGGING INTO TERMINAL...</NeonText></div>;

    return (
        <div style={{ minHeight: '100vh', background: '#050a14', color: '#fff', padding: '100px 40px', fontFamily: 'Rajdhani, sans-serif' }}>
            {/* Header */}
            <header style={{ marginBottom: '60px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h4 style={{ color: 'var(--brand-primary)', letterSpacing: '4px', margin: '0 0 8px 0' }}>SYSTEM COMMAND</h4>
                    <h1 style={{ fontSize: '48px', fontWeight: 900, margin: 0, textTransform: 'uppercase', letterSpacing: '2px' }}>Platform Master Admin</h1>
                </div>
                <div style={{ display: 'flex', gap: '40px' }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ opacity: 0.4, fontSize: '12px', letterSpacing: '2px' }}>TOTAL REVENUE</div>
                        <div style={{ fontSize: '28px', fontWeight: 900, color: '#00ff88' }}>${data.stats.totalRevenue} <span style={{ fontSize: '14px', opacity: 0.5 }}>USDT</span></div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ opacity: 0.4, fontSize: '12px', letterSpacing: '2px' }}>ACTIVE ORGS</div>
                        <div style={{ fontSize: '28px', fontWeight: 900 }}>{data.stats.activeOrgs}</div>
                    </div>
                </div>
            </header>

            {/* Tabs Navigation */}
            <div style={{ display: 'flex', gap: '2px', marginBottom: '40px' }}>
                {['overview', 'users', 'orgs', 'payments'].map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: '16px 40px',
                            background: activeTab === tab ? 'rgba(0, 212, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                            border: 'none',
                            borderBottom: activeTab === tab ? '3px solid var(--brand-primary)' : '3px solid transparent',
                            color: activeTab === tab ? '#fff' : 'rgba(255, 255, 255, 0.4)',
                            fontFamily: 'Rajdhani',
                            fontWeight: 800,
                            letterSpacing: '2px',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                >
                    {activeTab === 'overview' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
                            <GlassPanel style={{ padding: '40px' }}>
                                <h3 style={{ margin: '0 0 24px 0', letterSpacing: '2px' }}>Pending Invoices</h3>
                                <div style={{ fontSize: '64px', fontWeight: 900, color: '#ffd700' }}>{data.stats.pendingPayments}</div>
                                <p style={{ opacity: 0.5 }}>Payments currently awaiting network confirmation.</p>
                            </GlassPanel>
                            <GlassPanel style={{ padding: '40px' }}>
                                <h3 style={{ margin: '0 0 24px 0', letterSpacing: '2px' }}>User Base</h3>
                                <div style={{ fontSize: '64px', fontWeight: 900 }}>{data.stats.totalUsers}</div>
                                <p style={{ opacity: 0.5 }}>Total verified accounts across all regions.</p>
                            </GlassPanel>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <GlassPanel style={{ overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead style={{ background: 'rgba(255, 255, 255, 0.05)', fontSize: '12px', letterSpacing: '2px', color: 'rgba(255, 255, 255, 0.4)' }}>
                                    <tr>
                                        <th style={{ padding: '20px' }}>USER</th>
                                        <th style={{ padding: '20px' }}>EMAIL</th>
                                        <th style={{ padding: '20px' }}>ROLE</th>
                                        <th style={{ padding: '20px' }}>STATUS</th>
                                        <th style={{ padding: '20px', textAlign: 'right' }}>ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.users.map(u => (
                                        <tr key={u.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                            <td style={{ padding: '16px 20px', fontWeight: 700 }}>{u.username}</td>
                                            <td style={{ padding: '16px 20px', opacity: 0.6 }}>{u.email}</td>
                                            <td style={{ padding: '16px 20px' }}><span style={{ padding: '4px 10px', borderRadius: '4px', background: u.role === 'platform_admin' ? '#ff4b2b' : 'rgba(255, 255, 255, 0.1)', fontSize: '11px', fontWeight: 900 }}>{u.role.toUpperCase()}</span></td>
                                            <td style={{ padding: '16px 20px' }}><span style={{ color: u.suspended ? '#ff4b2b' : '#00ff88' }}>{u.suspended ? 'SUSPENDED' : 'ACTIVE'}</span></td>
                                            <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                                <GlowButton color={u.suspended ? '#00ff88' : '#ff4b2b'} style={{ padding: '8px 16px', fontSize: '11px', display: 'inline-flex' }} onClick={() => handleAction(`/api/admin/users/${u.id}/${u.suspended ? 'reactivate' : 'suspend'}`)}>
                                                    {u.suspended ? 'REACTIVATE' : 'SUSPEND'}
                                                </GlowButton>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </GlassPanel>
                    )}

                    {activeTab === 'orgs' && (
                        <GlassPanel style={{ overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead style={{ background: 'rgba(255, 255, 255, 0.05)', fontSize: '12px', letterSpacing: '2px', color: 'rgba(255, 255, 255, 0.4)' }}>
                                    <tr>
                                        <th style={{ padding: '20px' }}>ORGANIZATION</th>
                                        <th style={{ padding: '20px' }}>SLUG</th>
                                        <th style={{ padding: '20px' }}>PLAN</th>
                                        <th style={{ padding: '20px' }}>CREATED</th>
                                        <th style={{ padding: '20px', textAlign: 'right' }}>ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.orgs.map(o => (
                                        <tr key={o.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                            <td style={{ padding: '16px 20px', fontWeight: 700 }}>{o.name}</td>
                                            <td style={{ padding: '16px 20px', opacity: 0.6 }}>{o.slug}</td>
                                            <td style={{ padding: '16px 20px' }}><span style={{ color: 'var(--brand-primary)' }}>{o.branding?.plan?.toUpperCase() || 'TRIAL'}</span></td>
                                            <td style={{ padding: '16px 20px', opacity: 0.6 }}>{new Date(o.created_at).toLocaleDateString()}</td>
                                            <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                                <GlowButton color="#ff4b2b" style={{ padding: '8px 16px', fontSize: '11px', display: 'inline-flex' }} onClick={() => handleAction(`/api/admin/orgs/${o.id}`, 'DELETE')}>DELETE</GlowButton>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </GlassPanel>
                    )}

                    {activeTab === 'payments' && (
                        <GlassPanel style={{ overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead style={{ background: 'rgba(255, 255, 255, 0.05)', fontSize: '12px', letterSpacing: '2px', color: 'rgba(255, 255, 255, 0.4)' }}>
                                    <tr>
                                        <th style={{ padding: '20px' }}>TX ID</th>
                                        <th style={{ padding: '20px' }}>ORG</th>
                                        <th style={{ padding: '20px' }}>AMOUNT</th>
                                        <th style={{ padding: '20px' }}>STATUS</th>
                                        <th style={{ padding: '20px', textAlign: 'right' }}>ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.payments.map(p => (
                                        <tr key={p.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                            <td style={{ padding: '16px 20px', fontSize: '11px', opacity: 0.5 }}>{p.id}</td>
                                            <td style={{ padding: '16px 20px', fontWeight: 700 }}>{p.orgs?.name || p.org_id}</td>
                                            <td style={{ padding: '16px 20px', color: '#00ff88' }}>${p.amount_usd}</td>
                                            <td style={{ padding: '16px 20px' }}><span style={{ color: p.status === 'confirmed' ? '#00ff88' : p.status === 'pending' ? '#ffd700' : '#ff4b2b' }}>{p.status.toUpperCase()}</span></td>
                                            <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                                {p.status === 'pending' && (
                                                    <GlowButton color="#00ff88" style={{ padding: '8px 16px', fontSize: '11px', display: 'inline-flex' }} onClick={() => handleAction(`/api/payments/${p.id}/approve`)}>APPROVE</GlowButton>
                                                )}
                                                {p.status === 'confirmed' && (
                                                    <GlowButton color="#ff4b2b" style={{ padding: '8px 16px', fontSize: '11px', display: 'inline-flex' }} onClick={() => handleAction(`/api/payments/${p.id}/refund`, 'POST', { reason: 'Admin Manual Refund' })}>REFUND</GlowButton>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </GlassPanel>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default GlobalAdmin;
