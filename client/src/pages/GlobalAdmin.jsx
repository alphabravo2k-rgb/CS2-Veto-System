import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatedBackground, RefreshIcon, TrashIcon, UndoIcon, CheckIcon } from '../components/SharedUI';

// 🛡️ SECURITY FIX: Dynamic URL Resolution
const API_URL = import.meta.env.VITE_SOCKET_URL || (window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin);

export default function GlobalAdmin() {
    const navigate = useNavigate();
    
    // Auth State
    const [adminSecret, setAdminSecret] = useState(sessionStorage.getItem('adminSecret') || '');
    const [authInput, setAuthInput] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authError, setAuthError] = useState(null);

    // Data State
    const [historyData, setHistoryData] = useState([]);
    const [mapPool, setMapPool] = useState([]);
    const [webhookUrl, setWebhookUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [notification, setNotification] = useState(null);

    // 🛡️ LOGIC FIX: Initial Auth Check on Mount, NOT on every keystroke
    useEffect(() => {
        if (adminSecret) {
            verifyAndLoadData(adminSecret);
        }
    }, [adminSecret]);

    const showToast = (msg) => {
        setNotification(msg);
        setTimeout(() => setNotification(null), 3000);
    };

    const verifyAndLoadData = async (secretToUse) => {
        setIsLoading(true);
        setAuthError(null);
        try {
            // Fetch History
            const histRes = await fetch(`${API_URL}/api/admin/history`, { 
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret: secretToUse }) 
            });
            const histData = await histRes.json();
            
            if (histData.error) {
                setAuthError("INVALID CREDENTIALS");
                sessionStorage.removeItem('adminSecret');
                setIsAuthenticated(false);
                setIsLoading(false);
                return;
            }

            // If we get here, auth succeeded
            setHistoryData(histData);
            setAdminSecret(secretToUse);
            sessionStorage.setItem('adminSecret', secretToUse);
            setIsAuthenticated(true);

            // 🛡️ FEATURE RESTORE: Fetch Map Pool
            const mapRes = await fetch(`${API_URL}/api/admin/maps/get`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret: secretToUse })
            });
            const mapData = await mapRes.json();
            if (!mapData.error) setMapPool(mapData);

            // 🛡️ FEATURE RESTORE: Fetch Webhook
            const webRes = await fetch(`${API_URL}/api/admin/webhook/get`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret: secretToUse })
            });
            const webData = await webRes.json();
            if (!webData.error) setWebhookUrl(webData.webhookUrl || '');

        } catch (e) {
            setAuthError("SERVER UNREACHABLE");
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoginSubmit = (e) => {
        e.preventDefault();
        if (!authInput.trim()) return;
        verifyAndLoadData(authInput);
    };

    // --- ACTIONS ---

    const deleteMatch = async (id) => { 
        if (!window.confirm("Permanently delete this match log?")) return; 
        try {
            const res = await fetch(`${API_URL}/api/admin/delete`, { 
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, secret: adminSecret }) 
            });
            const data = await res.json();
            if (data.success) {
                setHistoryData(prev => prev.filter(m => m.id !== id));
                showToast("MATCH DELETED");
            }
        } catch (e) { alert("Failed to delete match"); }
    };

    const triggerSystemReset = async () => {
        if (!window.confirm("⚠️ DANGER ⚠️\nThis will instantly delete ALL active and past matches across ALL tournaments.\n\nAre you sure?")) return;
        if (!window.confirm("Final Warning: This cannot be undone.")) return;

        try {
            const res = await fetch(`${API_URL}/api/admin/reset`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret: adminSecret })
            });
            const data = await res.json();
            if (data.success) {
                setHistoryData([]);
                showToast("SYSTEM PURGED");
            }
        } catch (e) { alert("Failed to reset system"); }
    };

    const updateMapPool = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/maps/update`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret: adminSecret, maps: mapPool })
            });
            const data = await res.json();
            if (data.success) showToast("MAP POOL SAVED");
        } catch (e) { alert("Failed to save maps"); }
    };

    const addMapToPool = () => {
        const mapName = prompt("Enter new map name:");
        if (mapName && mapName.trim()) {
            setMapPool([...mapPool, { name: mapName.trim() }]);
        }
    };

    const removeMapFromPool = (index) => {
        const newPool = [...mapPool];
        newPool.splice(index, 1);
        setMapPool(newPool);
    };

    const saveWebhook = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/webhook/set`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret: adminSecret, webhookUrl })
            });
            const data = await res.json();
            if (data.error) alert(data.error);
            else showToast("WEBHOOK SAVED");
        } catch (e) { alert("Failed to save webhook"); }
    };

    const testWebhook = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/webhook/test`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret: adminSecret, webhookUrl })
            });
            const data = await res.json();
            if (data.error) alert(data.error);
            else showToast("TEST PING SENT");
        } catch (e) { alert("Failed to test webhook"); }
    };


    // --- RENDERERS ---

    if (!isAuthenticated) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: "'Rajdhani', sans-serif" }}>
                <AnimatedBackground />
                <form onSubmit={handleLoginSubmit} style={{ background: 'rgba(15, 18, 25, 0.9)', padding: '40px', borderRadius: '15px', border: '1px solid #333', textAlign: 'center', width: '300px' }}>
                    <h3 style={{ color: '#fff', marginBottom: '20px', letterSpacing: '2px' }}>SYSTEM ACCESS</h3>
                    <input 
                        type="password" 
                        value={authInput} 
                        onChange={e => { setAuthInput(e.target.value); setAuthError(null); }} 
                        placeholder="ENTER MASTER KEY" 
                        style={{ width: '100%', padding: '15px', background: '#000', border: authError ? '1px solid #ff4444' : '1px solid #444', color: '#00d4ff', textAlign: 'center', fontSize: '1.2rem', outline: 'none', marginBottom: '15px', boxSizing: 'border-box' }} 
                    />
                    <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '10px', background: '#00d4ff', color: '#000', border: 'none', fontWeight: 'bold', cursor: isLoading ? 'wait' : 'pointer' }}>
                        {isLoading ? 'VERIFYING...' : 'AUTHENTICATE'}
                    </button>
                    {authError && <div style={{ color: '#ff4444', marginTop: '15px', fontSize: '0.9rem', fontWeight: 'bold' }}>{authError}</div>}
                </form>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', padding: '40px', fontFamily: "'Rajdhani', sans-serif", color: '#fff' }}>
            <AnimatedBackground />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #333', paddingBottom: '20px', marginBottom: '30px' }}>
                <div>
                    <button onClick={() => navigate('/')} style={{ background: 'transparent', border: '1px solid #444', color: '#fff', padding: '5px 15px', borderRadius: '5px', cursor: 'pointer', marginBottom: '10px' }}>← EXIT TO PORTAL</button>
                    <h1 style={{ color: '#ff4444', margin: 0 }}>GLOBAL ADMINISTRATION</h1>
                </div>
                <button onClick={triggerSystemReset} style={{ background: 'rgba(255,0,0,0.1)', border: '1px solid #ff4444', color: '#ff4444', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                    ☢️ NUKE ALL DATA
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' }}>
                
                {/* HISTORY PANEL */}
                <div style={{ background: 'rgba(0,0,0,0.8)', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ color: '#00d4ff', margin: 0 }}>MATCH REGISTRY</h3>
                        <button onClick={() => verifyAndLoadData(adminSecret)} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer' }}><RefreshIcon /></button>
                    </div>
                    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        {historyData.length === 0 ? <div style={{color: '#666', textAlign: 'center', padding: '20px'}}>No records found.</div> : null}
                        {historyData.map((match) => (
                            // 🛡️ BUG FIX: Keyed by DB ID, not array index
                            <div key={match.id} style={{ background: '#161b22', marginBottom: '10px', padding: '15px', borderRadius: '5px', borderLeft: match.finished ? '4px solid #333' : '4px solid #00ff00', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: match.finished ? '#888' : '#fff' }}>{match.teamA} vs {match.teamB}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#666' }}>ID: {match.id} | Tourney: {match.tournament_id} | {new Date(match.date).toLocaleString()}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {!match.finished && <button onClick={() => window.open(`/${match.tournament_id === 'default' ? 'legacy' : match.tournament_id}/veto/${match.id}`, '_blank')} style={{ background: 'transparent', color: '#00d4ff', border: '1px solid #00d4ff', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer' }}>JOIN</button>}
                                    <button onClick={() => deleteMatch(match.id)} style={{ background: 'transparent', color: '#ff4444', border: '1px solid #ff4444', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer' }}><TrashIcon /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CONFIGURATION PANELS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    
                    {/* WEBHOOKS */}
                    <div style={{ background: 'rgba(0,0,0,0.8)', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
                        <h3 style={{ color: '#00d4ff', marginBottom: '15px', margin: 0 }}>GLOBAL WEBHOOK</h3>
                        <p style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '15px' }}>Sends live match updates to a central Discord channel.</p>
                        <input 
                            value={webhookUrl} 
                            onChange={e => setWebhookUrl(e.target.value)} 
                            placeholder="https://discord.com/api/webhooks/..." 
                            style={{ width: '100%', padding: '10px', background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', marginBottom: '10px', boxSizing: 'border-box' }} 
                        />
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={saveWebhook} style={{ background: '#00d4ff', color: '#000', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>SAVE LINK</button>
                            <button onClick={testWebhook} style={{ background: 'transparent', color: '#fff', border: '1px solid #555', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' }}>TEST PING</button>
                        </div>
                    </div>

                    {/* MAP POOL */}
                    <div style={{ background: 'rgba(0,0,0,0.8)', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ color: '#00d4ff', margin: 0 }}>ACTIVE MAP POOL</h3>
                            <button onClick={updateMapPool} style={{ background: '#00ff00', color: '#000', border: 'none', padding: '5px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>SAVE POOL</button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '15px' }}>
                            {mapPool.map((map, index) => (
                                <div key={index} style={{ background: '#111', border: '1px solid #444', padding: '5px 10px', borderRadius: '5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {map.name}
                                    <button onClick={() => removeMapFromPool(index)} style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', padding: 0 }}>&times;</button>
                                </div>
                            ))}
                        </div>
                        <button onClick={addMapToPool} style={{ background: 'transparent', border: '1px dashed #666', color: '#aaa', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', width: '100%' }}>+ ADD CUSTOM MAP</button>
                    </div>
                </div>

            </div>

            {notification && (
                <div style={{ position: 'fixed', bottom: '20px', right: '20px', background: '#00ff00', color: '#000', padding: '15px 30px', borderRadius: '5px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', zIndex: 5000, boxShadow: '0 5px 15px rgba(0,255,0,0.3)', animation: 'slideIn 0.3s ease-out' }}>
                    <CheckIcon /> {notification}
                </div>
            )}
        </div>
    );
}
