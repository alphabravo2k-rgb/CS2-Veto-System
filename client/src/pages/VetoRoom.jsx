import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useVetoStore from '../store/useVetoStore';
import useOrgBranding from '../hooks/useOrgBranding';
import MapCard from '../components/veto/MapCard';
import CoinFlipOverlay from '../components/veto/CoinFlipOverlay';
import LogLineRenderer from '../components/veto/LogLineRenderer';
import Countdown from '../components/veto/Countdown';
import { AnimatedBackground, HomeIcon, CheckIcon, ActivityIcon, RefreshIcon } from '../components/SharedUI';

/**
 * ⚡ UI LAYER — PREMIUM VETO ROOM
 * =============================================================================
 * Responsibility: Live map selection interface for teams and observers.
 * Features: Real-time WebSocket sync, glassmorphic UI, neon signaling.
 * =============================================================================
 */
const VetoRoom = () => {
    const { matchId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const query = new URLSearchParams(location.search);
    const key = query.get('key');

    const { 
        gameState, 
        myRole, 
        roomUserCount, 
        isConnected, 
        serverError,
        connectToRoom, 
        disconnectRoom, 
        sendAction, 
        sendReady, 
        sendCoinCall, 
        sendCoinDecide 
    } = useVetoStore();

    const { branding } = useOrgBranding();
    const [showCopyNotify, setShowCopyNotify] = useState(false);
    const logContainerRef = useRef(null);

    // ── WebSocket Lifecycle ──
    useEffect(() => {
        if (matchId) {
            connectToRoom(matchId, key);
        }
        return () => disconnectRoom();
    }, [matchId, key, connectToRoom, disconnectRoom]);

    // ── Auto-scroll logs ──
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [gameState?.logs]);

    // ── Helper Logic ──
    const isMyTurn = useMemo(() => {
        if (!gameState || gameState.finished) return false;
        const currentStep = gameState.sequence[gameState.step];
        if (!currentStep) return false;
        return currentStep.t === myRole;
    }, [gameState, myRole]);

    const currentActionColor = useMemo(() => {
        if (!gameState || gameState.finished) return 'rgba(255,255,255,0.2)';
        const currentStep = gameState.sequence[gameState.step];
        if (currentStep?.t === 'A') return 'var(--brand-primary, #00d4ff)';
        if (currentStep?.t === 'B') return '#ff0055';
        return '#ffd700';
    }, [gameState]);

    const handleMapClick = (mapName) => {
        if (!isMyTurn) return;
        const currentStep = gameState.sequence[gameState.step];
        if (currentStep?.a === 'side' || currentStep?.a === 'knife') return;
        sendAction(matchId, { mapName }, key);
    };

    const copyInvite = () => {
        navigator.clipboard.writeText(window.location.href);
        setShowCopyNotify(true);
        setTimeout(() => setShowCopyNotify(false), 2000);
    };

    if (!gameState) {
        return (
            <div className="loading-screen" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050a14', color: '#fff' }}>
                <AnimatedBackground />
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ textAlign: 'center', zIndex: 10 }}
                >
                    <div style={{ width: '40px', height: '40px', border: '3px solid var(--brand-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1.5rem' }} />
                    <h2 style={{ letterSpacing: '4px', fontWeight: 900 }}>INITIALIZING VETO STREAM...</h2>
                    {serverError && <p style={{ color: '#ff4b2b', marginTop: '1rem' }}>{serverError}</p>}
                </motion.div>
            </div>
        );
    }

    return (
        <div className="veto-room-page">
            <AnimatedBackground />

            {/* ── STATUS BAR ── */}
            <div className="room-status-bar glass-panel" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'space-between', padding: '12px 24px', fontSize: '11px', zIndex: 100, position: 'relative' }}>
                <div className="spectator-badge" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.7)' }}>
                    <ActivityIcon size={14} color="var(--brand-primary)" />
                    <span style={{ letterSpacing: '2px', fontWeight: 900 }}>{roomUserCount} OBSERVERS</span>
                </div>
                <div className={`connection-status ${isConnected ? 'online' : 'reconnecting'}`} style={{ letterSpacing: '2px', fontWeight: 900, color: isConnected ? '#00ff88' : '#ffaa00' }}>
                    {isConnected ? 'LIVE FEED ON' : 'SIGNAL LOST - RECONNECTING...'}
                </div>
            </div>

            {/* ── MATCH HEADER ── */}
            <header className="match-header fade-enter-active" style={{ display: 'flex', alignItems: 'center', justify-content: 'center', padding: '60px 24px', gap: '80px', position: 'relative', zIndex: 10 }}>
                <div className={`team-block team-a ${gameState.sequence[gameState.step]?.t === 'A' ? 'active-turn' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '32px', transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
                    <div className="team-logo-wrapper glass-panel" style={{ width: '120px', height: '120px', padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '20px' }}>
                        <img src={gameState.teamALogo || 'https://via.placeholder.com/100'} alt={gameState.teamA} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </div>
                    <div className="team-info">
                        <h2 className={gameState.sequence[gameState.step]?.t === 'A' ? "team-name neon-text" : "team-name"} style={{ fontSize: '3rem', fontWeight: 900, margin: 0, letterSpacing: '2px' }}>{gameState.teamA}</h2>
                        {gameState.ready?.A ? <span className="ready-tag">READY FOR COMBAT</span> : <span className="waiting-tag">WAITING FOR OPS</span>}
                    </div>
                </div>

                <div className="match-center" style={{ display: 'flex', flex-direction: 'column', alignItems: 'center', gap: '16px' }}>
                    <div className="vs-label neon-text" style={{ fontSize: '2.5rem', fontWeight: 900, opacity: 0.3 }}>VS</div>
                    <div className="format-badge premium-button" style={{ borderRadius: '50px', padding: '4px 16px', border: '1px solid var(--brand-primary)', fontFamily: 'Rajdhani' }}>{gameState.format.toUpperCase()}</div>
                    {gameState.useTimer && !gameState.finished && (
                        <div className="timer-wrapper" style={{ fontSize: '3.5rem', fontWeight: 900, letterSpacing: '-2px' }}>
                            <Countdown target={gameState.timerEndsAt} key={gameState.step} />
                        </div>
                    )}
                </div>

                <div className={`team-block team-b ${gameState.sequence[gameState.step]?.t === 'B' ? 'active-turn' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '32px', transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
                    <div className="team-info" style={{ textAlign: 'right' }}>
                        <h2 className={gameState.sequence[gameState.step]?.t === 'B' ? "team-name neon-text" : "team-name"} style={{ fontSize: '3rem', fontWeight: 900, margin: 0, letterSpacing: '2px' }}>{gameState.teamB}</h2>
                        {gameState.ready?.B ? <span className="ready-tag">READY FOR COMBAT</span> : <span className="waiting-tag">WAITING FOR OPS</span>}
                    </div>
                    <div className="team-logo-wrapper glass-panel" style={{ width: '120px', height: '120px', padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '20px' }}>
                        <img src={gameState.teamBLogo || 'https://via.placeholder.com/100'} alt={gameState.teamB} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </div>
                </div>
            </header>

            {/* ── MAIN LAYOUT ── */}
            <main className="room-layout" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '40px', maxWidth: '1600px', margin: '0 auto', padding: '0 40px 80px', position: 'relative', zIndex: 10 }}>
                {/* LOGS & CONTROLS */}
                <aside className="room-sidebar">
                    <div className="action-card glass-panel" style={{ padding: '2rem', marginBottom: '2rem', position: 'relative' }}>
                        <h4 className="card-title neon-text" style={{ font-size: '10px', margin: '0 0 24px 0', letterSpacing: '0.4em', font-weight: 900 }}>OPERATION LOGS</h4>
                        <div className="log-container" ref={logContainerRef} style={{ max-height: '450px', overflow-y: 'auto' }}>
                            <AnimatePresence initial={false}>
                                {gameState.logs.slice(-8).map((log, idx) => (
                                    <motion.div 
                                        key={`${idx}-${log}`}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        style={{ marginBottom: '12px' }}
                                    >
                                        <LogLineRenderer log={log} teamA={gameState.teamA} teamB={gameState.teamB} />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>

                    {!gameState.finished && (
                        <div className="action-card controls glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
                            <h4 className="card-title neon-text" style={{ font-size: '10px', margin: '0 0 24px 0', letterSpacing: '0.4em', font-weight: 900 }}>COMMAND OVERRIDE</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {myRole && !gameState.ready?.[myRole] && (
                                    <button className="premium-button" style={{ width: '100%', justifyContent: 'center' }} onClick={() => sendReady(matchId, key)}>
                                        ACTIVATE READINESS
                                    </button>
                                )}
                                <button className="glass-panel" style={{ width: '100%', cursor: 'pointer', padding: '12px', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', fontWeight: 900, borderRadius: '12px', letterSpacing: '2px' }} onClick={copyInvite}>
                                    TRANSMIT INVITE
                                </button>
                                {myRole === 'admin' && (
                                    <button className="premium-button" style={{ width: '100%', justifyContent: 'center', background: '#ff4b2b' }} onClick={() => navigate('/admin')}>
                                        PLATFORM ADMIN
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </aside>

                {/* MAP GRID */}
                <section className="map-grid-section" style={{ display: 'flex', flex-direction: 'column', gap: '32px' }}>
                    <div className="step-indicator glass-panel" style={{ padding: '1.5rem 2rem', display: 'flex', alignItems: 'center', gap: '16px', font-weight: 900, background: 'rgba(0,0,0,0.4)' }}>
                        {gameState.finished ? (
                            <span className="veto-complete neon-text" style={{ fontSize: '1.2rem', letterSpacing: '4px' }}>MISSION ACCOMPLISHED</span>
                        ) : (
                            <>
                                <span style={{ opacity: 0.5, letterSpacing: '2px' }}>PENDING DIRECTIVE:</span>
                                <span className="neon-text" style={{ fontSize: '1.2rem', letterSpacing: '2px' }}>
                                    {gameState.sequence[gameState.step]?.t} {gameState.sequence[gameState.step]?.a.toUpperCase()}
                                </span>
                            </>
                        )}
                    </div>

                    <div className="map-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
                        <AnimatePresence mode="popLayout">
                            {gameState.maps.map((m) => {
                                const pickIndex = gameState.logs.filter(l => l.includes('[PICK]')).findIndex(l => l.includes(m.name));
                                return (
                                    <MapCard 
                                        key={m.name}
                                        map={m}
                                        isInteractive={isMyTurn}
                                        onClick={() => handleMapClick(m.name)}
                                        actionColor={currentActionColor}
                                        mapOrderLabel={pickIndex !== -1 ? (pickIndex + 1).toString() : null}
                                    />
                                );
                            })}
                        </AnimatePresence>
                    </div>
                </section>
            </main>

            {/* OVERLAYS */}
            {gameState.useCoinFlip && (
                <CoinFlipOverlay 
                    gameState={gameState} 
                    myRole={myRole} 
                    onCall={(call) => sendCoinCall(matchId, call, key)}
                    onDecide={(decision) => sendCoinDecide(matchId, decision, key)}
                />
            )}

            {/* TOASTS */}
            <AnimatePresence>
                {!isConnected && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="glass-panel"
                        style={{ position: 'fixed', top: '10px', left: '50%', transform: 'translateX(-50%)', padding: '12px 24px', fontWeight: 900, zIndex: 2000, display: 'flex', alignItems: 'center', gap: '10px', background: '#ff4b2b', color: '#fff', border: 'none', letterSpacing: '2px' }}
                    >
                        <RefreshIcon /> SIGNAL LOST — RECOVERING DATA...
                    </motion.div>
                )}

                {showCopyNotify && (
                    <motion.div 
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="glass-panel"
                        style={{ position: 'fixed', bottom: '40px', left: '50%', transform: 'translateX(-50%)', padding: '16px 32px', border-radius: '50px', font-weight: 900, display: 'flex', alignItems: 'center', gap: '12px', zIndex: 2000, background: 'var(--brand-primary)', color: '#000', border: 'none', letterSpacing: '2px' }}
                    >
                        <CheckIcon /> ENCRYPTION KEY COPIED
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .veto-room-page { min-height: 100vh; background: #050a14; color: #fff; font-family: 'Rajdhani', sans-serif; position: relative; }
                .ready-tag { font-size: 10px; color: #00ff88; background: rgba(0,255,136,0.1); padding: 4px 12px; border-radius: 50px; border: 1px solid rgba(0,255,136,0.2); font-weight: 900; letter-spacing: 2px; }
                .waiting-tag { font-size: 10px; color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.05); padding: 4px 12px; border-radius: 50px; border: 1px solid rgba(255,255,255,0.1); font-weight: 900; letter-spacing: 2px; }
                .team-block.active-turn { transform: scale(1.1); }
                .team-block.active-turn .team-logo-wrapper { border-color: var(--brand-primary); box-shadow: 0 0 40px rgba(0, 212, 255, 0.4); }
                @keyframes spin { to { transform: rotate(360deg); } }
                .log-container::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
};

export default VetoRoom;
