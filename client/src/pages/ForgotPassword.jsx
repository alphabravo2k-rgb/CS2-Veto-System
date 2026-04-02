import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import { AnimatedBackground, ShieldIcon, RefreshIcon } from '../components/SharedUI';

/**
 * ⚡ UI LAYER — PREMIUM PASSWORD RECOVERY
 * =============================================================================
 * Responsibility: Secure interface for initiating credential resets.
 * Features: Identity validation, automated link dispatching, 
 *           and hardware-accelerated feedback states.
 * =============================================================================
 */
export default function ForgotPassword() {
    const { forgotPassword } = useAuthStore();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email) return;
        
        setLoading(true);
        setError('');
        try {
            await forgotPassword(email.trim());
            setSent(true);
        } catch (err) {
            setError(err.message.toUpperCase());
        } finally {
            setLoading(false);
        }
    };

    const accentColor = '#00d4ff';

    return (
        <div className="auth-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050a14', padding: '20px' }}>
            <AnimatedBackground />

            <motion.div 
                className="glass-panel"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                style={{ width: '100%', maxWidth: '440px', padding: '48px', position: 'relative', overflow: 'hidden' }}
            >
                {/* Digital Scanline Background */}
                <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(transparent, transparent 2px, rgba(255,255,255,0.01) 2px, rgba(255,255,255,0.01) 4px)', pointerEvents: 'none' }} />

                <AnimatePresence mode="wait">
                    {!sent ? (
                        <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: 'blur(10px)' }}>
                            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                                <div style={{ width: '60px', height: '60px', margin: '0 auto 24px', background: `${accentColor}11`, borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${accentColor}44`, boxShadow: `0 0 20px ${accentColor}22` }}>
                                    <ShieldIcon size={28} color={accentColor} />
                                </div>
                                <h1 className="neon-text" style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>Restore Access</h1>
                                <p style={{ fontSize: '11px', fontWeight: 700, opacity: 0.4, letterSpacing: '2px', marginTop: '8px' }}>CREDENTIAL RECOVERY PROTOCOL</p>
                            </div>

                            {error && (
                                <div style={{ background: 'rgba(255,75,43,0.1)', border: '1px solid rgba(255,75,43,0.2)', color: '#ff4b2b', padding: '12px', borderRadius: '8px', marginBottom: '24px', fontSize: '11px', fontWeight: 900, textAlign: 'center' }}>
                                    [SYSTEM ERR] {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '10px', fontWeight: 900, opacity: 0.5, letterSpacing: '1px' }}>AGENT EMAIL</label>
                                    <input 
                                        style={inputStyle}
                                        type="email" 
                                        value={email} 
                                        onChange={(e) => setEmail(e.target.value)} 
                                        placeholder="user@example.com"
                                        required
                                    />
                                </div>

                                <button className="premium-button" style={{ width: '100%', padding: '18px', fontSize: '12px' }} disabled={loading}>
                                    {loading ? <RefreshIcon className="spin" size={16} /> : 'INITIALIZE RECOVERY'}
                                </button>
                            </form>
                        </motion.div>
                    ) : (
                        <motion.div key="sent" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center' }}>
                            <div style={{ width: '80px', height: '80px', background: 'rgba(0,255,157,0.1)', borderRadius: '50%', border: '2px solid #00ff9d', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px' }}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00ff9d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                            <h2 style={{ fontSize: '10px', color: '#00ff9d', fontWeight: 900, letterSpacing: '4px', marginBottom: '16px' }}>DISPATCH SUCCESSFUL</h2>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0, color: '#fff' }}>CHECK YOUR INBOX</h1>
                            <p style={{ fontSize: '14px', opacity: 0.5, marginTop: '24px', lineHeight: 1.6 }}>
                                A secure recovery link has been sent to <br />
                                <span style={{ color: '#fff', fontWeight: 700 }}>{email}</span>
                            </p>
                            <Link to="/login" className="premium-button" style={{ display: 'block', marginTop: '40px', padding: '16px', textDecoration: 'none' }}>
                                RETURN TO LOGIN
                            </Link>
                        </motion.div>
                    )}
                </AnimatePresence>

                {!sent && (
                    <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '11px', fontWeight: 700, opacity: 0.4 }}>
                        RECOLLECTED YOUR PHRASE? <Link to="/login" style={{ color: accentColor, textDecoration: 'none', marginLeft: '4px' }}>SIGN IN</Link>
                    </div>
                )}
            </motion.div>

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

const inputStyle = {
    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
    padding: '16px', borderRadius: '12px', color: '#fff', outline: 'none',
    fontWeight: 700, width: '100%', boxSizing: 'border-box'
};
