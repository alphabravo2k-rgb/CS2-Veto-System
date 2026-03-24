import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatedBackground, ActivityIcon } from '../components/SharedUI';
import useAuthStore from '../store/useAuthStore';

const LOGO_URL = import.meta.env.VITE_ORG_LOGO_URL || "https://i.ibb.co/0yLfyyQt/LOT-LOGO-03.jpg";
const PLATFORM_NAME = import.meta.env.VITE_PLATFORM_NAME || "VETO.GG";

export default function GlobalHome({ view = 'home' }) {
    const navigate = useNavigate();
    const { authFetch } = useAuthStore();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(view === 'history');

    useEffect(() => {
        if (view === 'history') {
            authFetch('/api/admin/history?limit=50')
                .then(res => res.json())
                .then(data => {
                    setHistory(data.matches || []);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        }
    }, [view]);

    return (
        <div style={{ minHeight: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'Outfit', sans-serif", color: 'white', padding: '2rem', position: 'relative' }}>
            <AnimatedBackground />
            
            <div className="glass-panel fade-enter-active" style={{ padding: '3rem', width: '100%', maxWidth: view === 'history' ? '900px' : '550px', textAlign: 'center', zIndex: 10 }}>
                {view === 'history' ? (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2.5rem', justifyContent: 'center' }}>
                            <ActivityIcon size={40} color="var(--brand-primary)" />
                            <h2 className="neon-text" style={{ margin: 0, fontSize: '2.5rem', letterSpacing: '2px', fontWeight: 900 }}>GLOBAL REGISTRY</h2>
                        </div>
                        {loading ? (
                            <div style={{ padding: '4rem' }}>
                                <div style={{ width: '40px', height: '40px', border: '3px solid var(--brand-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
                                <p style={{ opacity: 0.5, letterSpacing: '2px' }}>DECRYPTING MATCH RECORDS...</p>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'left', maxHeight: '500px', overflowY: 'auto', paddingRight: '10px' }}>
                                {history.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>NO RECENT ENGAGEMENTS FOUND</div>
                                ) : history.map(m => (
                                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', marginBottom: '1rem', transition: 'all 0.2s' }}>
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.5px' }}>{m.teamA} <span style={{color: 'var(--brand-primary)', margin: '0 8px'}}>VS</span> {m.teamB}</div>
                                            <div style={{ fontSize: '0.8rem', opacity: 0.4, marginTop: '4px' }}>{new Date(m.date).toLocaleString()} • {m.id.slice(0,8).toUpperCase()}</div>
                                        </div>
                                        <button className="premium-button" style={{ padding: '8px 16px', fontSize: '0.8rem' }} onClick={() => navigate(`/${m.tournament_id}/veto/${m.id}`)}>
                                            LAUNCH INTEL
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button onClick={() => navigate('/')} style={{ marginTop: '2rem', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontWeight: 600, letterSpacing: '1px' }}>← RETURN TO CORE</button>
                    </>
                ) : (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', marginBottom: '2rem' }}>
                            <img src={LOGO_URL} alt="Logo" style={{ width: '100px', height: '100px', borderRadius: '50%', border: '2px solid var(--brand-primary)', boxShadow: '0 0 40px rgba(0, 212, 255, 0.4)' }} />
                            <div>
                                <h1 className="neon-text" style={{ fontSize: '3.5rem', fontWeight: 900, margin: 0, letterSpacing: '3px', lineHeight: 1 }}>{PLATFORM_NAME}</h1>
                                <div style={{ color: 'var(--brand-primary)', fontSize: '0.8rem', fontWeight: 900, letterSpacing: '5px', marginTop: '8px', opacity: 0.8 }}>PREMIUM VETO ENGINE</div>
                            </div>
                        </div>
                        
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem', marginBottom: '3rem', lineHeight: 1.6 }}>The industry-standard Counter-Strike 2 map veto platform. Engineered for stability, speed, and absolute multi-tenant isolation.</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                            <button className="premium-button" style={{ width: '100%', justifyContent: 'center', padding: '1.5rem', fontSize: '1.2rem' }} onClick={() => navigate('/history')}>
                                EXPLORE GLOBAL HISTORY
                            </button>
                            <button className="glass-panel" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '1.2rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 900, letterSpacing: '2px', transition: 'all 0.2s' }} onClick={() => navigate('/orgs')}>
                                ORGANIZATION DASHBOARD
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
