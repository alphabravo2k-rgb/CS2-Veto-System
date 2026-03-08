import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../store/useAuthStore';

const STEPS = ['Identity', 'Profile', 'Region', 'Consent'];
const REGIONS = [
    { id: 'EU', label: '🇪🇺 Europe' },
    { id: 'NA', label: '🌎 North America' },
    { id: 'SEA', label: '🌏 Southeast Asia' },
    { id: 'ME', label: '🌍 Middle East' },
    { id: 'Faceit', label: '🎯 Faceit Match' },
];

const COUNTRIES = [
    'Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Belgium','Brazil',
    'Bulgaria','Canada','Chile','China','Colombia','Croatia','Czech Republic','Denmark',
    'Egypt','Estonia','Finland','France','Germany','Greece','Hungary','India','Indonesia',
    'Iran','Iraq','Israel','Italy','Japan','Jordan','Kazakhstan','Latvia','Lithuania',
    'Malaysia','Mexico','Netherlands','New Zealand','Norway','Pakistan','Peru','Philippines',
    'Poland','Portugal','Romania','Russia','Saudi Arabia','Serbia','Singapore','Slovakia',
    'Slovenia','South Africa','South Korea','Spain','Sweden','Switzerland','Thailand',
    'Turkey','Ukraine','United Arab Emirates','United Kingdom','United States','Vietnam',
];

