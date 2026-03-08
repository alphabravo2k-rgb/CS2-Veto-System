import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../store/useAuthStore';

export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuthStore();

    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login({ email: form.email.trim(), password: form.password });
            navigate('/');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-bg-grid" />
            <motion.div
                className="auth-card"
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
            >
                <div className="auth-logo">
                    <span className="auth-logo-icon">⚡</span>
                    <h1>VetoPortal</h1>
                </div>
                <h2 className="auth-title">Sign In</h2>
                <p className="auth-subtitle">Access your tournament dashboard</p>

                {error && (
                    <motion.div
                        className="auth-error"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        {error}
                    </motion.div>
                )}

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="you@example.com"
                            value={form.email}
                            onChange={handleChange}
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            placeholder="••••••••"
                            value={form.password}
                            onChange={handleChange}
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn-primary btn-full"
                        disabled={loading}
                        id="login-submit"
                    >
                        {loading ? <span className="btn-spinner" /> : 'Sign In'}
                    </button>
                </form>

                <p className="auth-footer">
                    No account?{' '}
                    <Link to="/register" className="auth-link">Create one</Link>
                </p>
            </motion.div>

            <style>{`
                .auth-page {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #050a14;
                    position: relative;
                    overflow: hidden;
                    font-family: 'Inter', sans-serif;
                }
                .auth-bg-grid {
                    position: absolute; inset: 0;
                    background-image:
                        linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px);
                    background-size: 40px 40px;
                }
                .auth-card {
                    position: relative; z-index: 1;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(0,212,255,0.15);
                    border-radius: 20px;
                    padding: 48px 44px;
                    width: 100%; max-width: 420px;
                    backdrop-filter: blur(20px);
                    box-shadow: 0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,212,255,0.06);
                }
                .auth-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
                .auth-logo-icon { font-size: 24px; }
                .auth-logo h1 { font-size: 20px; font-weight: 800; color: #00d4ff; letter-spacing: -0.5px; margin: 0; }
                .auth-title { font-size: 26px; font-weight: 700; color: #fff; margin: 0 0 6px; }
                .auth-subtitle { color: #6b7fa3; font-size: 14px; margin: 0 0 28px; }
                .auth-error {
                    background: rgba(255,60,60,0.1); border: 1px solid rgba(255,60,60,0.3);
                    color: #ff6b6b; border-radius: 10px; padding: 12px 16px;
                    font-size: 13px; margin-bottom: 20px;
                }
                .auth-form { display: flex; flex-direction: column; gap: 18px; }
                .form-group { display: flex; flex-direction: column; gap: 7px; }
                .form-group label { font-size: 13px; font-weight: 600; color: #8fa3c7; letter-spacing: 0.3px; }
                .form-group input {
                    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 10px; padding: 12px 16px; color: #fff; font-size: 15px;
                    transition: border-color 0.2s;
                    outline: none;
                }
                .form-group input:focus { border-color: rgba(0,212,255,0.4); background: rgba(0,212,255,0.04); }
                .form-group input::placeholder { color: #3d5070; }
                .btn-primary {
                    background: linear-gradient(135deg, #00d4ff, #0077cc);
                    color: #fff; border: none; border-radius: 10px;
                    padding: 13px 24px; font-size: 15px; font-weight: 700;
                    cursor: pointer; transition: opacity 0.2s, transform 0.1s;
                    display: flex; align-items: center; justify-content: center;
                }
                .btn-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
                .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
                .btn-full { width: 100%; }
                .btn-spinner {
                    width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                .auth-footer { text-align: center; margin-top: 20px; font-size: 13px; color: #6b7fa3; }
                .auth-link { color: #00d4ff; text-decoration: none; font-weight: 600; }
                .auth-link:hover { text-decoration: underline; }
            `}</style>
        </div>
    );
}
