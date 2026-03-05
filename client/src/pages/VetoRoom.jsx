import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useVetoStore from '../store/useVetoStore';
import { AnimatedBackground, HomeIcon, CopyIcon, CheckIcon } from '../components/SharedUI';

// 🛡️ ARCHITECTURE FIX: All components imported perfectly
import MapCard from '../components/veto/MapCard';
import LogLineRenderer from '../components/veto/LogLineRenderer';
import CoinFlipOverlay from '../components/veto/CoinFlipOverlay';
import Countdown from '../components/veto/Countdown';

let globalAudioContext = null;

const playSound = (type = 'action') => {
    try {
        if (!globalAudioContext) globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (globalAudioContext.state === 'suspended') globalAudioContext.resume();

        const oscillator = globalAudioContext.createOscillator();
        const gainNode = globalAudioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(globalAudioContext.destination);

        switch (type) {
            case 'ban':
                oscillator.frequency.value = 220; oscillator.type = 'sine'; 
                gainNode.gain.setValueAtTime(0.08, globalAudioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.001, globalAudioContext.currentTime + 0.15); 
                oscillator.start(globalAudioContext.currentTime); oscillator.stop(globalAudioContext.currentTime + 0.15); break;
            case 'pick':
                oscillator.frequency.value = 330; oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.08, globalAudioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.001, globalAudioContext.currentTime + 0.12); 
                oscillator.start(globalAudioContext.currentTime); oscillator.stop(globalAudioContext.currentTime + 0.12); break;
            case 'side':
                oscillator.frequency.value = 275; oscillator.type = 'sine'; 
                gainNode.gain.setValueAtTime(0.07, globalAudioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.001, globalAudioContext.currentTime + 0.1); 
                oscillator.start(globalAudioContext.currentTime); oscillator.stop(globalAudioContext.currentTime + 0.1); break;
            case 'ready':
                oscillator.frequency.value = 440; oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.06, globalAudioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.001, globalAudioContext.currentTime + 0.08); 
                oscillator.start(globalAudioContext.currentTime); oscillator.stop(globalAudioContext.currentTime + 0.08); break;
            case 'coin':
                const baseFreq = 200; const wobbleAmount = 30; const wobbleSpeed = 15; const totalDuration = 0.1; 
                for (let i = 0; i < 3; i++) {
                    const osc = globalAudioContext.createOscillator(); const gain = globalAudioContext.createGain();
                    osc.connect(gain); gain.connect(globalAudioContext.destination);
                    osc.frequency.setValueAtTime(baseFreq + (i * 50), globalAudioContext.currentTime); osc.type = i === 0 ? 'sine' : 'triangle'; 
                    const startTime = globalAudioContext.currentTime + (i * 0.03); gain.gain.setValueAtTime(0, startTime);
                    gain.gain.linearRampToValueAtTime(0.04 - (i * 0.01), startTime + 0.01); gain.gain.linearRampToValueAtTime(0.04 - (i * 0.01), startTime + totalDuration - 0.01); gain.gain.linearRampToValueAtTime(0, startTime + totalDuration);
                    for (let t = 0; t < totalDuration; t += 0.02) { osc.frequency.setValueAtTime(baseFreq + (i * 50) + Math.sin((t * wobbleSpeed) * Math.PI * 2) * wobbleAmount, startTime + t); }
                    osc.start(startTime); osc.stop(startTime + totalDuration);
                }
                return;
            case 'coinLoop':
                const baseFreq2 = 180; const wobbleAmount2 = 25; const wobbleSpeed2 = 12; const cycleDuration = 0.15;
                for (let i = 0; i < 4; i++) {
                    const osc = globalAudioContext.createOscillator(); const gain = globalAudioContext.createGain(); const filter = globalAudioContext.createBiquadFilter();
                    osc.connect(filter); filter.connect(gain); gain.connect(globalAudioContext.destination);
                    filter.type = 'lowpass'; filter.frequency.value = 500 + (i * 100); osc.type = i === 0 ? 'sine' : (i === 1 ? 'triangle' : 'sawtooth');
                    const startTime2 = globalAudioContext.currentTime; gain.gain.setValueAtTime(0.03 - (i * 0.005), startTime2); gain.gain.linearRampToValueAtTime(0, startTime2 + cycleDuration);
                    for (let t = 0; t < cycleDuration; t += 0.01) { osc.frequency.setValueAtTime(baseFreq2 + (i * 40) + Math.sin((t * wobbleSpeed2) * Math.PI * 2) * wobbleAmount2, startTime2 + t); }
                    osc.start(startTime2); osc.stop(startTime2 + cycleDuration);
                }
                return;
            case 'countdown':
                oscillator.frequency.value = 400; oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.05, globalAudioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.001, globalAudioContext.currentTime + 0.05); 
                oscillator.start(globalAudioContext.currentTime); oscillator.stop(globalAudioContext.currentTime + 0.05); break;
            default:
                oscillator.frequency.value = 300; oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.07, globalAudioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.001, globalAudioContext.currentTime + 0.12); 
                oscillator.start(globalAudioContext.currentTime); oscillator.stop(globalAudioContext.currentTime + 0.12);
        }
    } catch (e) { /* silent fail */ }
};

