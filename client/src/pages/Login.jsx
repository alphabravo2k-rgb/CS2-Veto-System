import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../store/useAuthStore';
import { AnimatedBackground, ShieldIcon, RefreshIcon, GlobeIcon, EyeIcon, EyeOffIcon } from '../components/SharedUI';

/**
 * ⚡ UI LAYER — PREMIUM AUTHENTICATION PORTAL
 * =============================================================================
 * Responsibility: Secure gateway for user authorization.
 * Features: Hardware-accelerated glassmorphism, fluid state transitions.
 * =============================================================================
 */
export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuthStore();

    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login({ email: form.email.trim(), password: form.password });
            navigate('/');
        } catch (err) {
            setError(err.message.toUpperCase());
        } finally {
            setLoading(false);
        }
    };

    const accentColor = 'var(--brand-primary, #00d4ff)';

    return (
        <div className="auth-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050a14', padding: '20px' }}>
            <AnimatedBackground />

            <motion.div
                className="glass-panel"
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                style={{ width: '100%', maxWidth: '440px', padding: '48px', position: 'relative', overflow: 'hidden' }}
            >
                {/* ── LOGO & HEADER ── */}
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{ width: '60px', height: '60px', margin: '0 auto 20px', background: `${accentColor}22`, borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${accentColor}44`, boxShadow: `0 0 20px ${accentColor}22` }}>
                        <ShieldIcon size={32} color={accentColor} />
                    </div>
                    <h1 className="neon-text" style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0 }}>VETO.GG</h1>
                    <div style={{ fontSize: '10px', fontWeight: 900, opacity: 0.4, letterSpacing: '4px', marginTop: '4px' }}>AUTHORIZED PERSONNEL ONLY</div>
                </div>

                <AnimatePresence mode="wait">
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{ 
                                background: 'rgba(255,75,43,0.1)', border: '1px solid rgba(255,75,43,0.2)', 
                                color: '#ff4b2b', padding: '12px 16px', borderRadius: '8px', 
                                marginBottom: '24px', fontSize: '11px', fontWeight: 900, letterSpacing: '1px'
                            }}
                        >
                            [ERR] {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '1px', opacity: 0.5 }}>EMAIL ADDRESS</label>
                        <input
                            name="email" type="email" required
                            placeholder="user@example.com"
                            value={form.email} onChange={handleChange}
                            style={{ 
                                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', 
                                padding: '16px', borderRadius: '12px', color: '#fff', outline: 'none', fontWeight: 700 
                            }}
                        />
                    </div>

                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '1px', opacity: 0.5 }}>PASSWORD</label>
                            <Link to="/forgot-password" style={{ fontSize: '10px', fontWeight: 900, color: accentColor, textDecoration: 'none', letterSpacing: '1px', opacity: 0.7 }}>FORGOT PASSWORD?</Link>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <input
                                name="password" type={showPassword ? "text" : "password"} required
                                placeholder="••••••••"
                                value={form.password} onChange={handleChange}
                                style={{ 
                                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', 
                                    padding: '16px', paddingRight: '48px', borderRadius: '12px', color: '#fff', outline: 'none', fontWeight: 700,
                                    width: '100%', boxSizing: 'border-box'
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                            >
                                {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="premium-button"
                        disabled={loading}
                        style={{ width: '100%', padding: '18px', marginTop: '12px', fontSize: '13px' }}
                    >
                        {loading ? <RefreshIcon className="spin" size={16} /> : 'SIGN IN'}
                    </button>
                </form>

                <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '12px', fontWeight: 600, opacity: 0.6 }}>
                    DON'T HAVE AN ACCOUNT? <Link to="/register" style={{ color: accentColor, textDecoration: 'none', fontWeight: 900 }}>REGISTER NOW</Link>
                </div>
            </motion.div>

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
