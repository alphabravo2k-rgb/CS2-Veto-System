import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AnimatedBackground, UploadIcon, ExternalLinkIcon, CheckIcon, HomeIcon } from '../components/SharedUI';
import useVetoStore from '../store/useVetoStore'; // 🛡️ ARCHITECTURE FIX: Importing the global store

const API_URL = import.meta.env.VITE_SOCKET_URL || (window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin);
const LOGO_URL = import.meta.env.VITE_ORG_LOGO_URL || "https://i.ibb.co/0yLfyyQt/LOT-LOGO-03.jpg";

export default function TournamentDashboard() {
    const { orgId, tournamentId } = useParams();
    const navigate = useNavigate();
    
    // 🛡️ ARCHITECTURE FIX: Pulling createMatch and serverError from the Store
    const { createMatch: storeCreateMatch, serverError } = useVetoStore();

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [teamA, setTeamA] = useState('');
    const [teamB, setTeamB] = useState('');
    const [teamALogo, setTeamALogo] = useState('');
    const [teamBLogo, setTeamBLogo] = useState('');
    const [vetoMode, setVetoMode] = useState('vrs');
    const [useTimer, setUseTimer] = useState(false);
    const [timerDuration, setTimerDuration] = useState(60);
    const [useCoinFlip, setUseCoinFlip] = useState(false);
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [inputError, setInputError] = useState(false);
    const [createdLinks, setCreatedLinks] = useState(null);
    const [showNotification, setShowNotification] = useState(false);
    const [historyData, setHistoryData] = useState([]);

    const [availableMaps, setAvailableMaps] = useState([]);
    const [customSelectedMaps, setCustomSelectedMaps] = useState([]);
    const [customSequence, setCustomSequence] = useState([]);
    const [userCustomMap, setUserCustomMap] = useState('');

    const fileInputA = useRef(null);
    const fileInputB = useRef(null);

    const styles = useMemo(() => getStyles(isMobile), [isMobile]);

    const fetchHistory = useCallback(() => {
        fetch(`${API_URL}/api/history?tournamentId=${tournamentId}`)
            .then(r => r.ok ? r.json() : { matches: [] })
            .then(data => {
                if (data.matches) setHistoryData(data.matches);
            }).catch(() => { });
    }, [tournamentId]);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);

        fetch(`${API_URL}/api/maps`).then(r => r.ok ? r.json() : []).then(data => {
            if (data.length > 0) {
                setAvailableMaps(data);
                setCustomSelectedMaps(data.map(m => m.name));
            }
        }).catch(() => { });

        fetchHistory();

        return () => window.removeEventListener('resize', handleResize);
    }, [fetchHistory]);

    const handleLogoUpload = (e, team) => {
        const file = e.target.files[0];
        if (file) {
            // 🛡️ SECURITY FIX: Enforce MIME Validation
            const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            if (!ALLOWED_TYPES.includes(file.type)) return alert("Invalid file type. Only JPG, PNG, WEBP, or GIF.");
            if (file.size > 2000000) return alert("File too large. Max 2MB.");
            
            const reader = new FileReader();
            reader.onloadend = () => {
                if (team === 'A') setTeamALogo(reader.result);
                else setTeamBLogo(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCreateMatchSubmit = (type) => {
        if (!teamA.trim() || !teamB.trim()) { setInputError(true); return; }

        let format = type;
        if (vetoMode === 'faceit') {
            if (type === 'bo1') format = 'faceit_bo1';
            if (type === 'bo3') format = 'faceit_bo3';
            if (type === 'bo5') format = 'faceit_bo5';
        } else if (vetoMode === 'wingman') {
            if (type === 'bo1') format = 'wingman_bo1';
            if (type === 'bo3') format = 'wingman_bo3';
        } else if (vetoMode === 'custom') format = 'custom';

        if (format === 'custom') {
            if (customSelectedMaps.length === 0) return alert("Please select at least one map.");
            if (customSequence.length === 0) return alert("Please define at least one step in the sequence.");
        }

        setIsGenerating(true);
        
        // 🛡️ BUG FIX: Dispatching to the global store, passing a callback to clear the form ONLY on success
        storeCreateMatch({
            orgId, 
            tournamentId, 
            teamA: teamA.trim().slice(0, 50), 
            teamB: teamB.trim().slice(0, 50), 
            teamALogo, 
            teamBLogo, 
            format,
            customMapNames: format === 'custom' ? customSelectedMaps : null,
            customSequence: format === 'custom' ? customSequence : null,
            useTimer, 
            useCoinFlip, 
            timerDuration: useTimer ? parseInt(timerDuration) : 60
        }, (response) => {
            const baseUrl = `${window.location.origin}/${orgId}/${tournamentId}/veto/${response.roomId}`;
            setCreatedLinks({
                admin: `${baseUrl}?key=${response.keys.admin}`,
                teamA: `${baseUrl}?key=${response.keys.A}`,
                teamB: `${baseUrl}?key=${response.keys.B}`
            });
            setIsGenerating(false);
            setTeamA(''); setTeamB(''); setTeamALogo(''); setTeamBLogo(''); setUseCoinFlip(false);
            fetchHistory(); 
        });
    };

    const handleCopyLogs = (text) => { 
        navigator.clipboard.writeText(text).then(() => { 
            setShowNotification(true); setTimeout(() => setShowNotification(false), 3000); 
        }); 
    };

    const toggleMapSelection = (mapName) => {
        if (customSelectedMaps.includes(mapName)) setCustomSelectedMaps(customSelectedMaps.filter(m => m !== mapName));
        else setCustomSelectedMaps([...customSelectedMaps, mapName]);
    };

    const addUserMap = () => {
        if (!userCustomMap.trim()) return;
        // 🛡️ SECURITY FIX: Sliced the custom map input to prevent massive string injection
        const newName = userCustomMap.trim().slice(0, 50);
        setAvailableMaps([...availableMaps, { name: newName }]);
        setCustomSelectedMaps([...customSelectedMaps, newName]);
        setUserCustomMap('');
    };

    const addSequenceStep = (team, action) => setCustomSequence([...customSequence, { t: team, a: action }]);
    const removeSequenceStep = (idx) => { const s = [...customSequence]; s.splice(idx, 1); setCustomSequence(s); };

    return (
        <div style={styles.container}>
            <AnimatedBackground />
            
            {/* 🛡️ UI UX FIX: Inline keyframes for missing animations */}
            <style>
                {`
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    @keyframes fadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
                `}
            </style>

            <button onClick={() => navigate('/')} style={styles.homeBtn}><HomeIcon /> PORTAL</button>
            
            <div style={styles.glassPanel}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '10px' }}>
                    <img src={LOGO_URL} alt="Logo" onError={e => { e.target.style.display = 'none'; }} style={styles.logo} />
                    <h1 style={styles.neonTitle}>{(orgId || '').toUpperCase()}</h1>
                </div>
                <h3 style={{ color: '#aaa', letterSpacing: '4px', marginBottom: '30px', fontSize: isMobile ? '0.8rem' : '1rem' }}>{(tournamentId || '').toUpperCase()} DASHBOARD</h3>

                {serverError && <div style={{ color: '#ff4444', marginBottom: '15px', fontWeight: 'bold' }}>⚠️ {serverError}</div>}

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', gap: '10px', flexWrap: 'wrap' }}>
                    <button onClick={() => setVetoMode('vrs')} style={vetoMode === 'vrs' ? styles.modeBtnActive : styles.modeBtn}>VRS VETO</button>
                    <button onClick={() => setVetoMode('faceit')} style={vetoMode === 'faceit' ? styles.modeBtnActive : styles.modeBtn}>FACEIT STYLE</button>
                    <button onClick={() => setVetoMode('wingman')} style={vetoMode === 'wingman' ? styles.modeBtnActive : styles.modeBtn}>WINGMAN VETO</button>
                    <button onClick={() => setVetoMode('custom')} style={vetoMode === 'custom' ? styles.modeBtnActive : styles.modeBtn}>CUSTOM VETO</button>
                </div>

                <input style={{ ...styles.input, border: inputError && !teamA.trim() ? '2px solid #ff4444' : '1px solid #333' }} value={teamA} maxLength={50} onChange={e => { setTeamA(e.target.value); setInputError(false); }} placeholder="TEAM A NAME (REQUIRED)" />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '15px' }}>
                    <input type="file" ref={fileInputA} style={{ display: 'none' }} accept="image/jpeg, image/png, image/webp, image/gif" onChange={(e) => handleLogoUpload(e, 'A')} />
                    <button onClick={() => fileInputA.current.click()} style={{ ...styles.tinyBtn, padding: '5px 15px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <UploadIcon /> {teamALogo ? "CHANGE LOGO A" : "ATTACH LOGO A"}
                    </button>
                    {teamALogo && <img src={teamALogo} alt="Preview" style={{ width: '30px', height: '30px', objectFit: 'contain', border: '1px solid #333', borderRadius: '3px' }} />}
                </div>

                <input style={{ ...styles.input, border: inputError && !teamB.trim() ? '2px solid #ff4444' : '1px solid #333' }} value={teamB} maxLength={50} onChange={e => { setTeamB(e.target.value); setInputError(false); }} placeholder="TEAM B NAME (REQUIRED)" />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '15px' }}>
                    <input type="file" ref={fileInputB} style={{ display: 'none' }} accept="image/jpeg, image/png, image/webp, image/gif" onChange={(e) => handleLogoUpload(e, 'B')} />
                    <button onClick={() => fileInputB.current.click()} style={{ ...styles.tinyBtn, padding: '5px 15px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <UploadIcon /> {teamBLogo ? "CHANGE LOGO B" : "ATTACH LOGO B"}
                    </button>
                    {teamBLogo && <img src={teamBLogo} alt="Preview" style={{ width: '30px', height: '30px', objectFit: 'contain', border: '1px solid #333', borderRadius: '3px' }} />}
                </div>

                <div style={{ marginTop: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#aaa', fontSize: '0.9rem', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input type="checkbox" checked={useTimer} onChange={e => setUseTimer(e.target.checked)} style={{ transform: 'scale(1.2)' }} />
                        <span>Enable Auto-Ban Timer</span>
                    </div>
                    {useTimer && (
                        <div style={{ display: 'flex', gap: '5px', marginTop: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            {[30, 45, 60, 90, 120].map(seconds => (
                                <button key={seconds} onClick={() => setTimerDuration(seconds)}
                                    style={{ ...styles.modeBtn, background: timerDuration === seconds ? '#00d4ff' : 'transparent', color: timerDuration === seconds ? '#000' : '#aaa', borderColor: timerDuration === seconds ? '#00d4ff' : '#333', padding: '5px 15px', fontSize: '0.9rem' }}>
                                    {seconds}s
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#ffd700', fontSize: '0.9rem' }}>
                    <input type="checkbox" checked={useCoinFlip} onChange={e => setUseCoinFlip(e.target.checked)} style={{ transform: 'scale(1.2)' }} />
                    <span>Enable Coin Flip</span>
                </div>

                {vetoMode !== 'custom' ? (
                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '20px' }}>
                        <button style={styles.modeBtn} disabled={isGenerating} onClick={() => handleCreateMatchSubmit('bo1')}>Bo1</button>
                        <button style={styles.modeBtn} disabled={isGenerating} onClick={() => handleCreateMatchSubmit('bo3')}>Bo3</button>
                        {vetoMode !== 'wingman' && <button style={styles.modeBtn} disabled={isGenerating} onClick={() => handleCreateMatchSubmit('bo5')}>Bo5</button>}
                    </div>
                ) : (
                    <div style={{ marginTop: '40px', textAlign: 'left', borderTop: '1px solid #333', paddingTop: '30px' }}>
                        <h4 style={{ color: '#00d4ff', marginBottom: '15px' }}>1. SELECT MAP POOL</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '15px' }}>
                            {availableMaps.map(m => (
                                <div key={m.name} onClick={() => toggleMapSelection(m.name)}
                                    style={{ padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.8rem', border: customSelectedMaps.includes(m.name) ? '1px solid #00ff00' : '1px solid #333', color: customSelectedMaps.includes(m.name) ? '#fff' : '#666', background: customSelectedMaps.includes(m.name) ? 'rgba(0,255,0,0.1)' : 'transparent' }}>
                                    {m.name}
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '5px', marginBottom: '20px' }}>
                            <span style={{ fontSize: '0.8rem', color: '#aaa' }}>ADD CUSTOM MAP:</span>
                            <input style={{ ...styles.input, margin: 0, width: '150px', fontSize: '0.9rem', padding: '5px', height: '35px', textAlign: 'left' }} placeholder="Map Name" value={userCustomMap} onChange={e => setUserCustomMap(e.target.value)} />
                            <button onClick={addUserMap} style={{ ...styles.tinyBtn, height: '35px', border: '1px solid #00ff00', color: '#00ff00', padding: '0 15px', fontWeight: 'bold' }}>ADD</button>
                        </div>
                        <h4 style={{ color: '#00d4ff' }}>2. DEFINE BAN ORDER</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
                            <button style={styles.tinyBtn} onClick={() => addSequenceStep('A', 'ban')}>+ A BAN</button>
                            <button style={styles.tinyBtn} onClick={() => addSequenceStep('B', 'ban')}>+ B BAN</button>
                            <button style={styles.tinyBtn} onClick={() => addSequenceStep('A', 'pick')}>+ A PICK</button>
                            <button style={styles.tinyBtn} onClick={() => addSequenceStep('B', 'pick')}>+ B PICK</button>
                            <button style={styles.tinyBtn} onClick={() => addSequenceStep('A', 'side')}>+ A SIDE</button>
                            <button style={styles.tinyBtn} onClick={() => addSequenceStep('B', 'side')}>+ B SIDE</button>
                            <button style={{ ...styles.tinyBtn, borderColor: '#ffa500', color: '#ffa500' }} onClick={() => addSequenceStep('System', 'knife')}>+ KNIFE</button>
                        </div>
                        <div style={{ background: '#000', padding: '10px', borderRadius: '5px', fontSize: '0.8rem', color: '#aaa', minHeight: '50px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {customSequence.length === 0 ? "No steps defined." : customSequence.map((s, i) => (
                                <span key={i} onClick={() => removeSequenceStep(i)} style={{ background: '#222', padding: '2px 6px', borderRadius: '3px', border: '1px solid #444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    {i + 1}. {s.t} {s.a.toUpperCase()} <span style={{ color: '#ff4444', fontWeight: 'bold' }}>x</span>
                                </span>
                            ))}
                        </div>
                        <button style={{ ...styles.modeBtn, width: '100%', marginTop: '20px', borderColor: '#00ff00', color: '#00ff00' }} disabled={isGenerating} onClick={() => handleCreateMatchSubmit('custom')}>GENERATE CUSTOM MATCH</button>
                    </div>
                )}

                {isGenerating && <div style={styles.generatingBox}><div style={styles.spinner}></div></div>}

                {createdLinks && !isGenerating && (
                    <div style={styles.linksBox}>
                        <div style={styles.linkRow}><span style={{ color: '#aaa', fontWeight: 'bold', minWidth: '70px' }}>ADMIN:</span> <input readOnly style={styles.linkInput} value={createdLinks.admin} onClick={() => handleCopyLogs(createdLinks.admin)} /><button onClick={() => window.open(createdLinks.admin, '_blank')} style={styles.iconBtn}><ExternalLinkIcon /></button></div>
                        <div style={styles.linkRow}><span style={{ color: '#00d4ff', fontWeight: 'bold', minWidth: '70px' }}>TEAM A:</span> <input readOnly style={styles.linkInput} value={createdLinks.teamA} onClick={() => handleCopyLogs(createdLinks.teamA)} /><button onClick={() => window.open(createdLinks.teamA, '_blank')} style={{ ...styles.iconBtn, color: '#00d4ff' }}><ExternalLinkIcon /></button></div>
                        <div style={styles.linkRow}><span style={{ color: '#ff0055', fontWeight: 'bold', minWidth: '70px' }}>TEAM B:</span> <input readOnly style={styles.linkInput} value={createdLinks.teamB} onClick={() => handleCopyLogs(createdLinks.teamB)} /><button onClick={() => window.open(createdLinks.teamB, '_blank')} style={{ ...styles.iconBtn, color: '#ff0055' }}><ExternalLinkIcon /></button></div>
                    </div>
                )}
            </div>

            {historyData.length > 0 && (
                <div style={{ ...styles.glassPanel, marginTop: '30px' }}>
                    <h3 style={{ color: '#00d4ff', borderBottom: '1px solid #333', paddingBottom: '10px' }}>RECENT MATCHES</h3>
                    <div style={{ maxHeight: '300px', overflowY: 'auto', textAlign: 'left' }}>
                        {historyData.map(match => (
                            <div key={match.id} style={{ background: 'rgba(0,0,0,0.5)', padding: '15px', borderRadius: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: match.finished ? '4px solid #333' : '4px solid #00ff00' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: match.finished ? '#888' : '#fff' }}>{match.teamA} <span style={{color: '#555', fontSize:'0.9rem'}}>VS</span> {match.teamB}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '5px' }}>{new Date(match.date).toLocaleDateString()} | Format: {match.format.toUpperCase()}</div>
                                </div>
                                <button onClick={() => navigate(`/${orgId}/${tournamentId}/veto/${match.id}`)} style={{ background: 'transparent', border: '1px solid #00d4ff', color: '#00d4ff', padding: '5px 15px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                    SPECTATE
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ ...styles.notification, opacity: showNotification ? 1 : 0, transform: showNotification ? 'translateY(0)' : 'translateY(20px)' }}><CheckIcon /> COPIED TO CLIPBOARD</div>
        </div>
    );
}

const getStyles = (isMobile) => ({
    container: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: "'Rajdhani', sans-serif", color: 'white', padding: isMobile ? '20px 10px' : '40px 20px', boxSizing: 'border-box', position: 'relative' },
    glassPanel: { background: 'rgba(15, 18, 25, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '15px', padding: isMobile ? '20px' : '40px', width: '100%', maxWidth: '600px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', zIndex: 10 },
    logo: { width: isMobile ? '40px' : '60px', height: isMobile ? '40px' : '60px', borderRadius: '50%', border: '2px solid #00d4ff', boxShadow: '0 0 15px rgba(0, 212, 255, 0.5)' },
    neonTitle: { fontSize: isMobile ? '2rem' : '3.5rem', fontWeight: '900', margin: '0', background: 'linear-gradient(to right, #fff, #00d4ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textShadow: '0 0 20px rgba(0, 212, 255, 0.3)', letterSpacing: '2px' },
    input: { width: '80%', padding: '15px', margin: '15px 0', background: 'rgba(0,0,0,0.5)', border: '1px solid #333', borderRadius: '8px', color: 'white', fontSize: '1.2rem', textAlign: 'center', outline: 'none', fontFamily: "'Rajdhani', sans-serif", fontWeight: 'bold' },
    modeBtn: { background: 'transparent', border: '1px solid #333', color: '#888', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontWeight: 'bold', transition: 'all 0.3s' },
    modeBtnActive: { background: 'rgba(0, 212, 255, 0.1)', border: '1px solid #00d4ff', color: '#00d4ff', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontWeight: 'bold', boxShadow: '0 0 10px rgba(0, 212, 255, 0.2)' },
    tinyBtn: { background: 'rgba(0,0,0,0.5)', border: '1px solid #333', color: '#aaa', padding: '2px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '0.75rem', fontFamily: "'Rajdhani', sans-serif" },
    generatingBox: { marginTop: '20px', padding: '20px', display: 'flex', justifyContent: 'center' },
    spinner: { width: '40px', height: '40px', border: '4px solid rgba(0, 212, 255, 0.1)', borderTopColor: '#00d4ff', borderRadius: '50%', animation: 'spin 1s linear infinite' },
    linksBox: { marginTop: '25px', background: '#000', padding: '15px', borderRadius: '8px', border: '1px solid #333', textAlign: 'left', animation: 'fadeIn 0.5s ease-out' },
    linkRow: { display: 'flex', alignItems: 'center', marginBottom: '10px', gap: '10px' },
    linkInput: { flex: 1, background: '#111', border: '1px solid #222', color: '#fff', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer', outline: 'none' },
    iconBtn: { background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '5px' },
    notification: { position: 'fixed', bottom: '20px', left: '50%', marginLeft: '-125px', width: '250px', background: '#00ff00', color: '#000', padding: '10px 20px', borderRadius: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontWeight: 'bold', zIndex: 4000, transition: 'all 0.3s ease' },
    homeBtn: { position: 'absolute', top: '20px', left: '20px', background: 'rgba(0,0,0,0.5)', border: '1px solid #333', color: '#aaa', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', zIndex: 20 }
});
