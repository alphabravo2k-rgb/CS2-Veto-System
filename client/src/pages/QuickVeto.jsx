import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AnimatedBackground, ShieldIcon, ActivityIcon, CheckIcon } from './SharedUI';
import { supabase } from '../utils/supabase.js';
import useAuthStore from '../store/useAuthStore';

export default function QuickVeto() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [teamA, setTeamA] = useState('');
    const [teamB, setTeamB] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleQuickStart = async () => {
        if (!teamA || !teamB) { setError('BOTH TEAM NAMES REQUIRED'); return; }
        setLoading(true);
        try {
            // Create a match under a 'Global' context (null tournament/org)
            const { data, error: matchError } = await supabase.functions.invoke('create-match', {
                body: {
                    teamA: teamA.trim(),
                    teamB: teamB.trim(),
                    format: 'bo1',
                    isQuickVeto: true,
                    watermark: true // All free vetoes are watermarked
                }
            });

            if (matchError) throw matchError;
            navigate(`/veto/${data.matchId}?key=${data.keys.admin}`);
        } catch (e) {
            setError(e.message || 'FAILED TO INITIALIZE VETO TERMINAL');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#050a14', color: '#fff', padding: '60px 20px', fontFamily: "'Outfit', sans-serif" }}>
            <AnimatedBackground />
            
            <div style={{ maxWidth: '550px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
                <header style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                        <ActivityIcon size={60} color="#00d4ff" />
                    </motion.div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '4px', margin: '20px 0 10px' }}>QUICK VETO</h1>
                    <p style={{ opacity: 0.5, letterSpacing: '2px', fontWeight: 900, fontSize: '10px' }}>SECURE • FAST • FREE</p>
                </header>

                <div className="glass-panel" style={{ padding: '40px', background: 'rgba(0,0,0,0.3)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'grid', gap: '24px', marginBottom: '32px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '2px', opacity: 0.5 }}>IDENTIFIER ALPHA</label>
                            <input 
                                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '12px', color: '#fff', outline: 'none', fontWeight: 700 }}
                                value={teamA} onChange={e => setTeamA(e.target.value)} placeholder="TEAM NAME"
                            />
                        </div>
                        <div style={{ textAlign: 'center', fontSize: '12px', fontWeight: 900, opacity: 0.2 }}>VS</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '2px', opacity: 0.5 }}>IDENTIFIER BRAVO</label>
                            <input 
                                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '12px', color: '#fff', outline: 'none', fontWeight: 700 }}
                                value={teamB} onChange={e => setTeamB(e.target.value)} placeholder="TEAM NAME"
                            />
                        </div>
                    </div>

                    {error && <div style={{ color: '#ff4b2b', fontSize: '10px', fontWeight: 900, textAlign: 'center', marginBottom: '20px', letterSpacing: '1px' }}>{error}</div>}

                    <button 
                        className="premium-button" 
                        style={{ width: '100%', padding: '18px', fontSize: '14px' }}
                        onClick={handleQuickStart}
                        disabled={loading}
                    >
                        {loading ? 'INITIALIZING...' : 'LAUNCH FREE SESSION'}
                    </button>
                    
                    <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '10px', opacity: 0.5, letterSpacing: '1px' }}>
                        * Free sessions include VETO.GG watermarking. <br/>
                        For custom branding, register an organization.
                    </div>
                </div>

                <div style={{ marginTop: '40px', textAlign: 'center' }}>
                    <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontWeight: 900, letterSpacing: '2px', textDecoration: 'underline' }}>
                        BACK TO TERMINAL
                    </button>
                </div>
            </div>
        </div>
    );
}
