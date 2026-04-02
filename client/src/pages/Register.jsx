import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../store/useAuthStore';
import { AnimatedBackground, ShieldIcon, RefreshIcon, GlobeIcon, CheckIcon, EyeIcon, EyeOffIcon } from '../components/SharedUI';

const STEPS = ['Identity', 'Profile', 'Region', 'Finalize'];
const REGIONS = [
    { id: 'EU', label: '🌍 Europe' },
    { id: 'NA', label: '🌎 North America' },
    { id: 'SEA', label: '🌏 Southeast Asia' },
    { id: 'ME', label: '🌍 Middle East' },
    { id: 'Faceit', label: '🎯 Faceit' },
];

const COUNTRIES = [
    { code: 'USA', name: 'United States' },
    { code: 'GBR', name: 'United Kingdom' },
    { code: 'GER', name: 'Germany' },
    { code: 'FRA', name: 'France' },
    { code: 'CAN', name: 'Canada' },
    { code: 'BRA', name: 'Brazil' },
    { code: 'IND', name: 'India' },
    { code: 'CHN', name: 'China' },
    { code: 'JPN', name: 'Japan' },
    { code: 'AUS', name: 'Australia' },
    { code: 'RUS', name: 'Russia' },
    { code: 'TUR', name: 'Turkey' },
    { code: 'PAK', name: 'Pakistan' },
    { code: 'KOR', name: 'South Korea' },
    { code: 'ESP', name: 'Spain' },
    { code: 'ITA', name: 'Italy' },
    { code: 'POL', name: 'Poland' },
    { code: 'SWE', name: 'Sweden' },
    { code: 'ARG', name: 'Argentina' }
];

/**
 * ⚡ UI LAYER — PREMIUM REGISTRATION FLOW
 * =============================================================================
 * Responsibility: Multi-step enrollment for new agents.
 * Features: High-fidelity progress telemetry, hardware-accelerated glass 
 *           transitions, and integrated identity vetting.
 * =============================================================================
 */
