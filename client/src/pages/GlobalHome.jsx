import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatedBackground } from '../components/SharedUI';

const LOGO_URL = "https://i.ibb.co/0yLfyyQt/LOT-LOGO-03.jpg";

export default function GlobalHome() {
    const navigate = useNavigate();

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: "'Rajdhani', sans-serif", color: 'white', padding: '20px', boxSizing: 'border-box', position: 'relative', justifyContent: 'center' }}>
            <AnimatedBackground />
            
            <div style={{ background: 'rgba(15, 18, 25, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '15px', padding: '40px', width: '100%', maxWidth: '500px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', zIndex: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '20px' }}>
                    <img src={LOGO_URL} alt="Logo" style={{ width: '60px', height: '60px', borderRadius: '50%', border: '2px solid #00d4ff', boxShadow: '0 0 15px rgba(0, 212, 255, 0.5)' }} />
                    <h1 style={{ fontSize: '3rem', fontWeight: '900', margin: '0', background: 'linear-gradient(to right, #fff, #00d4ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>LOT GAMING</h1>
                </div>
                <h3 style={{ color: '#aaa', letterSpacing: '4px', marginBottom: '40px', fontSize: '0.9rem' }}>MULTI-TENANT VETO PORTAL</h3>

                <button 
                    onClick={() => navigate('/global/default')}
                    style={{ background: 'rgba(0, 212, 255, 0.1)', border: '1px solid #00d4ff', color: '#00d4ff', padding: '15px 30px', borderRadius: '5px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontWeight: 'bold', fontSize: '1.2rem', width: '100%', marginBottom: '15px', boxShadow: '0 0 15px rgba(0, 212, 255, 0.2)' }}
                >
                    ENTER PUBLIC LOBBY
                </button>

                <button 
                    onClick={() => navigate('/admin')}
                    style={{ background: 'transparent', border: '1px solid #444', color: '#888', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontWeight: 'bold', width: '100%', transition: 'all 0.3s' }}
                >
                    SYSTEM ADMIN
                </button>
            </div>
            
            <div style={{ marginTop: '40px', color: '#444', fontSize: '0.8rem', zIndex: 10 }}>
                LOTGaming System | Multi-Tenant Architecture
            </div>
        </div>
    );
}
