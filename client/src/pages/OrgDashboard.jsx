import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../store/useAuthStore';
import useOrgBranding from '../hooks/useOrgBranding';
import { AnimatedBackground, ShieldIcon, ActivityIcon, UsersIcon, GlobeIcon, RefreshIcon, CheckIcon } from '../components/SharedUI';
import { supabase } from '../utils/supabase.js';

/**
 * ⚡ UI LAYER — PREMIUM ORGANIZATION DASHBOARD
 * =============================================================================
 * Responsibility: Central hub for organization owners and members.
 * Features: Glassmorphic stats, tournament management, branding control.
 * =============================================================================
 */
export default function OrgDashboard() {
    const { orgId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { branding: globalBranding } = useOrgBranding(orgId);

    const [org,         setOrg]         = useState(null);
    const [tournaments, setTournaments] = useState([]);
    const [members,     setMembers]     = useState([]);
    const [tab,         setTab]         = useState('tournaments');
    const [membersLoading, setMembersLoading] = useState(false);
    const [loading,     setLoading]     = useState(true);
    const [error,       setError]       = useState('');

    // Branding edit state
    const [editBranding, setEditBranding] = useState(false);
    const [brandingForm, setBrandingForm] = useState({ displayName: '', primaryColor: '#00d4ff', secondaryColor: '#0a0f1e', logoUrl: '' });
    const [savingBrand, setSavingBrand] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                // Fetch Org Data
                const { data: orgData, error: orgError } = await supabase
                    .from('orgs')
                    .select('*')
                    .eq('id', orgId)
                    .single();
                
                if (orgError) throw new Error('Organization not found');

                // Fetch Tournaments
                const { data: tData, error: tError } = await supabase
                    .from('tournaments')
                    .select('*')
                    .eq('org_id', orgId)
                    .order('created_at', { ascending: false });

                setOrg(orgData);
                setTournaments(tData || []);
                
                const { data: brandingData } = await supabase
                    .from('org_branding')
                    .select('*')
                    .eq('org_id', orgId)
                    .single();
                
                if (brandingData) {
                    setBrandingForm({
                        displayName: brandingData.display_name || '',
                        primaryColor: brandingData.primary_color || '#00d4ff',
                        secondaryColor: brandingData.secondary_color || '#0a0f1e',
                        logoUrl: brandingData.logo_url || '',
                        bannerUrl: brandingData.banner_url || '',
                    });
                }
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [orgId]);

    const loadMembers = async () => {
        setMembersLoading(true);
        try {
            const { data, error } = await supabase
                .from('org_members')
                .select('*, users(*)')
                .eq('org_id', orgId);
            
            if (data) {
                const normalized = data.map(m => ({
                    ...m.users,
                    role: m.role
                }));
                setMembers(normalized);
            }
        } catch (e) {
            console.error('[OrgDashboard] Load members error:', e);
        } finally {
            setMembersLoading(false);
        }
    };

    useEffect(() => {
        if (tab === 'members') loadMembers();
    }, [tab]);

    const saveBranding = async () => {
        setSavingBrand(true);
        try {
            const { error } = await supabase
                .from('org_branding')
                .update({
                    display_name: brandingForm.displayName,
                    primary_color: brandingForm.primaryColor,
                    secondary_color: brandingForm.secondaryColor,
                    logo_url: brandingForm.logoUrl || null,
                    banner_url: brandingForm.bannerUrl || null,
                })
                .eq('org_id', orgId);

            if (error) throw error;
            
            // Reload branding to confirm save
            window.dispatchEvent(new Event('brandingUpdated'));
            setEditBranding(false);
            window.location.reload(); 
        } catch (e) {
            alert(e.message);
        } finally {
            setSavingBrand(false);
        }
    };

    const createTournament = async () => {
        const name = window.prompt('Tournament name:');
        if (!name) return;
        
        try {
            const { data, error } = await supabase
                .from('tournaments')
                .insert([{
                    id: crypto.randomUUID(),
                    name,
                    org_id: orgId,
                    format: 'bo3',
                    game_module: 'cs2',
                    status: 'active'
                }])
                .select()
                .single();

            if (error) throw error;
            setTournaments(ts => [data, ...ts]);
        } catch (e) {
            alert(e.message || 'Failed to create tournament');
        }
    };

    const accentColor = org?.branding?.primary_color || 'var(--brand-primary, #00d4ff)';

    if (loading) {
        return (
            <div className="org-loading" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050a14' }}>
                <AnimatedBackground />
                <div className="spinner-large" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="org-error" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050a14' }}>
                <AnimatedBackground />
                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
                    <h2 style={{ color: '#ff4b2b' }}>[ERROR]</h2>
                    <p>{error}</p>
                    <Link to="/" className="premium-button" style={{ marginTop: '1rem' }}>RETURN HOME</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="org-page" style={{ minHeight: '100vh', background: '#050a14', color: '#fff' }}>
            <AnimatedBackground />

            {/* ── BANNER ── */}
            <div className="org-banner" style={{ padding: '60px 40px 40px', background: `linear-gradient(180deg, ${accentColor}11, transparent)`, borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'relative', zIndex: 10 }}>
                <div className="org-banner-inner" style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '32px' }}>
                    <div className="org-header-left" style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                        <div className="org-logo-wrapper glass-panel" style={{ width: '120px', height: '120px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', border: `2px solid ${accentColor}44`, boxShadow: `0 0 40px ${accentColor}22` }}>
                            {org.branding?.logo_url ? (
                                <img src={org.branding.logo_url} alt="org logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            ) : (
                                <span style={{ fontSize: '3rem', fontWeight: 900, color: accentColor }}>{(org.name || 'O').charAt(0).toUpperCase()}</span>
                            )}
                        </div>
                        <div>
                            <h1 className="neon-text" style={{ fontSize: '3.5rem', fontWeight: 900, margin: 0, textShadow: `0 0 20px ${accentColor}44` }}>{org.branding?.display_name || org.name}</h1>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', opacity: 0.6 }}>
                                <GlobeIcon size={14} />
                                <span style={{ letterSpacing: '2px', fontWeight: 700 }}>ORGANIZATION: {orgId.toUpperCase()}</span>
                            </div>
                        </div>
                    </div>
                    <div className="org-header-right" style={{ display: 'flex', gap: '16px' }}>
                        <button className="premium-button" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} onClick={() => setEditBranding(true)}>
                            EDIT BRANDING
                        </button>
                        <button onClick={createTournament} className="premium-button">
                            CREATE TOURNAMENT
                        </button>
                    </div>
                </div>
            </div>

            <div className="org-body" style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px' }}>
                {/* ── TABS ── */}
                <div className="tab-nav" style={{ display: 'flex', gap: '32px', marginBottom: '40px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {['tournaments', 'members'].map(t => (
                        <button 
                            key={t} 
                            style={{ 
                                background: 'none', border: 'none', color: tab === t ? accentColor : 'rgba(255,255,255,0.4)', 
                                padding: '16px 0', cursor: 'pointer', fontSize: '14px', fontWeight: 900, letterSpacing: '4px',
                                borderBottom: tab === t ? `2px solid ${accentColor}` : '2px solid transparent',
                                transition: 'all 0.3s'
                            }} 
                            onClick={() => setTab(t)}
                        >
                            {t.toUpperCase()}
                        </button>
                    ))}
                </div>

                {/* ── CONTENT ── */}
                <AnimatePresence mode="wait">
                    <motion.div 
                        key={tab} 
                        initial={{ opacity: 0, y: 20 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.4 }}
                    >
                        {tab === 'tournaments' && (
                            <div className="tab-pane">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                                    <h2 style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '2px' }}>ACTIVE TOURNAMENTS</h2>
                                    <button className="premium-button" style={{ padding: '8px 24px', fontSize: '12px' }} onClick={createTournament}>CREATE TOURNAMENT</button>
                                </div>
                                
                                {tournaments.length === 0 ? (
                                    <div className="glass-panel" style={{ padding: '80px', textAlign: 'center', color: 'rgba(255,255,255,0.2)' }}>
                                        <p style={{ letterSpacing: '4px', fontStyle: 'italic' }}>NO TOURNAMENTS FOUND</p>
                                    </div>
                                ) : (
                                    <div className="tournament-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                                        {tournaments.map(t => (
                                            <motion.div
                                                key={t.id}
                                                className="glass-panel"
                                                whileHover={{ y: -8, scale: 1.02, boxShadow: `0 20px 40px rgba(0,0,0,0.4), 0 0 20px ${accentColor}11` }}
                                                onClick={() => navigate(`/org/${orgId}/tournament/${t.id}`)}
                                                style={{ padding: '24px', cursor: 'pointer', borderTop: `4px solid ${accentColor}` }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                                                    <div className="premium-button" style={{ fontSize: '10px', padding: '4px 12px', background: `${accentColor}22`, border: `1px solid ${accentColor}44`, color: accentColor }}>
                                                        {t.game_module?.toUpperCase() || 'CS2'}
                                                    </div>
                                                    <span style={{ fontSize: '10px', fontWeight: 900, color: t.status === 'completed' ? '#ff4b2b' : '#00ff88', letterSpacing: '2px' }}>
                                                        {t.status?.toUpperCase() || 'ACTIVE'}
                                                    </span>
                                                </div>
                                                <h3 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>{t.name}</h3>
                                                <div style={{ marginTop: '24px', display: 'flex', gap: '16px', opacity: 0.4, fontSize: '12px', fontWeight: 700 }}>
                                                    <span>{t.defaultFormat?.toUpperCase()} FORMAT</span>
                                                    <span>|</span>
                                                    <span>{new Date(t.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {tab === 'members' && (
                            <div className="tab-pane">
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '2px', marginBottom: '32px' }}>MEMBERS</h2>
                                <div className="glass-panel" style={{ overflow: 'hidden' }}>
                                    {membersLoading ? (
                                        <div style={{ padding: '80px', textAlign: 'center', opacity: 0.2, letterSpacing: '4px' }}>LOADING MEMBERS...</div>
                                    ) : members.length === 0 ? (
                                        <div style={{ padding: '80px', textAlign: 'center', opacity: 0.2, letterSpacing: '4px' }}>NO MEMBERS FOUND. INVITE YOUR TEAM.</div>
                                    ) : (
                                        <div className="members-list">
                                            {members.map(m => (
                                                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '20px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.3s' }} className="member-row">
                                                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${accentColor}22`, color: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.2rem', border: `1px solid ${accentColor}44` }}>
                                                        {(m.username || 'U').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{m.display_name || m.username}</div>
                                                        <div style={{ fontSize: '0.8rem', opacity: 0.4, fontWeight: 700 }}>@{m.username} / {m.email || 'N/A'}</div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <ShieldIcon size={14} color={m.role === 'admin' ? accentColor : 'rgba(255,255,255,0.4)'} />
                                                        <span style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '2px', color: m.role === 'admin' ? accentColor : 'rgba(255,255,255,0.4)' }}>{m.role.toUpperCase()}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* ── BRANDING MODAL ── */}
            <AnimatePresence>
                {editBranding && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="modal-overlay" 
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
                        onClick={() => setEditBranding(false)}
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="glass-panel" 
                            style={{ padding: '40px', width: '100%', maxWidth: '500px' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '2px', marginBottom: '32px' }}>EDIT BRANDING</h2>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '1px', opacity: 0.5 }}>DISPLAY NAME</label>
                                    <input 
                                        type="text" 
                                        value={brandingForm.displayName} 
                                        onChange={e => setBrandingForm(b => ({ ...b, displayName: e.target.value }))}
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', color: '#fff', borderRadius: '8px', outline: 'none' }}
                                    />
                                </div>
                                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '1px', opacity: 0.5 }}>PRIMARY BRAND COLOR</label>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <input 
                                            type="color" 
                                            value={brandingForm.primaryColor} 
                                            onChange={e => setBrandingForm(b => ({ ...b, primaryColor: e.target.value }))} 
                                            style={{ width: '48px', height: '42px', border: 'none', background: 'none', cursor: 'pointer' }}
                                        />
                                        <input 
                                            type="text" 
                                            value={brandingForm.primaryColor} 
                                            onChange={e => setBrandingForm(b => ({ ...b, primaryColor: e.target.value }))}
                                            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', color: '#fff', borderRadius: '8px' }}
                                        />
                                    </div>
                                </div>
                                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '1px', opacity: 0.5 }}>LOGO URL</label>
                                    <input 
                                        type="url" 
                                        value={brandingForm.logoUrl} 
                                        onChange={e => setBrandingForm(b => ({ ...b, logoUrl: e.target.value }))}
                                        placeholder="https://..."
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', color: '#fff', borderRadius: '8px' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '40px' }}>
                                <button className="glass-panel" style={{ padding: '12px 24px', cursor: 'pointer' }} onClick={() => setEditBranding(false)}>CANCEL</button>
                                <button className="premium-button" onClick={saveBranding} disabled={savingBrand}>
                                    {savingBrand ? <RefreshIcon size={14} className="spin" /> : 'SAVE CHANGES'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .member-row:hover { background: rgba(255,255,255,0.03); }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