export default function Register() {
    const navigate = useNavigate();
    const { register } = useAuthStore();

    const [showSuccess, setShowSuccess] = useState(false);

    const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
    const handle = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    };

    const validateStep = () => {
        setError('');
        if (step === 0) {
            if (!form.email || !form.email.includes('@')) return 'Valid email required';
            if (!form.username || form.username.length < 3) return 'Identifier too short';
            if (!form.password || form.password.length < 8) return 'Password too weak';
            if (form.password !== form.confirmPassword) return 'Phrases do not match';
        }
        if (step === 2 && !form.serverRegion) return 'Server region required';
        if (step === 3) {
            if (!form.dob || !form.ageConsent) return 'Age verification required';
        }
        return null;
    };

    const nextStep = () => {
        const err = validateStep();
        if (err) { setError(err.toUpperCase()); return; }
        setDirection(1);
        setStep(s => s + 1);
    };

    const prevStep = () => {
        setError('');
        setDirection(-1);
        setStep(s => s - 1);
    };

    const handleSubmit = async () => {
        const err = validateStep();
        if (err) { setError(err.toUpperCase()); return; }
        setLoading(true);
        try {
            const user = await register({
                email: form.email.trim(),
                password: form.password,
                username: form.username.trim(),
                displayName: form.displayName.trim() || form.username.trim(),
                country: form.country || null,
                serverRegion: form.serverRegion,
                dob: form.dob,
                ageConsent: form.ageConsent,
            });
            
            // If Supabase returns a user but no session, it means confirmation is required
            setShowSuccess(true);
        } catch (err) {
            setError(err.message.toUpperCase());
        } finally {
            setLoading(false);
        }
    };

    const slideVariants = {
        enter: (dir) => ({ x: dir > 0 ? 50 : -50, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (dir) => ({ x: dir > 0 ? -50 : 50, opacity: 0 }),
    };

    const accentColor = 'var(--brand-primary, #00d4ff)';

    if (showSuccess) {
        return (
            <div className="auth-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050a14', padding: '20px' }}>
                <AnimatedBackground />
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '64px', textAlign: 'center' }}>
                    <div style={{ width: '80px', height: '80px', background: `${accentColor}11`, borderRadius: '50%', border: `2px solid ${accentColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', boxShadow: `0 0 30px ${accentColor}44` }}>
                        <GlobeIcon size={32} color={accentColor} />
                    </div>
                    <h2 style={{ fontSize: '10px', color: accentColor, fontWeight: 900, letterSpacing: '4px', marginBottom: '16px' }}>ENCRYPTION KEY DISPATCHED</h2>
                    <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0, color: '#fff' }}>CHECK YOUR EMAIL</h1>
                    <p style={{ fontSize: '14px', opacity: 0.5, marginTop: '24px', lineHeight: 1.6, fontWeight: 500 }}>
                        We have sent a secure authorization link to <br /><span style={{ color: '#fff', fontWeight: 700 }}>{form.email}</span>. <br />
                        Please verify your identity to activate your account.
                    </p>
                    <button className="premium-button" style={{ marginTop: '40px', width: '100%', padding: '16px' }} onClick={() => navigate('/login')}>
                        BACK TO LOGIN
                    </button>
                </motion.div>
            </div>
        );
    }


    return (
        <div className="auth-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050a14', padding: '20px' }}>
            <AnimatedBackground />

            <motion.div
                className="glass-panel"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ width: '100%', maxWidth: '500px', padding: '48px', position: 'relative' }}
            >
                {/* ── HEADER & TELEMETRY ── */}
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <h1 className="neon-text" style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>Create Account</h1>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
                        {STEPS.map((s, i) => (
                            <div key={s} style={{ 
                                width: '32px', height: '6px', borderRadius: '3px', 
                                background: i === step ? accentColor : i < step ? `${accentColor}44` : 'rgba(255,255,255,0.05)',
                                transition: 'all 0.3s',
                                boxShadow: i === step ? `0 0 10px ${accentColor}` : 'none'
                            }} />
                        ))}
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {error && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ background: 'rgba(255,75,43,0.1)', border: '1px solid rgba(255,75,43,0.2)', color: '#ff4b2b', padding: '12px', borderRadius: '8px', marginBottom: '24px', fontSize: '11px', fontWeight: 900, textAlign: 'center' }}>
                            [ERR] {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div style={{ minHeight: '320px' }}>
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={step}
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                        >
                            {step === 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '10px', fontWeight: 900, opacity: 0.5 }}>EMAIL ADDRESS</label>
                                        <input style={inputStyle} name="email" value={form.email} onChange={handle} placeholder="user@example.com" />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '10px', fontWeight: 900, opacity: 0.5 }}>USERNAME</label>
                                        <input style={inputStyle} name="username" value={form.username} onChange={handle} placeholder="Choose a username" />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '10px', fontWeight: 900, opacity: 0.5 }}>PASSWORD</label>
                                        <div style={{ position: 'relative' }}>
                                            <input style={{ ...inputStyle, paddingRight: '48px' }} type={showPassword ? "text" : "password"} name="password" value={form.password} onChange={handle} placeholder="••••••••" />
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
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '10px', fontWeight: 900, opacity: 0.5 }}>CONFIRM PASSWORD</label>
                                        <div style={{ position: 'relative' }}>
                                            <input style={{ ...inputStyle, paddingRight: '48px' }} type={showConfirmPassword ? "text" : "password"} name="confirmPassword" value={form.confirmPassword} onChange={handle} placeholder="••••••••" />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                style={{
                                                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                                                    background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}
                                            >
                                                {showConfirmPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 1 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '10px', fontWeight: 900, opacity: 0.5 }}>DISPLAY NAME (OPTIONAL)</label>
                                        <input style={inputStyle} name="displayName" value={form.displayName} onChange={handle} placeholder="Display Name" />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '10px', fontWeight: 900, opacity: 0.5 }}>COUNTRY</label>
                                        <input 
                                            list="country_list" 
                                            style={inputStyle} 
                                            name="country" 
                                            value={form.country} 
                                            onChange={handle} 
                                            placeholder="Type or select a country (e.g. PAK)" 
                                            autoComplete="off"
                                        />
                                        <datalist id="country_list">
                                            {COUNTRIES.map(c => <option key={c.code} value={`${c.code} (${c.name})`} />)}
                                        </datalist>
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div>
                                    <div style={{ fontSize: '10px', opacity: 0.5, letterSpacing: '2px', fontWeight: 900 }}>REGION CONFIGURATION</div>
                                    <p style={{ fontSize: '13px', opacity: 0.6, marginBottom: '24px', textAlign: 'center' }}>Select your primary region for optimal server routing.</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        {REGIONS.map(r => (
                                            <button
                                                key={r.id}
                                                type="button"
                                                onClick={() => set('serverRegion', r.id)}
                                                className={form.serverRegion === r.id ? "premium-button" : "glass-panel"}
                                                style={{ 
                                                    padding: '16px', fontSize: '12px', fontWeight: 900, cursor: 'pointer',
                                                    background: form.serverRegion === r.id ? accentColor : 'rgba(255,255,255,0.05)',
                                                    border: form.serverRegion === r.id ? 'none' : '1px solid rgba(255,255,255,0.1)'
                                                }}
                                            >
                                                {r.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '10px', fontWeight: 900, opacity: 0.5 }}>DATE OF BIRTH</label>
                                        <input style={inputStyle} type="date" name="dob" value={form.dob} onChange={handle} />
                                    </div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <input type="checkbox" name="ageConsent" checked={form.ageConsent} onChange={handle} style={{ accentColor }} />
                                        <span style={{ fontSize: '11px', fontWeight: 700, lineHeight: 1.4, opacity: 0.8 }}>I confirm I am 13+ and agree to operational protocols.</span>
                                    </label>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* ── FOOTER NAV ── */}
                <div style={{ display: 'flex', gap: '16px', marginTop: '40px' }}>
                    {step > 0 && (
                        <button className="glass-panel" style={{ flex: 1, padding: '16px', fontWeight: 900, fontSize: '12px', cursor: 'pointer' }} onClick={prevStep} disabled={loading}>BACK</button>
                    )}
                    <button className="premium-button" style={{ flex: 2, padding: '16px', fontSize: '12px' }} onClick={step < STEPS.length - 1 ? nextStep : handleSubmit} disabled={loading}>
                        {loading ? <RefreshIcon className="spin" size={16} /> : step < STEPS.length - 1 ? 'CONTINUE' : 'REGISTER'}
                    </button>
                </div>

                <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '12px', fontWeight: 600, opacity: 0.6 }}>
                    ALREADY HAVE AN ACCOUNT? <Link to="/login" style={{ color: accentColor, textDecoration: 'none', fontWeight: 900 }}>SIGN IN</Link>
                </div>
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
