import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../store/useAuthStore';
import { AnimatedBackground, CheckIcon, RefreshIcon, ShieldIcon, GlobeIcon, HomeIcon } from '../components/SharedUI';

const REGIONS  = ['EU','NA','SEA','ME','Faceit'];
const PLATFORMS = [
    { id: 'steam',  label: '🎮 Steam',  placeholder: 'Steam64 ID (e.g. 76561198...)' },
    { id: 'riot',   label: '⚡ Riot',   placeholder: 'GameName#TAG' },
    { id: 'faceit', label: '🔥 FACEIT', placeholder: 'FACEIT username' },
];

/**
 * ⚡ UI LAYER — PREMIUM PROFILE EDITOR
 * =============================================================================
 * Responsibility: Secure interface for agent calibration and account linking.
 * Features: Multi-phase glass forms, real-time validation, and 
 *           integrated identity telemetry.
 * =============================================================================
 */
export default function ProfileEdit() {
    const navigate = useNavigate();
    const { authFetch, user } = useAuthStore();

    const [profile, setProfile] = useState(null);
    const [form, setForm] = useState({ username: '', displayName: '', country: '', serverRegion: '', bio: '', avatarUrl: '' });
    const [loading,  setLoading]  = useState(true);
    const [saving,   setSaving]   = useState(false);
    const [error,    setError]    = useState('');
    const [success,  setSuccess]  = useState('');

    const [linkPlatform, setLinkPlatform] = useState({ platform: '', platformId: '', platformUsername: '' });
    const [linkSaving, setLinkSaving] = useState(false);

    useEffect(() => {
        authFetch('/api/players/me')
            .then(r => r.json())
            .then(data => {
                setProfile(data);
                setForm({
                    username:     data.username || '',
                    displayName:  data.display_name || '',
                    country:      data.country || '',
                    serverRegion: data.server_region || '',
                    bio:          data.bio || '',
                    avatarUrl:    data.avatar_url || '',
                });
            })
            .catch(() => setError('Failed to load profile'))
            .finally(() => setLoading(false));
    }, [authFetch]);

    const handleSave = async (e) => {
        e.preventDefault();
        setError(''); setSuccess(''); setSaving(true);
        try {
            const res = await authFetch('/api/players/me', {
                method: 'PATCH',
                body: JSON.stringify({
                    username:     form.username,
                    displayName:  form.displayName,
                    country:      form.country || null,
                    serverRegion: form.serverRegion || null,
                    bio:          form.bio || null,
                    avatarUrl:    form.avatarUrl || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                const msg = data.lockedUntil
                    ? `Username locked until ${new Date(data.lockedUntil).toLocaleDateString()}`
                    : data.error;
                throw new Error(msg);
            }
            setProfile(data);
            setSuccess('CALIBRATION COMPLETE');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleLinkPlatform = async () => {
        setLinkSaving(true);
        try {
            const res = await authFetch('/api/players/me/accounts', {
                method: 'POST',
                body: JSON.stringify(linkPlatform),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setProfile(p => ({ ...p, linkedAccounts: [...(p?.linkedAccounts || []).filter(a => a.platform !== linkPlatform.platform), { platform: linkPlatform.platform, platform_username: linkPlatform.platformUsername, platform_id: linkPlatform.platformId }] }));
            setLinkPlatform({ platform: '', platformId: '', platformUsername: '' });
            setSuccess('TELEMETRY LINKED');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setLinkSaving(false);
        }
    };

    const usernameLockedUntil = profile?.usernameLockedUntil
        ? new Date(profile.usernameLockedUntil).toLocaleDateString()
        : null;

    if (loading) {
        return (
            <div className="profile-loading" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050a14' }}>
                <AnimatedBackground />
                <div className="spinner-large" />
            </div>
        );
    }

    const accentColor = 'var(--brand-primary, #00d4ff)';

    return (
        <div className="pf-page" style={{ minHeight: '100vh', background: '#050a14', color: '#fff', padding: '60px 20px' }}>
            <AnimatedBackground />
            
            <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: '40px', position: 'relative', zIndex: 10 }}>
                
                {/* ── CORE SETTINGS ── */}
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                    <div className="glass-panel" style={{ padding: '40px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                            <div>
                                <h1 className="neon-text" style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>AGENT CALIBRATION</h1>
                                <div style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '2px', opacity: 0.5, marginTop: '4px' }}>PERMANENT IDENTITY DATA</div>
                            </div>
                            <button className="glass-panel" onClick={() => navigate(-1)} style={{ padding: '8px 16px', fontSize: '10px', fontWeight: 900, cursor: 'pointer' }}>BACK</button>
                        </div>

                        {error   && <div style={{ background: 'rgba(255,75,43,0.1)', border: '1px solid rgba(255,75,43,0.2)', color: '#ff4b2b', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontSize: '13px', fontWeight: 700 }}>[ALERT] {error}</div>}
                        {success && <div style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)', color: '#00ff88', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontSize: '13px', fontWeight: 700 }}>[SUCCESS] {success}</div>}

                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '1px', opacity: 0.5 }}>IDENTIFIER (Locked: 30 days)</label>
                                    <input 
                                        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '12px', color: '#fff', outline: 'none', fontWeight: 700, opacity: !!usernameLockedUntil ? 0.4 : 1 }}
                                        value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} disabled={!!usernameLockedUntil}
                                    />
                                    {usernameLockedUntil && <div style={{ fontSize: '9px', color: '#ffd700', fontWeight: 900 }}>🔒 SIGNAL LOCKED UNTIL {usernameLockedUntil}</div>}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '1px', opacity: 0.5 }}>DISPLAY NAME</label>
                                    <input 
                                        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '12px', color: '#fff', outline: 'none', fontWeight: 700 }}
                                        value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '1px', opacity: 0.5 }}>OPERATIONAL BRIEFING (BIO)</label>
                                <textarea 
                                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '12px', color: '#fff', outline: 'none', fontWeight: 400, minHeight: '100px', resize: 'vertical' }}
                                    value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} maxLength={500}
                                />
                                <div style={{ textAlign: 'right', fontSize: '10px', opacity: 0.3 }}>{form.bio.length}/500 CHARS</div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '1px', opacity: 0.5 }}>NATIONAL CODE</label>
                                    <input 
                                        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '12px', color: '#fff', outline: 'none', fontWeight: 700 }}
                                        value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="e.g. GER"
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '1px', opacity: 0.5 }}>SECTOR REGION</label>
                                    <select 
                                        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '12px', color: '#fff', outline: 'none', fontWeight: 700, appearance: 'none' }}
                                        value={form.serverRegion} onChange={e => setForm(f => ({ ...f, serverRegion: e.target.value }))}
                                    >
                                        <option value="">UNCATEGORIZED</option>
                                        {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '1px', opacity: 0.5 }}>AVATAR SOURCE URL</label>
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                    {form.avatarUrl && <img src={form.avatarUrl} alt="preview" style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover', border: `1px solid ${accentColor}` }} onError={e => e.target.style.display='none'} />}
                                    <input 
                                        style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '12px', color: '#fff', outline: 'none' }}
                                        value={form.avatarUrl} onChange={e => setForm(f => ({ ...f, avatarUrl: e.target.value }))} placeholder="https://..."
                                    />
                                </div>
                            </div>

                            <button type="submit" className="premium-button" style={{ width: '100%', padding: '16px' }} disabled={saving}>
                                {saving ? <RefreshIcon className="spin" size={16} /> : 'APPLY PERMANENT CHANGES'}
                            </button>
                        </form>
                    </div>
                </motion.div>

                {/* ── LINKING ── */}
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                    <div className="glass-panel" style={{ padding: '32px' }}>
                        <h2 style={{ fontSize: '1rem', fontWeight: 900, letterSpacing: '2px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <ShieldIcon size={18} color={accentColor} /> SECURE LINKS
                        </h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                            {profile?.linkedAccounts?.map(acc => (
                                <div key={acc.platform} className="glass-panel" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)' }}>
                                    <span style={{ fontSize: '9px', fontWeight: 900, color: accentColor }}>{acc.platform.toUpperCase()}</span>
                                    <span style={{ fontSize: '11px', fontWeight: 700, opacity: 0.5 }}>{acc.platform_username || "VERIFIED"}</span>
                                </div>
                            ))}
                        </div>

                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <select 
                                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px', color: '#fff', outline: 'none' }}
                                value={linkPlatform.platform} onChange={e => setLinkPlatform(l => ({ ...l, platform: e.target.value }))}
                            >
                                <option value="">SELECT PLATFORM</option>
                                {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                            </select>
                            
                            {linkPlatform.platform && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <input 
                                        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px', color: '#fff', outline: 'none', fontSize: '12px' }}
                                        value={linkPlatform.platformId} onChange={e => setLinkPlatform(l => ({ ...l, platformId: e.target.value }))}
                                        placeholder={PLATFORMS.find(p => p.id === linkPlatform.platform)?.placeholder || 'ID'}
                                    />
                                    <input 
                                        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px', color: '#fff', outline: 'none', fontSize: '12px' }}
                                        value={linkPlatform.platformUsername} onChange={e => setLinkPlatform(l => ({ ...l, platformUsername: e.target.value }))}
                                        placeholder="Display Identifier"
                                    />
                                    <button className="premium-button" style={{ padding: '12px' }} onClick={handleLinkPlatform} disabled={linkSaving}>
                                        {linkSaving ? <RefreshIcon className="spin" size={14} /> : 'AUTHORIZE LINK'}
                                    </button>
                                </motion.div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
