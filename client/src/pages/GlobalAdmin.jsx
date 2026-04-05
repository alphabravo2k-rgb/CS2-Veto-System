/**
 * ⚡ PAGE — GLOBAL PLATFORM ADMINISTRATION
 * =============================================================================
 * Responsibility: Master-level control over users, orgs, and platform revenue.
 * Restricted: platform_admin only.
 * =============================================================================
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import useAuthStore from '../store/useAuthStore';
import { GlassPanel, NeonText, GlowButton } from '../components/veto/VetoUIPrimitives';

const GlobalAdmin = () => {
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState('overview');
    const [data, setData] = useState({ users: [], orgs: [], payments: [], logs: [], stats: {} });
    const [settings, setSettings] = useState({ discordWebhookUrl: '', platformName: 'VETO.GG', showWatermark: true });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (user && user.user_metadata?.role === 'platform_admin') {
            fetchAdminData();
        } else {
            setError('UNAUTHORIZED: PLATFORM_ADMIN CLEARANCE REQUIRED');
            setLoading(false);
        }
    }, [user]);

    const fetchAdminData = async () => {
        setLoading(true);
        try {
            // Fetch everything concurrently via supabase
            const [usersRes, orgsRes, orgBrandingRes, sessionsRes, paymentsRes] = await Promise.all([
                supabase.from('users').select('*').order('created_at', { ascending: false }).limit(20),
                supabase.from('orgs').select('*'),
                supabase.from('org_branding').select('*'),
                supabase.from('veto_sessions').select('id, finished'),
                supabase.from('payments').select('*, orgs(name)').order('created_at', { ascending: false })
            ]);

            const orgs = orgsRes.data || [];
            const orgBranding = orgBrandingRes.data || [];
            const combinedOrgs = orgs.map(org => ({
                ...org,
                branding: orgBranding.find(b => b.org_id === org.id)
            }));

            const payments = paymentsRes.data || [];
            const totalRev = payments.reduce((acc, p) => p.status === 'confirmed' ? acc + parseFloat(p.amount_usd) : acc, 0);

            let logsData = [];
            if (activeTab === 'logs') {
                // Fetch audit logs just in time, or fetch small batch now
                const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50);
                logsData = data || [];
            }

            setData({ 
                users: usersRes.data || [], 
                orgs: combinedOrgs, 
                payments,
                logs: logsData,
                stats: {
                    totalRevenue: totalRev.toFixed(2),
                    activeOrgs: orgs.length,
                    totalUsers: usersRes.count || usersRes.data?.length || 0,
                    totalSessions: sessionsRes.data?.length || 0,
                    activeSessions: sessionsRes.data?.filter(s => !s.finished).length || 0,
                    confirmedPayments: payments.filter(p => p.status === 'confirmed').length
                }
            });
            setError(null);
        } catch (err) {
            console.error('[Admin] Fetch failed:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Refetch logs specifically if switching to logs tab
    useEffect(() => {
        if (activeTab === 'logs' && data.logs.length === 0) {
            supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50)
                .then(res => setData(prev => ({ ...prev, logs: res.data || [] })));
        }
    }, [activeTab]);

    const handleSuspendUser = async (userId, currentStatus) => {
        const { error } = await supabase.from('users').update({ suspended: !currentStatus }).eq('id', userId);
        if (!error) fetchAdminData();
    };

    const handleSetPlatformAdmin = async (userId) => {
        const { error } = await supabase.rpc('set_custom_claim', { user_id: userId, claim: 'role', value: 'platform_admin' });
        if (!error) {
            await supabase.from('users').update({ role: 'platform_admin' }).eq('id', userId);
            fetchAdminData();
        }
    };

    const handleSuspendOrg = async (orgId, currentStatus) => {
        const { error } = await supabase.from('org_branding').update({ suspended: !currentStatus }).eq('org_id', orgId);
        if (!error) fetchAdminData();
    };

    const handleApprovePayment = async (paymentId) => {
        const { error } = await supabase.from('payments').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', paymentId);
        if (!error) fetchAdminData();
    };

    const handleRefundPayment = async (paymentId) => {
        const { error } = await supabase.from('payments').update({ status: 'refunded' }).eq('id', paymentId);
        if (!error) fetchAdminData();
    };

    const saveSettings = async () => {
        alert('Settings saved (Mock implementation for now)');
    };

    if (error) return <div style={{ minHeight: '100vh', background: '#050a14', color: '#ff4b2b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><NeonText>{error}</NeonText></div>;
    if (loading && !data.users.length) return <div style={{ minHeight: '100vh', background: '#050a14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><NeonText>LOADING SYSTEM ARCHIVES...</NeonText></div>;

    const tabs = ['overview', 'orgs', 'users', 'payments', 'logs', 'settings'];

    return (
        <div style={{ minHeight: '100vh', background: '#050a14', color: '#fff', padding: '100px 40px', fontFamily: 'Rajdhani, sans-serif' }}>
            <header style={{ marginBottom: '40px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '20px' }}>
                <h4 style={{ color: 'var(--brand-primary, #00d4ff)', letterSpacing: '4px', margin: '0 0 8px 0' }}>VETO.GG CENTRAL COMMAND</h4>
                <h1 style={{ fontSize: '48px', fontWeight: 900, margin: 0, textTransform: 'uppercase', letterSpacing: '2px' }}>Platform Master Admin</h1>
            </header>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '40px' }}>
                {tabs.map(tab => (
                    <button 
                        key={tab} onClick={() => setActiveTab(tab)}
                        style={{
                            padding: '12px 32px', borderRadius: '50px', border: 'none',
                            background: activeTab === tab ? 'var(--brand-primary, #00d4ff)' : 'transparent',
                            color: activeTab === tab ? '#000' : 'rgba(255,255,255,0.5)',
                            fontFamily: 'Rajdhani', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px',
                            cursor: 'pointer', transition: 'all 0.2s',
                            boxShadow: activeTab === tab ? '0 0 15px rgba(0,212,255,0.3)' : 'none'
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    
                    {/* TAB 1: OVERVIEW */}
                    {activeTab === 'overview' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
                            {[
                                { val: data.stats.activeOrgs, lbl: 'TOTAL LOGGED ORGS' },
                                { val: data.stats.totalUsers, lbl: 'UNIQUE USERS' },
                                { val: data.stats.totalSessions, lbl: 'LIFETIME SESSIONS' },
                                { val: data.stats.activeSessions, lbl: 'ACTIVE MATCHES' },
                                { val: data.stats.confirmedPayments, lbl: 'CONFIRMED PAYMENTS' },
                                { val: `$${data.stats.totalRevenue}`, lbl: 'GROSS REVENUE (USDT)', color: '#00ff88' },
                            ].map((stat, i) => (
                                <GlassPanel key={i} style={{ padding: '32px', textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
                                    <div style={{ fontSize: '48px', fontWeight: 900, color: stat.color || '#fff', marginBottom: '8px' }}>{stat.val}</div>
                                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', opacity: 0.5 }}>{stat.lbl}</div>
                                </GlassPanel>
                            ))}
                        </div>
                    )}

                    {/* TAB 2: ORGANIZATIONS */}
                    {activeTab === 'orgs' && (
                        <GlassPanel style={{ overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead style={{ background: 'rgba(255,255,255,0.05)', fontSize: '12px', letterSpacing: '2px', color: 'rgba(255,255,255,0.4)' }}>
                                    <tr><th style={{ padding: '20px' }}>ORG NAME</th><th style={{ padding: '20px' }}>PLAN</th><th style={{ padding: '20px' }}>TRIAL STATUS</th><th style={{ padding: '20px' }}>CREATED AT</th><th style={{ padding: '20px', textAlign: 'right' }}>ACTIONS</th></tr>
                                </thead>
                                <tbody>
                                    {data.orgs.map(o => (
                                        <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: o.branding?.suspended ? 0.5 : 1 }}>
                                            <td style={{ padding: '16px 20px', fontWeight: 700 }}>{o.name}</td>
                                            <td style={{ padding: '16px 20px', color: 'var(--brand-primary, #00d4ff)', textTransform: 'uppercase' }}>{o.branding?.plan || 'TRIAL'}</td>
                                            <td style={{ padding: '16px 20px' }}>{o.branding?.trial_count || 0} / {o.branding?.trial_limit || 3}</td>
                                            <td style={{ padding: '16px 20px', opacity: 0.5 }}>{new Date(o.created_at).toLocaleDateString()}</td>
                                            <td style={{ padding: '16px 20px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <GlowButton style={{ padding: '6px 12px', fontSize: '10px' }} onClick={() => window.open(`/org/${o.id}`, '_blank')}>VIEW</GlowButton>
                                                <GlowButton color="#ff4b2b" style={{ padding: '6px 12px', fontSize: '10px' }} onClick={() => handleSuspendOrg(o.id, o.branding?.suspended)}>
                                                    {o.branding?.suspended ? 'UNSUSPEND' : 'SUSPEND'}
                                                </GlowButton>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </GlassPanel>
                    )}

                    {/* TAB 3: USERS */}
                    {activeTab === 'users' && (
                        <GlassPanel style={{ overflow: 'hidden' }}>
                            <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <input type="text" placeholder="Search by username or email..." style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 20px', borderRadius: '8px', color: '#fff', outline: 'none', width: '300px', fontFamily: 'Rajdhani' }} />
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead style={{ background: 'rgba(255,255,255,0.05)', fontSize: '12px', letterSpacing: '2px', color: 'rgba(255,255,255,0.4)' }}>
                                    <tr><th style={{ padding: '20px' }}>USERNAME</th><th style={{ padding: '20px' }}>EMAIL</th><th style={{ padding: '20px' }}>ROLE</th><th style={{ padding: '20px' }}>STATUS</th><th style={{ padding: '20px', textAlign: 'right' }}>ACTIONS</th></tr>
                                </thead>
                                <tbody>
                                    {data.users.map(u => (
                                        <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '16px 20px', fontWeight: 700 }}>{u.username}</td>
                                            <td style={{ padding: '16px 20px', opacity: 0.6 }}>{u.email}</td>
                                            <td style={{ padding: '16px 20px' }}>{u.role === 'platform_admin' ? <span style={{ color: '#ff4b2b' }}>PLATFORM ADMIN</span> : 'USER'}</td>
                                            <td style={{ padding: '16px 20px', color: u.suspended ? '#ff4b2b' : '#00ff88' }}>{u.suspended ? 'SUSPENDED' : 'ACTIVE'}</td>
                                            <td style={{ padding: '16px 20px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                {u.role !== 'platform_admin' && (
                                                    <GlowButton color="#ffd700" style={{ padding: '6px 12px', fontSize: '10px' }} onClick={() => handleSetPlatformAdmin(u.id)}>SET ADMIN</GlowButton>
                                                )}
                                                <GlowButton color={u.suspended ? '#00ff88' : '#ff4b2b'} style={{ padding: '6px 12px', fontSize: '10px' }} onClick={() => handleSuspendUser(u.id, u.suspended)}>
                                                    {u.suspended ? 'UNSUSPEND' : 'SUSPEND'}
                                                </GlowButton>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </GlassPanel>
                    )}

                    {/* TAB 4: PAYMENTS */}
                    {activeTab === 'payments' && (
                        <GlassPanel style={{ overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead style={{ background: 'rgba(255,255,255,0.05)', fontSize: '12px', letterSpacing: '2px', color: 'rgba(255,255,255,0.4)' }}>
                                    <tr><th style={{ padding: '20px' }}>ORG</th><th style={{ padding: '20px' }}>PLAN</th><th style={{ padding: '20px' }}>USD</th><th style={{ padding: '20px' }}>CRYPTO</th><th style={{ padding: '20px' }}>STATUS</th><th style={{ padding: '20px', textAlign: 'right' }}>ACTIONS</th></tr>
                                </thead>
                                <tbody>
                                    {data.payments.map(p => (
                                        <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '16px 20px', fontWeight: 700 }}>{p.orgs?.name || 'Unknown'}</td>
                                            <td style={{ padding: '16px 20px', opacity: 0.6 }}>{p.plan}</td>
                                            <td style={{ padding: '16px 20px' }}>${p.amount_usd}</td>
                                            <td style={{ padding: '16px 20px', opacity: 0.6 }}>{p.amount_crypto} USDT</td>
                                            <td style={{ padding: '16px 20px' }}>
                                                <span style={{ 
                                                    padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 900,
                                                    background: p.status === 'confirmed' ? 'rgba(0,255,136,0.2)' : p.status === 'pending' ? 'rgba(255,215,0,0.2)' : 'rgba(255,75,43,0.2)',
                                                    color: p.status === 'confirmed' ? '#00ff88' : p.status === 'pending' ? '#ffd700' : '#ff4b2b'
                                                }}>
                                                    {p.status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px 20px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                {p.status === 'pending' && <GlowButton color="#00ff88" style={{ padding: '6px 12px', fontSize: '10px' }} onClick={() => handleApprovePayment(p.id)}>APPROVE</GlowButton>}
                                                {p.status === 'confirmed' && <GlowButton color="#ff4b2b" style={{ padding: '6px 12px', fontSize: '10px' }} onClick={() => handleRefundPayment(p.id)}>REFUND</GlowButton>}
                                                {(p.status === 'refunded' || p.status === 'expired') && <span style={{ opacity: 0.3, fontSize: '10px' }}>NO ACTIONS</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </GlassPanel>
                    )}

                    {/* TAB 5: AUDIT LOGS */}
                    {activeTab === 'logs' && (
                        <GlassPanel style={{ overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead style={{ background: 'rgba(255,255,255,0.05)', fontSize: '12px', letterSpacing: '2px', color: 'rgba(255,255,255,0.4)' }}>
                                    <tr><th style={{ padding: '20px' }}>TIME</th><th style={{ padding: '20px' }}>ACTOR</th><th style={{ padding: '20px' }}>ACTION</th><th style={{ padding: '20px' }}>TARGET</th><th style={{ padding: '20px' }}>META</th></tr>
                                </thead>
                                <tbody>
                                    {data.logs.map((log, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '13px' }}>
                                            <td style={{ padding: '16px 20px', opacity: 0.5 }}>{new Date(log.created_at).toLocaleString()}</td>
                                            <td style={{ padding: '16px 20px', fontWeight: 700 }}>{log.actor_id}</td>
                                            <td style={{ padding: '16px 20px', color: 'var(--brand-primary, #00d4ff)' }}>{log.action}</td>
                                            <td style={{ padding: '16px 20px', opacity: 0.8 }}>{log.target_id}</td>
                                            <td style={{ padding: '16px 20px', opacity: 0.5 }}>{JSON.stringify(log.meta)}</td>
                                        </tr>
                                    ))}
                                    {data.logs.length === 0 && <tr><td colSpan="5" style={{ padding: '40px', textAlign: 'center', opacity: 0.5 }}>No logs found.</td></tr>}
                                </tbody>
                            </table>
                        </GlassPanel>
                    )}

                    {/* TAB 6: SETTINGS */}
                    {activeTab === 'settings' && (
                        <div style={{ display: 'grid', gap: '24px', maxWidth: '600px' }}>
                            <GlassPanel style={{ padding: '32px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', letterSpacing: '2px', color: 'rgba(255,255,255,0.5)' }}>PLATFORM NAME</label>
                                <input type="text" value={settings.platformName} onChange={e => setSettings({...settings, platformName: e.target.value})} style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '8px', color: '#fff', outline: 'none', fontFamily: 'Rajdhani', marginBottom: '24px' }} />

                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', letterSpacing: '2px', color: 'rgba(255,255,255,0.5)' }}>DISCORD WEBHOOK URL</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input type="text" value={settings.discordWebhookUrl} onChange={e => setSettings({...settings, discordWebhookUrl: e.target.value})} style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '8px', color: '#fff', outline: 'none', fontFamily: 'Rajdhani' }} />
                                    <GlowButton color="#5865F2" style={{ padding: '0 24px' }}>TEST</GlowButton>
                                </div>
                                <p style={{ fontSize: '12px', opacity: 0.5, marginTop: '8px', marginBottom: '24px' }}>Used for global platform notifications (e.g., new orgs, high value payments).</p>

                                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={settings.showWatermark} onChange={e => setSettings({...settings, showWatermark: e.target.checked})} style={{ width: '20px', height: '20px' }} />
                                    <span style={{ fontSize: '14px', letterSpacing: '1px' }}>ENFORCE FREE-TIER WATERMARKS</span>
                                </label>

                                <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '32px 0' }} />
                                <GlowButton color="#00ff88" onClick={saveSettings} style={{ width: '100%', justifyContent: 'center', padding: '16px' }}>SAVE PLATFORM CONFIGURATION</GlowButton>
                            </GlassPanel>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default GlobalAdmin;
