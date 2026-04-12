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
import Watermark from '../components/Watermark';
import { NeonText, GlassPanel, ScanlineOverlay, GlowButton } from '../components/veto/VetoUIPrimitives';

/**
 * ⚡ UI LAYER — CINEMATIC VETO ROOM (UE5 FIDELITY)
 * =============================================================================
 * Responsibility: Live map selection interface for teams and observers.
 * Design: Motion-intensive, scanlined, holographic esports experience.
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
        isDisconnected,
        serverError,
        connectToRoom, 
        disconnectRoom, 
        sendAction, 
        sendReady, 
        sendCoinCall, 
        sendCoinDecide 
    } = useVetoStore();

    const { branding } = useOrgBranding(gameState?.org_id);
    const [showCopyNotify, setShowCopyNotify] = useState(false);
    const logContainerRef = useRef(null);
    const [timerRemaining, setTimerRemaining] = useState(999);
    
    useEffect(() => {
        if (!gameState?.useTimer || gameState?.finished || !gameState?.timerEndsAt) return;
        const interval = setInterval(() => {
            const remaining = Math.max(0, Math.floor((new Date(gameState.timerEndsAt) - new Date()) / 1000));
            setTimerRemaining(remaining);
        }, 500);
        return () => clearInterval(interval);
    }, [gameState?.timerEndsAt, gameState?.useTimer, gameState?.finished]);

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
        sendAction(matchId, currentStep.a, { mapName }, key);
    };

    const copyInviteLink = (targetRole) => {
        if (!gameState?.keys_data) return;
        const keyToUse = gameState.keys_data[targetRole];
        const baseUrl = window.location.origin + window.location.pathname;
        navigator.clipboard.writeText(`${baseUrl}?key=${keyToUse}`);
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
                    <NeonText fontSize="1.5rem">Initializing Terminal Signal...</NeonText>
                    {serverError && <p style={{ color: '#ff4b2b', marginTop: '1rem' }}>{serverError}</p>}
                </motion.div>
            </div>
        );
    }

    return (
        <div className="veto-room-page">
            <AnimatedBackground />
            <ScanlineOverlay />

            {/* 4. RECONNECT TOAST */}
            <AnimatePresence>
            {isDisconnected && (
              <motion.div
                initial={{ y: -60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -60, opacity: 0 }}
                style={{
                  position: 'fixed', top: 0, left: 0, right: 0,
                  zIndex: 9999, padding: '12px 24px',
                  background: 'rgba(220,38,38,0.95)',
                  backdropFilter: 'blur(8px)',
                  textAlign: 'center', fontFamily: 'Rajdhani',
                  fontWeight: 700, letterSpacing: '0.1em',
                  fontSize: '14px', color: '#fff'
                }}
              >
                CONNECTION LOST — RECONNECTING...
              </motion.div>
            )}
            </AnimatePresence>

            {/* ── STATUS BAR ── */}
            <div className="room-status-bar" style={{ background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'space-between', padding: '12px 40px', fontSize: '11px', zIndex: 100, position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'rgba(255,255,255,0.7)' }}>
                    <ActivityIcon size={14} color="var(--brand-primary)" />
                    <span style={{ letterSpacing: '3px', fontWeight: 900 }}>LIVE TERMINAL FEED</span>
                    
                    {/* 1. SPECTATOR COUNT */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      fontSize: '13px', color: 'rgba(255,255,255,0.5)',
                      fontFamily: 'Rajdhani', letterSpacing: '0.05em',
                      marginLeft: '12px'
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      {roomUserCount || 0} WATCHING
                    </div>
                </div>
                <div style={{ letterSpacing: '3px', fontWeight: 900, color: isConnected ? '#00ff88' : '#ffaa00' }}>
                    {isConnected ? 'SIGNAL: SECURED' : 'SIGNAL: LOSS DETECTED'}
                </div>
            </div>

            {/* ── CINEMATIC HEADER ── */}
            <header style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '80px 40px', 
                gap: '100px', 
                position: 'relative', 
                zIndex: 10,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 100%)'
            }}>
                {/* Team A */}
                <motion.div 
                    initial={{ x: -100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    style={{ display: 'flex', alignItems: 'center', gap: '40px', textAlign: 'left' }}
                >
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', opacity: 0.4, letterSpacing: '4px', marginBottom: '8px' }}>CORE TEAM</div>
                        <h2 style={{ fontSize: '3.5rem', fontWeight: 900, margin: 0, letterSpacing: '2px' }}>{gameState.teamA}</h2>
                        {gameState.ready?.A ? <span style={{ color: '#00ff88', fontSize: '11px', fontWeight: 900, letterSpacing: '2px' }}>[ READY ]</span> : <span style={{ opacity: 0.3, fontSize: '11px', letterSpacing: '2px' }}>[ SYNCING... ]</span>}
                    </div>
                    {/* 2. ACTIVE TEAM INDICATOR (A) */}
                    <GlassPanel style={{ 
                        width: '160px', height: '160px', padding: '24px', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderLeft: (!gameState.finished && gameState.sequence[gameState.step]?.t === 'A') ? '3px solid var(--brand-primary, #00d4ff)' : undefined,
                        animation: (!gameState.finished && gameState.sequence[gameState.step]?.t === 'A') ? 'teamPulse 2s ease-in-out infinite' : 'none',
                        opacity: (!gameState.finished && gameState.sequence[gameState.step]?.t !== 'A') ? 0.4 : 1
                    }}>
                        <img src={gameState.teamALogo || 'https://via.placeholder.com/100'} alt={gameState.teamA} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </GlassPanel>
                </motion.div>

                {/* Center / VS */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                    <NeonText fontSize="3rem" color="rgba(255,255,255,0.2)">VS</NeonText>
                    <div style={{ padding: '6px 20px', border: '1px solid var(--brand-primary)', borderRadius: '50px', fontSize: '12px', fontWeight: 900, letterSpacing: '4px' }}>{gameState.format.toUpperCase()}</div>
                    {gameState.useTimer && !gameState.finished && (
                        <div style={{ 
                            fontSize: '4rem', fontWeight: 900, letterSpacing: '-4px', color: '#fff',
                            animation: timerRemaining <= 5 ? 'timerShake 0.1s ease-in-out infinite' : 'none'
                        }}>
                            {/* 3. TIMER SHAKE */}
                            <Countdown target={gameState.timerEndsAt} key={gameState.step} />
                        </div>
                    )}
                </div>

                {/* Team B */}
                <motion.div 
                    initial={{ x: 100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    style={{ display: 'flex', alignItems: 'center', gap: '40px', textAlign: 'right' }}
                >
                    {/* 2. ACTIVE TEAM INDICATOR (B) */}
                    <GlassPanel style={{ 
                        width: '160px', height: '160px', padding: '24px', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderLeft: (!gameState.finished && gameState.sequence[gameState.step]?.t === 'B') ? '3px solid var(--brand-primary, #00d4ff)' : undefined,
                        animation: (!gameState.finished && gameState.sequence[gameState.step]?.t === 'B') ? 'teamPulse 2s ease-in-out infinite' : 'none',
                        opacity: (!gameState.finished && gameState.sequence[gameState.step]?.t !== 'B') ? 0.4 : 1
                    }}>
                        <img src={gameState.teamBLogo || 'https://via.placeholder.com/100'} alt={gameState.teamB} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </GlassPanel>
                    <div>
                        <div style={{ fontSize: '12px', opacity: 0.4, letterSpacing: '4px', marginBottom: '8px' }}>CHALLENGER</div>
                        <h2 style={{ fontSize: '3.5rem', fontWeight: 900, margin: 0, letterSpacing: '2px' }}>{gameState.teamB}</h2>
                        {gameState.ready?.B ? <span style={{ color: '#00ff88', fontSize: '11px', fontWeight: 900, letterSpacing: '2px' }}>[ READY ]</span> : <span style={{ opacity: 0.3, fontSize: '11px', letterSpacing: '2px' }}>[ SYNCING... ]</span>}
                    </div>
                </motion.div>
            </header>

            {/* ── CORE LAYOUT ── */}
            <main style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '48px', maxWidth: '1700px', margin: '0 auto', padding: '0 40px 100px', position: 'relative', zIndex: 10 }}>
                {/* Sidebar */}
                <aside style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    <GlassPanel style={{ padding: '32px' }}>
                        <h4 style={{ fontSize: '11px', letterSpacing: '4px', color: 'var(--brand-primary)', margin: '0 0 24px 0', fontWeight: 900 }}>TERMINAL LOGS</h4>
                        <div className="log-container" ref={logContainerRef} style={{ maxHeight: '450px', overflowY: 'auto' }}>
                            <AnimatePresence initial={false}>
                                {gameState.logs.slice(-10).map((log, idx) => (
                                    <motion.div 
                                        key={`${idx}-${log}`}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        style={{ marginBottom: '14px', borderLeft: '2px solid rgba(255,255,255,0.05)', paddingLeft: '16px' }}
                                    >
                                        <LogLineRenderer log={log} teamA={gameState.teamA} teamB={gameState.teamB} />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </GlassPanel>

                    {!gameState.finished && (
                        <GlassPanel style={{ padding: '32px' }}>
                            <h4 style={{ fontSize: '11px', letterSpacing: '4px', color: 'var(--brand-primary)', margin: '0 0 24px 0', fontWeight: 900 }}>OPERATIONS</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {myRole && myRole !== 'admin' && gameState.useTimer && !gameState.ready?.[myRole] && (
                                    <GlowButton style={{ width: '100%', justifyContent: 'center' }} onClick={() => sendReady(matchId, key)}>
                                        INITIALIZE READY SIGNAL
                                    </GlowButton>
                                )}

                                {myRole === 'admin' && (
                                    <>
                                        <button className="glass-panel" style={{ width: '100%', padding: '14px', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', fontWeight: 900, borderRadius: '12px', letterSpacing: '2px', cursor: 'pointer' }} onClick={() => copyInviteLink('A')}>
                                            COPY TEAM A LINK
                                        </button>
                                        <button className="glass-panel" style={{ width: '100%', padding: '14px', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', fontWeight: 900, borderRadius: '12px', letterSpacing: '2px', cursor: 'pointer' }} onClick={() => copyInviteLink('B')}>
                                            COPY TEAM B LINK
                                        </button>
                                        <button className="glass-panel" style={{ width: '100%', padding: '14px', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', fontWeight: 900, borderRadius: '12px', letterSpacing: '2px', cursor: 'pointer' }} onClick={() => copyInviteLink('admin')}>
                                            COPY ADMIN LINK
                                        </button>
                                    </>
                                )}
                                
                                {myRole !== 'admin' && (
                                    <button className="glass-panel" style={{ width: '100%', padding: '14px', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', fontWeight: 900, borderRadius: '12px', letterSpacing: '2px', cursor: 'pointer' }} onClick={() => copyInviteLink(myRole || 'viewer')}>
                                        COPY MATCH TERMINAL LINK
                                    </button>
                                )}
                                
                                {showCopyNotify && (
                                    <div style={{ color: '#00ff88', fontSize: '10px', textAlign: 'center', letterSpacing: '2px', fontWeight: 900 }}>LINK COPIED SECURELY</div>
                                )}
                            </div>
                        </GlassPanel>
                    )}
                </aside>

                {/* Map Selection Grid */}
                <section style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '20px' }}>
                        <div>
                            <h4 style={{ fontSize: '12px', letterSpacing: '4px', color: 'rgba(255,255,255,0.4)', margin: '0 0 8px 0' }}>PHASE</h4>
                            <NeonText fontSize="1.8rem">
                                {gameState.finished ? 'VETO COMPLETED' : `${gameState.sequence[gameState.step]?.t} / ${gameState.sequence[gameState.step]?.a.toUpperCase()}`}
                            </NeonText>
                        </div>
                        {isMyTurn && <div style={{ color: '#00ff88', fontSize: '12px', fontWeight: 900, letterSpacing: '2px' }}>⚡ YOUR ACTION REQUIRED</div>}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                        <AnimatePresence mode="popLayout">
                            {gameState.maps.map((m, index) => {
                                const pickIndex = gameState.logs.filter(l => l.includes('[PICK]')).findIndex(l => l.includes(m.name));
                                return (
                                    <motion.div
                                        key={m.name}
                                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                    >
                                        <MapCard 
                                            map={m}
                                            isInteractive={isMyTurn}
                                            onClick={() => handleMapClick(m.name)}
                                            actionColor={currentActionColor}
                                            mapOrderLabel={pickIndex !== -1 ? (pickIndex + 1).toString() : null}
                                        />
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                </section>
                
                <Watermark branding={branding} />
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

            {/* NOTIFICATIONS */}
            <AnimatePresence>
                {!isConnected && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        style={{ position: 'fixed', top: '10px', left: '50%', transform: 'translateX(-50%)', padding: '12px 24px', fontWeight: 900, zIndex: 2000, display: 'flex', alignItems: 'center', gap: '10px', background: '#ff4b2b', color: '#fff', borderRadius: '8px', letterSpacing: '2px' }}
                    >
                        <RefreshIcon /> SIGNAL LOST - ATTEMPTING RECOVERY...
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .log-container::-webkit-scrollbar { display: none; }
                @keyframes teamPulse {
                    0%, 100% { border-left-color: var(--brand-primary, #00d4ff) }
                    50% { border-left-color: rgba(0,212,255,0.3) }
                }
                @keyframes timerShake {
                    0%, 100% { transform: translateX(0) }
                    25% { transform: translateX(-3px) }
                    75% { transform: translateX(3px) }
                }
            `}</style>
        </div>
    );
};

export default VetoRoom;
