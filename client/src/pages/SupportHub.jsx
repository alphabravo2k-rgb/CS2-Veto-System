import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedBackground, ShieldIcon, ActivityIcon, GlobeIcon, HomeIcon } from '../components/SharedUI';
import { useNavigate, useLocation } from 'react-router-dom';

const FAQ_DATA = [
    { q: "How do I start a veto?", a: "Navigate to your Organization Dashboard, select a Tournament, and click 'Create New Match'. If you're an individual, click 'Quick Veto' on the home page." },
    { q: "Can I use custom maps?", a: "Yes. Tournament owners can select 'Custom Mode' and define their own map pool and ban/pick sequence." },
    { q: "Where is my match link?", a: "Match links (Admin, Team A, Team B) are generated immediately after match creation. You can also find them in your Tournament History." },
    { q: "What is a 'Veto Agent'?", a: "An automated system that enforces the map selection rules and ensures both teams follow the tournament protocol." },
];

const MANUAL_STEPS = [
    { title: "Registration", body: "Create your cryptographic identity by registering with a valid email. Verify your identity via the secure link sent to your inbox." },
    { title: "Organization Setup", body: "Register your esports organization to unlock custom branding and tournament management capabilities." },
    { title: "Veto Execution", body: "In the veto room, follow the real-time prompts. Picks and bans are finalized instantly and recorded in the global ledger." },
];

export default function SupportHub() {
    const navigate = useNavigate();
    const location = useLocation();
    const query = new URLSearchParams(location.search);
    const [tab, setTab] = useState(query.get('tab') || 'faq');

    return (
        <div style={{ minHeight: '100vh', background: '#050a14', color: '#fff', padding: '60px 20px', fontFamily: "'Outfit', sans-serif" }}>
            <AnimatedBackground />
            
            <div style={{ maxWidth: '900px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
                <header style={{ textAlign: 'center', marginBottom: '60px' }}>
                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                        <ShieldIcon size={60} color="#00d4ff" />
                    </motion.div>
                    <h1 style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '4px', margin: '20px 0 10px' }}>COMMAND CENTER</h1>
                    <p style={{ opacity: 0.5, letterSpacing: '2px', fontWeight: 900, fontSize: '12px' }}>DOCUMENTATION & SUPPORT PROTOCOLS</p>
                </header>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '40px', justifyContent: 'center' }}>
                    {['faq', 'manual', 'help'].map(t => (
                        <button 
                            key={t}
                            onClick={() => setTab(t)}
                            className={tab === t ? "premium-button" : "glass-panel"}
                            style={{ 
                                padding: '12px 32px', fontSize: '12px', fontWeight: 900, letterSpacing: '2px', cursor: 'pointer',
                                background: tab === t ? 'linear-gradient(135deg, #00d4ff 0%, #0055ff 100%)' : 'rgba(255,255,255,0.05)',
                                color: '#fff', border: 'none', borderRadius: '12px'
                            }}
                        >
                            {t.toUpperCase()}
                        </button>
                    ))}
                </div>

                <div className="glass-panel" style={{ padding: '40px', background: 'rgba(0,0,0,0.3)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <AnimatePresence mode="wait">
                        {tab === 'faq' && (
                            <motion.div key="faq" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                <h2 style={{ color: '#00d4ff', marginBottom: '32px', letterSpacing: '2px' }}>FREQUENTLY ASKED</h2>
                                {FAQ_DATA.map((item, i) => (
                                    <div key={i} style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ fontWeight: 900, color: '#fff', fontSize: '18px', marginBottom: '8px' }}>{item.q}</div>
                                        <div style={{ opacity: 0.6, lineHeight: 1.6 }}>{item.a}</div>
                                    </div>
                                ))}
                            </motion.div>
                        )}

                        {tab === 'manual' && (
                            <motion.div key="manual" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                <h2 style={{ color: '#00d4ff', marginBottom: '32px', letterSpacing: '2px' }}>OPERATIONS MANUAL</h2>
                                {MANUAL_STEPS.map((step, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '32px', marginBottom: '40px' }}>
                                        <div style={{ fontSize: '48px', fontWeight: 900, color: 'rgba(0,212,255,0.2)' }}>0{i+1}</div>
                                        <div>
                                            <div style={{ fontWeight: 900, color: '#fff', fontSize: '20px', marginBottom: '8px', letterSpacing: '1px' }}>{step.title.toUpperCase()}</div>
                                            <div style={{ opacity: 0.6, lineHeight: 1.6 }}>{step.body}</div>
                                        </div>
                                    </div>
                                ))}
                            </motion.div>
                        )}

                        {tab === 'help' && (
                            <motion.div key="help" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} style={{ textAlign: 'center', padding: '40px 0' }}>
                                <GlobeIcon size={80} color="#00d4ff" />
                                <h2 style={{ color: '#fff', margin: '24px 0 16px' }}>SECURE TRANSMISSION</h2>
                                <p style={{ opacity: 0.6, marginBottom: '32px' }}>Need direct intervention? Open a priority ticket with our engineering team.</p>
                                <button className="premium-button" style={{ padding: '16px 48px' }} onClick={() => window.open('mailto:support@veto.gg')}>
                                    SEND SIGNAL (EMAIL)
                                </button>
                                <div style={{ marginTop: '40px', opacity: 0.4, fontSize: '11px', fontWeight: 900 }}>AVERAGE RESPONSE TIME: &lt; 2 HOURS</div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div style={{ marginTop: '40px', textAlign: 'center' }}>
                    <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontWeight: 900, letterSpacing: '2px', display: 'flex', alignItems: 'center', gap: '10px', margin: '0 auto' }}>
                        <HomeIcon size={14} /> BACK TO TERMINAL
                    </button>
                </div>
            </div>
        </div>
    );
}
