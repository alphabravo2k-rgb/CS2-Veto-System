import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatedBackground, RefreshIcon, TrashIcon, UndoIcon } from '../components/SharedUI';

const SOCKET_URL = window.location.hostname === "localhost" ? "http://localhost:3001" : "https://cs2-veto-server-gh3n.onrender.com";

export default function GlobalAdmin() {
    const navigate = useNavigate();
    const [adminSecret, setAdminSecret] = useState(sessionStorage.getItem('adminSecret') || '');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [historyData, setHistoryData] = useState([]);
    const [mapPool, setMapPool] = useState([]);
    
    // Auth & Fetch
    useEffect(() => {
        if (!adminSecret) return;
        fetch(`${SOCKET_URL}/api/admin/history`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret: adminSecret }) })
            .then(r => r.json()).then(d => {
                if (!d.error) {
                    setHistoryData(d);
                    setIsAuthenticated(true);
                    sessionStorage.setItem('adminSecret', adminSecret);
                }
            });
    }, [adminSecret]);

    const deleteMatch = (id) => { 
        if (!window.confirm("DELETE?")) return; 
        fetch(`${SOCKET_URL}/api/admin/delete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, secret: adminSecret }) })
        .then(res => res.json()).then(data => { 
            if (data.success) setHistoryData(prev => prev.filter(m => m.id !== id));
        }); 
    };

    if (!isAuthenticated) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: "'Rajdhani', sans-serif" }}>
                <AnimatedBackground />
                <div style={{ background: 'rgba(15, 18, 25, 0.8)', padding: '40px', borderRadius: '15px', border: '1px solid #333', textAlign: 'center' }}>
                    <h3 style={{ color: '#fff', marginBottom: '20px' }}>SYSTEM AUTHENTICATION</h3>
                    <input type="password" value={adminSecret} onChange={e => setAdminSecret(e.target.value)} placeholder="ENTER KEY" 
                        style={{ width: '100%', padding: '10px', background: '#000', border: '1px solid #444', color: '#00d4ff', textAlign: 'center', fontSize: '1.2rem', outline: 'none' }} 
                    />
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', padding: '40px', fontFamily: "'Rajdhani', sans-serif", color: '#fff' }}>
            <AnimatedBackground />
            <button onClick={() => navigate('/')} style={{ background: 'transparent', border: '1px solid #444', color: '#fff', padding: '5px 15px', borderRadius: '5px', cursor: 'pointer', marginBottom: '20px' }}>← EXIT TO PORTAL</button>
            <h1 style={{ color: '#ff4444', borderBottom: '2px solid #333', paddingBottom: '10px' }}>GLOBAL ADMINISTRATION</h1>

            <div style={{ background: 'rgba(0,0,0,0.8)', padding: '20px', borderRadius: '10px', border: '1px solid #333', marginTop: '20px' }}>
                <h3 style={{ color: '#00d4ff', marginBottom: '15px' }}>ACTIVE TOURNAMENT MATCHES</h3>
                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    {historyData.map((match, i) => (
                        <div key={i} style={{ background: '#161b22', marginBottom: '10px', padding: '15px', borderRadius: '5px', borderLeft: match.finished ? '4px solid #333' : '4px solid #00ff00', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: match.finished ? '#888' : '#fff' }}>{match.teamA} vs {match.teamB}</div>
                                <div style={{ fontSize: '0.8rem', color: '#666' }}>ID: {match.id} | Tourney: {match.tournament_id} | {new Date(match.date).toLocaleString()}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => deleteMatch(match.id)} style={{ background: 'transparent', color: '#ff4444', border: '1px solid #ff4444', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer' }}><TrashIcon /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