export default function VetoRoom() {
    const { matchId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const { gameState, myRole, serverError, roomUserCount, connectToRoom, disconnectRoom, sendAction, sendReady, sendCoinCall, sendCoinDecide } = useVetoStore();

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('soundEnabled') !== 'false');
    const [showNotification, setShowNotification] = useState(false);
    
    const prevLogsLengthRef = useRef(0);
    const styles = useMemo(() => getStyles(isMobile), [isMobile]);

    useEffect(() => {
        const key = searchParams.get('key');
        if (key) {
            sessionStorage.setItem(`lot_key_${matchId}`, key);
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    useEffect(() => {
        if (!matchId) { navigate('/'); return; }
        
        const storedKey = sessionStorage.getItem(`lot_key_${matchId}`);
        connectToRoom(matchId, storedKey);

        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            disconnectRoom();
        };
    }, [matchId]); 

    useEffect(() => {
        if (!gameState?.logs || !soundEnabled) return;
        
        if (gameState.logs.length > prevLogsLengthRef.current) {
            const newLogs = gameState.logs.slice(prevLogsLengthRef.current);
            newLogs.forEach(log => {
                if (log.includes('[BAN]')) playSound('ban');
                else if (log.includes('[PICK]')) playSound('pick');
                else if (log.includes('[SIDE]') || (log.includes('chose') && log.includes('side'))) playSound('side');
                else if (log.includes('[READY]')) playSound('ready');
            });
        }
        prevLogsLengthRef.current = gameState.logs.length;
    }, [gameState?.logs, soundEnabled]);

    const mapLogCache = useMemo(() => {
        const cache = {};
        if (!gameState?.logs) return cache;
        gameState.logs.forEach(log => {
            if (log.includes('banned')) {
                const mapMatch = log.match(/banned (.*?)(\s|$|\()/);
                if (mapMatch) cache[mapMatch[1].trim()] = { type: 'ban', team: log.split(' banned ')[0].replace(/\[.*?\] /g, '').trim() };
            } else if (log.includes('picked')) {
                const mapMatch = log.match(/picked (.*?)(\s|$|\()/);
                if (mapMatch) {
                    const inlineMatch = log.match(/\((.*?) chose (CT|T) side for/);
                    cache[mapMatch[1].trim()] = { type: 'pick', team: log.split(' picked ')[0].replace(/\[.*?\] /g, '').trim(), sideText: inlineMatch ? `${inlineMatch[1]} CHOSE ${inlineMatch[2]}` : "WAITING FOR SIDE" };
                }
            } else if (log.includes('[DECIDER]')) {
                const mapMatch = log.match(/\[DECIDER\] (.*?) \(/);
                if (mapMatch) cache[mapMatch[1].trim()] = { type: 'decider', sideText: 'SIDE VIA KNIFE' };
            }
        });
        return cache;
    }, [gameState?.logs]);

    const handleCopyLogs = useCallback((text) => {
        navigator.clipboard.writeText(text).then(() => {
            setShowNotification(true); setTimeout(() => setShowNotification(false), 3000);
        });
    }, []);

    if (!gameState) return <div style={styles.container}><AnimatedBackground /><h1 style={{fontSize:'2rem', fontWeight:'bold', color:'#00d4ff'}}>SYNCING ROOM...</h1></div>;

    if (gameState.useCoinFlip && gameState.coinFlip?.status !== 'done') {
        return (
            <div style={styles.container}>
                <AnimatedBackground />
                {serverError && <div style={{ ...styles.notification, background: '#ff4444', color: '#fff', opacity: 1 }}>⚠️ {serverError}</div>}
                <CoinFlipOverlay gameState={gameState} myRole={myRole} 
                    onCall={(call) => sendCoinCall(matchId, call, sessionStorage.getItem(`lot_key_${matchId}`))} 
                    onDecide={(dec) => sendCoinDecide(matchId, dec, sessionStorage.getItem(`lot_key_${matchId}`))} 
                    soundEnabled={soundEnabled} 
                    playSound={playSound}
                />
            </div>
        );
    }

    const currentStep = gameState.sequence[gameState.step];
    const isActionStep = currentStep && (currentStep.a === 'ban' || currentStep.a === 'pick');
    const isSideStep = currentStep && currentStep.a === 'side';
    const isMyTurn = !gameState.finished && currentStep?.t === myRole;
    const actionColor = currentStep?.a === 'ban' ? '#ff4444' : '#00ff00';
    const showReadyButton = gameState.useTimer && !gameState.finished && (myRole === 'A' || myRole === 'B') && !gameState.ready[myRole];

    let instruction = "VETO COMPLETED";
    if (!gameState.finished && currentStep) {
        const teamName = currentStep.t === 'A' ? gameState.teamA : gameState.teamB;
        if (gameState.useTimer && gameState.ready && (!gameState.ready.A || !gameState.ready.B)) instruction = (isMyTurn && !gameState.ready[myRole]) ? "PLEASE CLICK READY" : "WAITING FOR READY";
        else instruction = isMyTurn ? `YOUR TURN: ${currentStep.a.toUpperCase()}` : `WAITING FOR ${teamName.toUpperCase()}`;
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.container}>
            <AnimatedBackground />
            <button onClick={() => navigate('/')} style={styles.homeBtn}><HomeIcon /> EXIT</button>
            
            <button
                onClick={() => { const newState = !soundEnabled; setSoundEnabled(newState); localStorage.setItem('soundEnabled', newState); }}
                style={{
                    position: 'absolute', top: isMobile ? '10px' : '20px', right: isMobile ? '10px' : '20px',
                    background: soundEnabled ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                    border: `1px solid ${soundEnabled ? '#00d4ff' : '#666'}`, color: soundEnabled ? '#00d4ff' : '#888',
                    padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.9rem',
                    display: 'flex', alignItems: 'center', gap: '5px', zIndex: 100, fontFamily: "'Rajdhani', sans-serif"
                }}
            >
                {soundEnabled ? '🔊 SOUND ON' : '🔇 SOUND OFF'}
            </button>

            <div style={{ position: 'absolute', top: isMobile ? '50px' : '20px', right: isMobile ? '10px' : '180px', color: '#888', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00ff00', boxShadow: '0 0 5px #00ff00' }}></div>
                {roomUserCount} VIEWERS
            </div>

            <AnimatePresence>
                {serverError && (
                    <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} style={{ ...styles.notification, background: '#ff4444', color: '#fff' }}>
                        ⚠️ {serverError}
                    </motion.div>
                )}
            </AnimatePresence>

            <div style={styles.scoreboard}>
                <div style={{ fontSize: '2rem', fontWeight: '900', color: '#00d4ff' }}>{gameState.teamA}</div>
                <div style={{ background: '#fff', color: '#000', padding: '5px 15px', borderRadius: '20px', fontWeight: '900' }}>VS</div>
                <div style={{ fontSize: '2rem', fontWeight: '900', color: '#ff0055' }}>{gameState.teamB}</div>
            </div>

            <div style={{ ...styles.statusBar, borderColor: isMyTurn ? actionColor : '#333', boxShadow: isMyTurn ? `0 0 10px ${actionColor}22` : 'none' }}>
                <h2>{instruction} {!gameState.finished && <Countdown endsAt={gameState.timerEndsAt} soundEnabled={soundEnabled} playSound={playSound} />}</h2>
            </div>

            {showReadyButton && (
                <button onClick={() => sendReady(matchId, sessionStorage.getItem(`lot_key_${matchId}`))} style={{ background: '#00d4ff', color: '#000', border: 'none', padding: '15px 40px', fontSize: '1.5rem', fontWeight: 'bold', borderRadius: '10px', cursor: 'pointer', marginBottom: '20px' }}>
                    CLICK TO READY UP
                </button>
            )}

            {!isSideStep && (
                <motion.div layout style={styles.grid}>
                    <AnimatePresence>
                        {gameState.maps.map(map => {
                            const isInteractive = (!gameState.useTimer || (gameState.ready.A && gameState.ready.B)) && isMyTurn && isActionStep && map.status === 'available';
                            const playIndex = gameState.playedMaps ? gameState.playedMaps.indexOf(map.name) : -1;
                            return (
                                <MapCard key={map.name} map={map} isInteractive={isInteractive} 
                                    onClick={() => isInteractive ? sendAction(matchId, map.name, sessionStorage.getItem(`lot_key_${matchId}`)) : null}
                                    actionColor={actionColor} logData={mapLogCache[map.name]} mapOrderLabel={playIndex !== -1 ? `MAP ${playIndex + 1}` : null} styles={styles}
                                />
                            );
                        })}
                    </AnimatePresence>
                </motion.div>
            )}

            {isSideStep && (
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={styles.sideSelectionContainer}>
                    <h2 style={{ marginBottom: '30px' }}>SELECT SIDE</h2>
                    {isMyTurn ? (
                        <div style={{ display: 'flex', gap: '40px', justifyContent: 'center' }}>
                            <motion.div whileHover={{ scale: 1.05 }} style={{ ...styles.sideCard, border: '2px solid #4facfe' }} onClick={() => sendAction(matchId, 'CT', sessionStorage.getItem(`lot_key_${matchId}`))}>
                                <h1 style={styles.sideLabelCT}>CT</h1>
                            </motion.div>
                            <motion.div whileHover={{ scale: 1.05 }} style={{ ...styles.sideCard, border: '2px solid #ff9a9e' }} onClick={() => sendAction(matchId, 'T', sessionStorage.getItem(`lot_key_${matchId}`))}>
                                <h1 style={styles.sideLabelT}>T</h1>
                            </motion.div>
                        </div>
                    ) : <h3 style={{ color: '#888' }}>WAITING FOR OPPONENT...</h3>}
                </motion.div>
            )}

            <div style={styles.logContainer}>
                <div style={styles.logHeader}>
                    <span>VETO LOGS</span>
                    {gameState.finished && <button onClick={() => handleCopyLogs(gameState.logs.join('\n'))} style={styles.copyBtn}><span style={{ marginRight: '5px' }}>COPY</span> <CopyIcon /></button>}
                </div>
                <div style={styles.logScroll}>
                    <AnimatePresence>
                        {gameState.logs.map((log, i) => (
                            <LogLineRenderer key={`${i}-${log.slice(0, 20)}`} log={log} teamA={gameState.teamA} teamB={gameState.teamB} />
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
}

const getStyles = (isMobile) => ({
    container: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: "'Rajdhani', sans-serif", color: 'white', padding: isMobile ? '10px' : '20px', boxSizing: 'border-box' },
    scoreboard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '1200px', marginBottom: '20px', background: 'rgba(0,0,0,0.6)', padding: '15px 30px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' },
    statusBar: { background: 'rgba(0,0,0,0.8)', padding: '15px 30px', borderRadius: '50px', border: '2px solid #333', marginBottom: '30px' },
    grid: { display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', width: '100%', maxWidth: '1400px' },
    mapCard: { backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: '10px', height: isMobile ? '120px' : '250px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', overflow: 'hidden', position: 'relative' },
    cardContent: { padding: '15px', background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)', textAlign: 'center' },
    mapTitle: { fontSize: '1.8rem', fontWeight: '900', textTransform: 'uppercase' },
    badgeBan: { background: '#ff4444', color: 'white', padding: '3px 8px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 'bold', marginTop: '5px' },
    badgePick: { background: '#00ff00', color: 'black', padding: '3px 8px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 'bold', marginTop: '5px' },
    badgeDecider: { background: '#ffa500', color: 'black', padding: '3px 8px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 'bold', marginTop: '5px' },
    homeBtn: { position: 'absolute', top: '20px', left: '20px', background: 'rgba(0,0,0,0.5)', border: '1px solid #333', color: '#aaa', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' },
    notification: { position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: '#00ff00', color: '#000', padding: '10px 20px', borderRadius: '50px', fontWeight: 'bold', zIndex: 4000 },
    mapOrderBadge: { position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.8)', border: '1px solid #00ff00', color: '#00ff00', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', zIndex: 3 },
    miniSideBadge: { background: '#000', color: '#fff', fontSize: '0.6rem', padding: '2px 5px', borderRadius: '3px', marginTop: '3px', border: '1px solid #333' },
    logContainer: { width: '100%', maxWidth: '800px', background: 'rgba(0,0,0,0.8)', border: '1px solid #333', borderRadius: '10px', marginTop: '30px', overflow: 'hidden' },
    logHeader: { background: '#111', padding: '15px 20px', borderBottom: '1px solid #333', fontWeight: 'bold', color: '#aaa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    copyBtn: { background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.8rem' },
    logScroll: { maxHeight: '200px', overflowY: 'auto', padding: '15px 20px', display: 'flex', flexDirection: 'column' },
    logRow: { display: 'flex', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px', marginBottom: '6px' },
    sideSelectionContainer: { background: 'rgba(0,0,0,0.8)', border: '1px solid #333', borderRadius: '15px', padding: '40px', textAlign: 'center', width: '100%', maxWidth: '800px' },
    sideCard: { flex: 1, background: '#111', borderRadius: '10px', padding: '20px', cursor: 'pointer' },
    sideLabelCT: { color: '#4facfe', fontSize: '3rem', margin: 0, textShadow: '0 0 10px #4facfe' },
    sideLabelT: { color: '#ff9a9e', fontSize: '3rem', margin: 0, textShadow: '0 0 10px #ff9a9e' }
});
