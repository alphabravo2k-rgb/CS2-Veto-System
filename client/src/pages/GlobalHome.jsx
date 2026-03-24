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
            
            <div style={{ background: 'rgba(10, 15, 30, 0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '3rem', width: '100%', maxWidth: view === 'history' ? '800px' : '500px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', zIndex: 10 }}>
                {view === 'history' ? (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', justifyContent: 'center' }}>
                            <ActivityIcon size={32} color="#00d4ff" />
                            <h2 style={{ margin: 0, fontSize: '2rem', letterSpacing: '1px' }}>GLOBAL HISTORY</h2>
                        </div>
                        {loading ? (
                            <p style={{ opacity: 0.5 }}>SYNCHRONIZING RECORDS...</p>
                        ) : (
                            <div style={{ textAlign: 'left', maxHeight: '500px', overflowY: 'auto' }}>
                                {history.map(m => (
                                    <div key={m.id} style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold' }}>{m.teamA} vs {m.teamB}</div>
                                            <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>{new Date(m.date).toLocaleString()}</div>
                                        </div>
                                        <button onClick={() => navigate(`/${m.tournament_id}/veto/${m.id}`)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>VIEW</button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button onClick={() => navigate('/')} style={{ marginTop: '2rem', background: 'transparent', border: 'none', color: '#00d4ff', cursor: 'pointer' }}>← RETURN HOME</button>
                    </>
                ) : (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '1.5rem' }}>
                            <img src={LOGO_URL} alt="Logo" style={{ width: '80px', height: '80px', borderRadius: '50%', border: '2px solid #00d4ff', boxShadow: '0 0 30px rgba(0, 212, 255, 0.3)' }} />
                            <h1 style={{ fontSize: '3rem', fontWeight: '900', margin: '0', background: 'linear-gradient(to right, #fff, #00d4ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '2px' }}>{PLATFORM_NAME}</h1>
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '4px', marginBottom: '3rem', fontSize: '1rem', fontWeight: '600' }}>ESPORTS VETO INFRASTRUCTURE</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <button onClick={() => navigate('/history')} style={{ background: '#00d4ff', border: 'none', color: '#000', padding: '1.2rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 0 20px rgba(0, 212, 255, 0.2)', transition: 'transform 0.2s' }}>EXPLORE MATCH HISTORY</button>
                            <button onClick={() => navigate('/orgs')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '1.1rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>MANAGE ORGANIZATIONS</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
