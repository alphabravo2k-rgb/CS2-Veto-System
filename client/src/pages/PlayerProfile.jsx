import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedBackground, ShieldIcon, ActivityIcon, GlobeIcon, HomeIcon } from '../components/SharedUI';

const API = import.meta.env.VITE_SOCKET_URL?.replace(/\/$/, '') || 'http://localhost:3001';

const REGION_LABELS = { EU: '🌍 Europe', NA: '🌎 North America', SEA: '🌏 Southeast Asia', ME: '🌍 Middle East', Faceit: '🎯 Faceit' };
const PLATFORM_ICONS = { steam: '🎮', riot: '⚡', epic: '🎯', faceit: '🔥' };

/**
 * ⚡ UI LAYER — PREMIUM PLAYER PROFILE
 * =============================================================================
 * Responsibility: Public-facing agent identity card.
 * Features: Hardware-accelerated glass panels, neon avatar signaling, 
 *           integrated account telemetry.
 * =============================================================================
 */
export default function PlayerProfile() {
    const { userId } = useParams();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState('');

    useEffect(() => {
        fetch(`${API}/api/players/${userId}`)
            .then(r => { if (!r.ok) throw new Error('Player not found'); return r.json(); })
            .then(setProfile)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [userId]);

    if (loading) {
        return (
            <div className="profile-loading" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050a14' }}>
                <AnimatedBackground />
                <div className="spinner-large" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="profile-error" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050a14' }}>
                <AnimatedBackground />
                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
                    <h2 style={{ color: '#ff4b2b' }}>[SECTOR NOT FOUND]</h2>
                    <p style={{ opacity: 0.6 }}>The requested agent ID does not exist in the database.</p>
                    <Link to="/" className="premium-button" style={{ marginTop: '1rem' }}>RETURN TO SECTOR 0</Link>
                </div>
            </div>
        );
    }

    const accentColor = 'var(--brand-primary, #00d4ff)';

    return (
        <div className="profile-page" style={{ minHeight: '100vh', background: '#050a14', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
            <AnimatedBackground />
            
            <motion.div 
                className="glass-panel" 
                initial={{ opacity: 0, scale: 0.9, y: 30 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }}
                style={{ width: '100%', maxWidth: '500px', overflow: 'hidden', padding: 0 }}
            >
                {/* ── HEADER ── */}
                <div style={{ background: `linear-gradient(180deg, ${accentColor}11, transparent)`, padding: '48px 40px 32px', textAlign: 'center', position: 'relative' }}>
                    <div style={{ width: '130px', height: '130px', margin: '0 auto 24px', position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid ${accentColor}`, boxShadow: `0 0 30px ${accentColor}44`, animation: 'pulse 2s infinite ease-in-out' }} />
                        {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '5px solid #050a14', position: 'relative', zIndex: 1 }} />
                        ) : (
                            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', fontWeight: 900, border: '5px solid #050a14', position: 'relative', zIndex: 1, color: accentColor }}>
                                {(profile.username || 'U').charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <h1 className="neon-text" style={{ fontSize: '2rem', fontWeight: 900, margin: 0 }}>{profile.display_name || profile.username}</h1>
                    <p style={{ opacity: 0.4, fontSize: '0.9rem', fontWeight: 700, marginTop: '8px' }}>AGENT: @{profile.username}</p>
                    
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '16px' }}>
                        {profile.country && (
                            <div style={{ fontSize: '10px', fontWeight: 900, color: '#fff', background: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '50px', letterSpacing: '1px' }}>
                                {profile.country.toUpperCase()}
                            </div>
                        )}
                        {profile.server_region && (
                            <div style={{ fontSize: '10px', fontWeight: 900, color: accentColor, background: `${accentColor}22`, border: `1px solid ${accentColor}44`, padding: '4px 12px', borderRadius: '50px', letterSpacing: '1px' }}>
                                {REGION_LABELS[profile.server_region] || profile.server_region}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── BIO ── */}
                <div style={{ padding: '0 40px 32px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <p style={{ margin: 0, fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', textAlign: 'center', lineHeight: 1.6 }}>
                            {profile.bio || "This agent has not yet provided an operational briefing."}
                        </p>
                    </div>
                </div>

                {/* ── ACCOUNTS ── */}
                {profile.linkedAccounts && profile.linkedAccounts.length > 0 && (
                    <div style={{ padding: '0 40px 32px' }}>
                        <h4 style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '2px', opacity: 0.4, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ShieldIcon size={12} /> SECURE LINKS
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {profile.linkedAccounts.map(acc => (
                                <div key={acc.platform} className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 20px', background: 'rgba(255,255,255,0.02)' }}>
                                    <span style={{ fontSize: '1.2rem' }}>{PLATFORM_ICONS[acc.platform] || '📡'}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '12px', fontWeight: 900 }}>{acc.platform.toUpperCase()}</div>
                                        {acc.platform_username && <div style={{ fontSize: '11px', opacity: 0.5 }}>{acc.platform_username}</div>}
                                    </div>
                                    <div className="premium-button" style={{ padding: '4px 8px', fontSize: '9px' }}>VERIFIED</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── FOOTER ── */}
                <div style={{ padding: '24px 40px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '10px', opacity: 0.3, fontWeight: 700 }}>
                        ENLISTED: {new Date(profile.created_at).toLocaleDateString().toUpperCase()}
                    </div>
                    <Link to="/" style={{ color: accentColor, textDecoration: 'none', fontSize: '10px', fontWeight: 900, letterSpacing: '2px' }}>
                        BACK TO PORTAL
                    </Link>
                </div>
            </motion.div>

            <style>{`
                @keyframes pulse { 0% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.05); } 100% { opacity: 0.3; transform: scale(1); } }
            `}</style>
        </div>
    );
}
