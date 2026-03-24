import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../../store/useAuthStore';

/**
 * ⚡ UI LAYER — TOP NAVIGATION (GLOBAL SHELL)
 * =============================================================================
 * Responsibility: Platform-wide navigation, auth state awareness, and 
 * white-label branding injection via CSS custom properties.
 * =============================================================================
 */

const TopNav = () => {
    const { user, isAuthenticated, logout } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

    // Track scroll for background state transitions
    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Close all menus on navigation change
    useEffect(() => {
        setIsMobileMenuOpen(false);
        setIsUserMenuOpen(false);
    }, [location.pathname]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);

    // Nav Links shared between desktop and mobile to stay DRY
    const navItems = [
        { label: 'HOME', path: '/' },
        { label: 'MY ORGS', path: '/orgs', authRequired: true },
        { label: 'HISTORY', path: '/history' },
        { label: 'ADMIN', path: '/admin', adminOnly: true }
    ].filter(item => {
        if (item.authRequired && !isAuthenticated) return false;
        if (item.adminOnly && user?.role !== 'platform_admin') return false;
        return true;
    });

    return (
        <nav className={`top-nav ${isScrolled ? 'scrolled' : ''}`}>
            <div className="nav-container">
                {/* ── Left Side: Brand ── */}
                <div className="nav-left">
                    <button className="mobile-toggle" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            {isMobileMenuOpen ? <path d="M18 6L6 18M6 6l12 12"/> : <path d="M4 6h16M4 12h16M4 18h16"/>}
                        </svg>
                    </button>
                    <Link to="/" className="nav-logo">
                        <span className="logo-accent">VETO</span>.GG
                    </Link>
                </div>

                {/* ── Center: Desktop Links ── */}
                <div className="nav-center desktop-only">
                    {navItems.map(item => (
                        <Link 
                            key={item.path} 
                            to={item.path} 
                            className={`nav-link ${isActive(item.path) ? 'active' : ''}`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>

                {/* ── Right Side: User ── */}
                <div className="nav-right">
                    {isAuthenticated ? (
                        <div className="user-profile-anchor">
                            <div className="user-trigger" onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}>
                                <span className="username desktop-only">{user?.username}</span>
                                <div className="avatar-circle" style={{ background: `linear-gradient(135deg, var(--brand-primary, #00d4ff), #0055ff)` }}>
                                    {user?.username?.charAt(0).toUpperCase()}
                                </div>
                            </div>

                            <AnimatePresence>
                                {isUserMenuOpen && (
                                    <motion.div 
                                        className="dropdown-panel"
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                    >
                                        <div className="dropdown-header">
                                            <div className="header-name">{user?.username}</div>
                                            <div className="header-email">{user?.email}</div>
                                        </div>
                                        <Link to="/profile" className="dropdown-link">Your Profile</Link>
                                        <Link to="/orgs/create" className="dropdown-link">Create Organization</Link>
                                        <div className="dropdown-divider" />
                                        <button onClick={handleLogout} className="dropdown-link logout">Sign Out</button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ) : (
                        <div className="auth-actions">
                            <Link to="/login" className="login-text">SIGN IN</Link>
                            <Link to="/register" className="register-button">REGISTER</Link>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Mobile Sidebar Drawer ── */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <>
                        <motion.div 
                            className="mobile-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileMenuOpen(false)}
                        />
                        <motion.aside 
                            className="mobile-drawer"
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        >
                            <div className="drawer-header">
                                <Link to="/" className="nav-logo" onClick={() => setIsMobileMenuOpen(false)}>
                                    <span className="logo-accent">VETO</span>.GG
                                </Link>
                            </div>
                            <div className="drawer-links">
                                {navItems.map(item => (
                                    <Link 
                                        key={item.path} 
                                        to={item.path} 
                                        className={`drawer-link ${isActive(item.path) ? 'active' : ''}`}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        {item.label}
                                    </Link>
                                ))}
                            </div>
                            {!isAuthenticated && (
                                <div className="drawer-footer">
                                    <Link to="/login" className="footer-auth-btn">Sign In</Link>
                                    <Link to="/register" className="footer-auth-btn primary">Register Now</Link>
                                </div>
                            )}
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            <style>{`
                .top-nav {
                    position: fixed;
                    top: 0; left: 0; width: 100%;
                    height: 56px; z-index: 1000;
                    background: rgba(10, 15, 30, 0.4);
                    backdrop-filter: blur(12px);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    transition: all 0.3s ease;
                }
                .top-nav.scrolled {
                    background: rgba(10, 15, 30, 0.95);
                    border-bottom-color: rgba(0, 212, 255, 0.2);
                    box-shadow: 0 4px 30px rgba(0,0,0,0.5);
                }
                .nav-container {
                    max-width: 1400px; margin: 0 auto; height: 100%;
                    padding: 0 24px; display: flex; align-items: center; justify-content: space-between;
                }
                .nav-left, .nav-right { display: flex; align-items: center; gap: 16px; }
                .nav-logo {
                    font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 20px;
                    text-decoration: none; color: #fff; letter-spacing: 0.1em;
                }
                .logo-accent { color: var(--brand-primary, #00d4ff); }
                
                .nav-center { display: flex; gap: 32px; }
                .nav-link {
                    font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 13px;
                    text-decoration: none; color: rgba(255, 255, 255, 0.6); letter-spacing: 0.05em;
                    transition: all 0.2s ease; position: relative;
                }
                .nav-link:hover { color: #fff; }
                .nav-link.active { color: var(--brand-primary, #00d4ff); }
                .nav-link.active::after {
                    content: ''; position: absolute; bottom: -18px; left: 0; width: 100%;
                    height: 2px; background: var(--brand-primary, #00d4ff);
                }

                .auth-actions { display: flex; align-items: center; gap: 20px; }
                .login-text { 
                    font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 13px;
                    color: #fff; text-decoration: none; opacity: 0.8; transition: 0.2s;
                }
                .login-text:hover { opacity: 1; }
                .register-button {
                    font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 13px;
                    background: var(--brand-primary, #00d4ff); color: #000; padding: 7px 16px;
                    border-radius: 4px; text-decoration: none; transition: 0.2s;
                }
                .register-button:hover { box-shadow: 0 0 15px var(--brand-primary, #00d4ff); transform: translateY(-1px); }

                .avatar-circle {
                    width: 32px; height: 32px; border-radius: 50%; display: flex;
                    align-items: center; justify-content: center; color: #fff; font-weight: 800; cursor: pointer;
                }
                .username { font-weight: 600; font-size: 14px; cursor: pointer; }
                .user-trigger { display: flex; align-items: center; gap: 10px; }

                /* Dropdown Panel */
                .user-profile-anchor { position: relative; }
                .dropdown-panel {
                    position: absolute; top: 100%; right: 0; margin-top: 12px;
                    width: 220px; background: rgba(15, 20, 35, 0.98); backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px;
                    padding: 8px; box-shadow: 0 15px 40px rgba(0,0,0,0.6);
                }
                .dropdown-header { padding: 8px 12px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 8px; }
                .header-name { font-weight: 700; font-size: 14px; }
                .header-email { font-size: 11px; opacity: 0.5; }
                .dropdown-link {
                    display: block; width: 100%; padding: 10px 12px; font-weight: 600; font-size: 13px;
                    color: rgba(255, 255, 255, 0.8); text-decoration: none; border-radius: 4px; transition: 0.2s;
                }
                .dropdown-link:hover { background: rgba(255,255,255,0.05); color: #fff; }
                .dropdown-link.logout { color: #ff4444; }
                .dropdown-link.logout:hover { background: rgba(255,68,68,0.1); }
                .dropdown-divider { height: 1px; background: rgba(255,255,255,0.05); margin: 4px 0; }

                /* Mobile Toggle */
                .mobile-toggle { 
                    display: none; background: none; border: none; color: #fff; cursor: pointer; padding: 4px;
                }

                /* Mobile Sidebar */
                .mobile-drawer {
                    position: fixed; top: 0; left: 0; width: 280px; height: 100vh;
                    background: #0a0f1e; z-index: 1001; padding: 24px; box-shadow: 10px 0 30px rgba(0,0,0,0.5);
                }
                .mobile-backdrop {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000;
                }
                .drawer-header { margin-bottom: 40px; }
                .drawer-links { display: flex; flex-direction: column; gap: 8px; }
                .drawer-link {
                    padding: 14px 16px; font-weight: 700; font-size: 16px; text-decoration: none;
                    color: rgba(255,255,255,0.6); border-radius: 8px; transition: 0.2s;
                }
                .drawer-link.active { background: rgba(0,212,255,0.1); color: var(--brand-primary, #00d4ff); }
                .drawer-footer { margin-top: auto; display: flex; flex-direction: column; gap: 12px; position: absolute; bottom: 24px; width: calc(100% - 48px); }
                .footer-auth-btn {
                    padding: 12px; text-align: center; font-weight: 700; border-radius: 8px; text-decoration: none; border: 1px solid rgba(255,255,255,0.1); color: #fff;
                }
                .footer-auth-btn.primary { background: var(--brand-primary, #00d4ff); color: #000; border: none; }

                @media (max-width: 900px) {
                    .desktop-only { display: none; }
                    .mobile-toggle { display: block; }
                }
            `}</style>
        </nav>
    );
};

export default TopNav;
