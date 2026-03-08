import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatedBackground } from '../components/SharedUI';

export default function NotFound() {
    const navigate = useNavigate();
    
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'Rajdhani', sans-serif", color: 'white' }}>
            <AnimatedBackground />
            <h1 style={{ fontSize: '6rem', color: '#ff4444', textShadow: '0 0 20px rgba(255,0,0,0.5)', margin: 0, fontWeight: '900' }}>404</h1>
            <h2 style={{ letterSpacing: '5px', color: '#aaa', margin: '10px 0 30px 0' }}>SECTOR NOT FOUND</h2>
            <button 
                onClick={() => navigate('/')} 
                style={{ background: 'transparent', border: '1px solid #00d4ff', color: '#00d4ff', padding: '10px 30px', borderRadius: '5px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontWeight: 'bold', fontSize: '1rem' }}
            >
                RETURN TO BASE
            </button>
        </div>
    );
}
