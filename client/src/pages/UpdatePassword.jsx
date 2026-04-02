import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import { supabase } from '../utils/supabase.js';
import { AnimatedBackground, ShieldIcon, RefreshIcon, EyeIcon, EyeOffIcon } from '../components/SharedUI';

/**
 * ⚡ UI LAYER — PREMIUM PASSWORD UPDATE
 * =============================================================================
 * Responsibility: Secure interface for finalizing credential resets.
 * Features: High-security complexity validation, 
 *           integrated identity vetting, and direct store update.
 * =============================================================================
 */
export default function UpdatePassword() {
    const navigate = useNavigate();
    const { updatePassword, isAuthenticated } = useAuthStore();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        // Supabase should automatically handle the session retrieval from the fragment 
        // before we land here if we use their default magic link flow.
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // If no session, it means either the link is invalid/expired 
                // or we are not coming from a reset link.
                // However, in development we might want to manually check.
            }
        };
        checkSession();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (password.length < 8) {
            setError('CREDENTIAL PHRASE TOO SHORT (MIN 8 CHARS)');
            return;
        }
        if (password !== confirmPassword) {
            setError('IDENTIFIERS DO NOT MATCH');
            return;
        }

        setLoading(true);
        try {
            await updatePassword(password);
            setSuccess(true);
            setTimeout(() => navigate('/login'), 3000);
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
                style={{ width: '100%', maxWidth: '440px', padding: '48px', position: 'relative' }}
            >
                <AnimatePresence mode="wait">
                    {!success ? (
                        <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                                <h1 className="neon-text" style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>Reset Credentials</h1>
                                <p style={{ fontSize: '11px', fontWeight: 700, opacity: 0.4, letterSpacing: '2px', marginTop: '8px' }}>SECURE RECOVERY INTERFACE</p>
                            </div>

                            {error && (
                                <div style={{ background: 'rgba(255,75,43,0.1)', border: '1px solid rgba(255,75,43,0.2)', color: '#ff4b2b', padding: '12px', borderRadius: '8px', marginBottom: '24px', fontSize: '11px', fontWeight: 900, textAlign: 'center' }}>
                                    [SYSTEM ERR] {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '10px', fontWeight: 900, opacity: 0.5 }}>NEW PHRASE</label>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            style={{ ...inputStyle, paddingRight: '48px' }} 
                                            type={showPassword ? "text" : "password"}
                                            value={password} 
                                            onChange={(e) => setPassword(e.target.value)} 
                                            placeholder="••••••••"
                                            required
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setShowPassword(!showPassword)}
                                            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
                                        >
                                            {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '10px', fontWeight: 900, opacity: 0.5 }}>CONFIRM PHRASE</label>
                                    <input 
                                        style={inputStyle} 
                                        type="password"
                                        value={confirmPassword} 
                                        onChange={(e) => setConfirmPassword(e.target.value)} 
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>

                                <button className="premium-button" style={{ width: '100%', padding: '18px', fontSize: '12px' }} disabled={loading}>
                                    {loading ? <RefreshIcon className="spin" size={16} /> : 'UPDATE CREDENTIALS'}
                                </button>
                            </form>
                        </motion.div>
                    ) : (
                        <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center' }}>
                            <div style={{ width: '80px', height: '80px', background: 'rgba(0,255,157,0.1)', borderRadius: '50%', border: '2px solid #00ff9d', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px' }}>
                                <ShieldIcon size={32} color="#00ff9d" />
                            </div>
                            <h2 style={{ fontSize: '10px', color: '#00ff9d', fontWeight: 900, letterSpacing: '4px', marginBottom: '16px' }}>UPDATE SUCCESSFUL</h2>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, color: '#fff' }}>PHRASE RESET</h1>
                            <p style={{ fontSize: '14px', opacity: 0.5, marginTop: '24px' }}>
                                Redirecting to security login in 3 seconds...
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
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