export default function Register() {
    const navigate = useNavigate();
    const { register } = useAuthStore();

    const [step, setStep] = useState(0);
    const [form, setForm] = useState({
        email: '', password: '', confirmPassword: '', username: '',
        displayName: '', country: '', serverRegion: '',
        dob: '', ageConsent: false,
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [direction, setDirection] = useState(1);

    const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
    const handle = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    };

    const validateStep = () => {
        setError('');
        if (step === 0) {
            if (!form.email || !form.email.includes('@')) return 'Valid email required';
            if (!form.username || form.username.length < 3) return 'Username must be at least 3 characters';
            if (!form.password || form.password.length < 8) return 'Password must be at least 8 characters';
            if (form.password !== form.confirmPassword) return 'Passwords do not match';
        }
        if (step === 2 && !form.serverRegion) return 'Please select your server region';
        if (step === 3) {
            if (!form.dob) return 'Date of birth required';
            if (!form.ageConsent) return 'You must confirm you are 13 or older';
        }
        return null;
    };

    const nextStep = () => {
        const err = validateStep();
        if (err) { setError(err); return; }
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
        if (err) { setError(err); return; }
        setLoading(true);
        try {
            await register({
                email: form.email.trim(),
                password: form.password,
                username: form.username.trim(),
                displayName: form.displayName.trim() || form.username.trim(),
                country: form.country || null,
                serverRegion: form.serverRegion,
                dob: form.dob,
                ageConsent: form.ageConsent,
            });
            navigate('/');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const slideVariants = {
        enter: (dir) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (dir) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
    };

    return (
        <div className="auth-page">
            <div className="auth-bg-grid" />
            <motion.div
                className="auth-card register-card"
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div className="auth-logo">
                    <span className="auth-logo-icon">⚡</span>
                    <h1>VetoPortal</h1>
                </div>

                {/* Step indicators */}
                <div className="step-indicators">
                    {STEPS.map((s, i) => (
                        <div key={s} className={`step-dot ${i === step ? 'active' : i < step ? 'done' : ''}`}>
                            {i < step ? '✓' : i + 1}
                            <span className="step-label">{s}</span>
                        </div>
                    ))}
                </div>

                {error && (
                    <motion.div className="auth-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        {error}
                    </motion.div>
                )}

                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={step}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="step-content"
                    >
                        {step === 0 && (
                            <div className="form-fields">
                                <div className="form-group">
                                    <label>Email</label>
                                    <input type="email" name="email" placeholder="you@example.com" value={form.email} onChange={handle} autoComplete="email" />
                                </div>
                                <div className="form-group">
                                    <label>Username</label>
                                    <input type="text" name="username" placeholder="your_handle" value={form.username} onChange={handle} autoComplete="username" />
                                    <span className="form-hint">3–30 chars. Letters, numbers, _ or -. Locked for 6 months after change.</span>
                                </div>
                                <div className="form-group">
                                    <label>Password</label>
                                    <input type="password" name="password" placeholder="Min 8 characters" value={form.password} onChange={handle} autoComplete="new-password" />
                                </div>
                                <div className="form-group">
                                    <label>Confirm Password</label>
                                    <input type="password" name="confirmPassword" placeholder="Repeat password" value={form.confirmPassword} onChange={handle} autoComplete="new-password" />
                                </div>
                            </div>
                        )}

                        {step === 1 && (
                            <div className="form-fields">
                                <div className="form-group">
                                    <label>Display Name <span className="optional">optional</span></label>
                                    <input type="text" name="displayName" placeholder="How you appear to others" value={form.displayName} onChange={handle} />
                                </div>
                                <div className="form-group">
                                    <label>Country <span className="optional">optional</span></label>
                                    <select name="country" value={form.country} onChange={handle} className="form-select">
                                        <option value="">Select country</option>
                                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="form-fields">
                                <p className="step-description">Select your primary server region. This helps match you to tournaments with the best conditions.</p>
                                <div className="region-grid">
                                    {REGIONS.map(r => (
                                        <button
                                            key={r.id}
                                            type="button"
                                            className={`region-btn ${form.serverRegion === r.id ? 'selected' : ''}`}
                                            onClick={() => set('serverRegion', r.id)}
                                        >
                                            {r.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="form-fields">
                                <div className="form-group">
                                    <label>Date of Birth</label>
                                    <input type="date" name="dob" value={form.dob} onChange={handle} max={new Date().toISOString().slice(0, 10)} />
                                    <span className="form-hint">Private — never displayed publicly. Required to verify age eligibility.</span>
                                </div>
                                <div className="form-group">
                                    <label className="checkbox-label">
                                        <input type="checkbox" name="ageConsent" checked={form.ageConsent} onChange={handle} />
                                        <span>I confirm I am 13 years or older and agree to the Terms of Service.</span>
                                    </label>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                <div className="step-nav">
                    {step > 0 && (
                        <button className="btn-ghost" onClick={prevStep} disabled={loading}>
                            ← Back
                        </button>
                    )}
                    <div style={{ flex: 1 }} />
                    {step < STEPS.length - 1 ? (
                        <button className="btn-primary" onClick={nextStep} id="register-next">
                            Continue →
                        </button>
                    ) : (
                        <button className="btn-primary" onClick={handleSubmit} disabled={loading} id="register-submit">
                            {loading ? <span className="btn-spinner" /> : 'Create Account'}
                        </button>
                    )}
                </div>

                <p className="auth-footer">
                    Already have an account?{' '}
                    <Link to="/login" className="auth-link">Sign in</Link>
                </p>
            </motion.div>

            <style>{`
                .auth-page { min-height:100vh; display:flex; align-items:center; justify-content:center; background:#050a14; position:relative; overflow:hidden; font-family:'Inter',sans-serif; }
                .auth-bg-grid { position:absolute; inset:0; background-image: linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px), linear-gradient(90deg,rgba(0,212,255,0.04) 1px, transparent 1px); background-size:40px 40px; }
                .auth-card, .register-card { position:relative; z-index:1; background:rgba(255,255,255,0.03); border:1px solid rgba(0,212,255,0.15); border-radius:20px; padding:40px 44px; width:100%; max-width:480px; backdrop-filter:blur(20px); box-shadow:0 24px 64px rgba(0,0,0,0.5); }
                .auth-logo { display:flex; align-items:center; gap:10px; margin-bottom:20px; }
                .auth-logo-icon { font-size:22px; }
                .auth-logo h1 { font-size:18px; font-weight:800; color:#00d4ff; margin:0; }
                .step-indicators { display:flex; align-items:center; gap:8px; margin-bottom:24px; }
                .step-dot { display:flex; flex-direction:column; align-items:center; gap:4px; width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#6b7fa3; font-size:13px; font-weight:700; justify-content:center; transition:all .2s; position:relative; }
                .step-dot.active { background:rgba(0,212,255,0.1); border-color:#00d4ff; color:#00d4ff; }
                .step-dot.done { background:rgba(0,212,255,0.15); border-color:#00d4ff; color:#00d4ff; }
                .step-label { position:absolute; top:46px; font-size:10px; white-space:nowrap; color:#6b7fa3; display:none; }
                .step-dot.active .step-label, .step-dot.done .step-label { display:block; color:#00d4ff; }
                .step-indicators { padding-bottom:20px; }
                .auth-error { background:rgba(255,60,60,0.1); border:1px solid rgba(255,60,60,0.3); color:#ff6b6b; border-radius:10px; padding:10px 14px; font-size:13px; margin-bottom:16px; }
                .step-content { min-height:200px; }
                .form-fields { display:flex; flex-direction:column; gap:16px; }
                .form-group { display:flex; flex-direction:column; gap:6px; }
                .form-group label { font-size:13px; font-weight:600; color:#8fa3c7; }
                .form-group input, .form-group .form-select { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:11px 14px; color:#fff; font-size:14px; outline:none; transition:border-color .2s; }
                .form-group input:focus, .form-group .form-select:focus { border-color:rgba(0,212,255,0.4); }
                .form-group input::placeholder { color:#3d5070; }
                .form-hint { font-size:11px; color:#3d5070; }
                .optional { color:#3d5070; font-weight:400; font-size:11px; }
                .step-description { color:#8fa3c7; font-size:13px; margin:0 0 16px; }
                .region-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
                .region-btn { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:12px; color:#8fa3c7; font-size:14px; cursor:pointer; transition:all .2s; text-align:center; }
                .region-btn:hover { border-color:rgba(0,212,255,0.3); color:#fff; }
                .region-btn.selected { background:rgba(0,212,255,0.1); border-color:#00d4ff; color:#00d4ff; font-weight:700; }
                .checkbox-label { display:flex; align-items:flex-start; gap:10px; cursor:pointer; color:#8fa3c7; font-size:13px; }
                .checkbox-label input[type=checkbox] { width:16px; height:16px; flex-shrink:0; margin-top:2px; accent-color:#00d4ff; }
                .step-nav { display:flex; align-items:center; gap:12px; margin-top:28px; }
                .btn-primary { background:linear-gradient(135deg,#00d4ff,#0077cc); color:#fff; border:none; border-radius:10px; padding:12px 24px; font-size:14px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:8px; transition:opacity .2s; }
                .btn-primary:hover:not(:disabled) { opacity:.9; }
                .btn-primary:disabled { opacity:.5; cursor:not-allowed; }
                .btn-ghost { background:transparent; border:1px solid rgba(255,255,255,0.1); color:#8fa3c7; border-radius:10px; padding:12px 18px; font-size:14px; cursor:pointer; transition:all .2s; }
                .btn-ghost:hover { border-color:rgba(255,255,255,0.2); color:#fff; }
                .btn-spinner { width:16px; height:16px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite; }
                @keyframes spin { to { transform:rotate(360deg); } }
                .auth-footer { text-align:center; margin-top:20px; font-size:13px; color:#6b7fa3; }
                .auth-link { color:#00d4ff; text-decoration:none; font-weight:600; }
            `}</style>
        </div>
    );
}
