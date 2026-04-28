import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import SEO from '../components/SEO';
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
        isConnected,
        isDisconnected,
        serverError,
        roomUserCount,
        connectToRoom,
        disconnectRoom,
        sendAction,
        sendReady,
        sendCoinCall, 
        sendCoinDecide,
        reportResult
    } = useVetoStore();

    const [scoreA, setScoreA] = useState('');
    const [scoreB, setScoreB] = useState('');
    const [isReporting, setIsReporting] = useState(false);

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
        if (currentStep?.t === 'A') return gameTheme.primary;
        if (currentStep?.t === 'B') return '#ff0055';
        return '#ffd700';
    }, [gameState, gameTheme]);

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

    const gameTheme = useMemo(() => {
        const themes = {
            cs2: { primary: '#00d4ff', secondary: 'rgba(0, 212, 255, 0.1)', name: 'Counter-Strike 2' },
            valorant: { primary: '#ff4655', secondary: 'rgba(255, 70, 85, 0.1)', name: 'Valorant' },
            r6: { primary: '#ffd700', secondary: 'rgba(255, 215, 0, 0.1)', name: 'Rainbow Six Siege' }
        };
        return themes[gameState?.game] || themes.cs2;
    }, [gameState?.game]);

    if (!gameState) {
        return (
            <div className="loading-screen" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050a14', color: '#fff' }}>
                <SEO title="Loading Veto" description="Initializing Veto Session..." />
                <AnimatedBackground />
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ textAlign: 'center', zIndex: 10 }}
                >
                    <div style={{ width: '40px', height: '40px', border: '3px solid #00d4ff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1.5rem' }} />
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
                    <ActivityIcon size={14} color={gameTheme.primary} />
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
            <header className="veto-header" style={{ 
                display: 'flex', 
                flexWrap: 'wrap',
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '40px 20px', 
                gap: '40px', 
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
                        <img src={gameState.teamALogo || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIiBzdHJva2Utd2lkdGg9IjEiPjxjaXJjbGUgY3g9IjEyIiBjeT0iOCIgcj0iNSIvPjxwYXRoIGQ9Ik0zIDIwdjJjMCAxLjEgLjkgMiAyIDJoMTRjMS4xIDAgMi0uOSAyLTJ2LTJjMC0yLjItMS44LTQtNC00SDdjLTIuMiAwLTQgMS44LTQgNHoiLz48L3N2Zz4='} alt={gameState.teamA} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </GlassPanel>
                </motion.div>

                {/* Center / VS */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                    <NeonText fontSize="3rem" color="rgba(255,255,255,0.2)">VS</NeonText>
                    <div style={{ padding: '6px 20px', border: `1px solid ${gameTheme.primary}`, borderRadius: '50px', fontSize: '12px', fontWeight: 900, letterSpacing: '4px' }}>{gameState.format.toUpperCase()}</div>
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
                        <img src={gameState.teamBLogo || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIiBzdHJva2Utd2lkdGg9IjEiPjxjaXJjbGUgY3g9IjEyIiBjeT0iOCIgcj0iNSIvPjxwYXRoIGQ9Ik0zIDIwdjJjMCAxLjEgLjkgMiAyIDJoMTRjMS4xIDAgMi0uOSAyLTJ2LTJjMC0yLjItMS44LTQtNC00SDdjLTIuMiAwLTQgMS44LTQgNHoiLz48L3N2Zz4='} alt={gameState.teamB} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </GlassPanel>
                    <div>
                        <div style={{ fontSize: '12px', opacity: 0.4, letterSpacing: '4px', marginBottom: '8px' }}>CHALLENGER</div>
                        <h2 style={{ fontSize: '3.5rem', fontWeight: 900, margin: 0, letterSpacing: '2px' }}>{gameState.teamB}</h2>
                        {gameState.ready?.B ? <span style={{ color: '#00ff88', fontSize: '11px', fontWeight: 900, letterSpacing: '2px' }}>[ READY ]</span> : <span style={{ opacity: 0.3, fontSize: '11px', letterSpacing: '2px' }}>[ SYNCING... ]</span>}
                    </div>
                </motion.div>
            </header>

            {/* ── CORE LAYOUT ── */}
            <main className="veto-core-layout" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', 
                gap: '48px', 
                maxWidth: '1700px', 
                margin: '0 auto', 
                padding: '0 40px 100px', 
                position: 'relative', 
                zIndex: 10 
            }}>
                {/* Sidebar */}
                <aside style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    <GlassPanel style={{ padding: '32px', position: 'relative' }}>
                        <h4 style={{ fontSize: '11px', letterSpacing: '4px', color: 'var(--brand-primary)', margin: '0 0 24px 0', fontWeight: 900 }}>TERMINAL LOGS</h4>
                        <div 
                            className="log-container custom-scrollbar" 
                            ref={logContainerRef} 
                            style={{ 
                                maxHeight: '500px', 
                                overflowY: 'auto',
                                scrollBehavior: 'smooth',
                                paddingRight: '10px'
                            }}
                        >
                            <AnimatePresence initial={false}>
                                {gameState.logs.map((log, idx) => (
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
                        {myRole === 'admin' && gameState.step > 0 && !gameState.finished && (
                            <button 
                                onClick={() => sendAction(matchId, 'revert', {}, key)}
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#ff4444', padding: '8px 16px', borderRadius: '4px', fontSize: '10px', fontWeight: 900, cursor: 'pointer', letterSpacing: '2px' }}
                            >
                                ↩ UNDO STEP
                            </button>
                        )}
                    </div>

                    {/* 🛡️ SIDE SELECTION OVERLAY (Fixes Gap 2.7) */}
                    <AnimatePresence>
                        {isMyTurn && gameState.sequence[gameState.step]?.a === 'side' && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="glass-panel"
                                style={{ 
                                    padding: '40px', 
                                    textAlign: 'center', 
                                    border: `1px solid ${currentActionColor}`,
                                    background: `${currentActionColor}05`,
                                    marginBottom: '32px',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                            >
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${currentActionColor}, transparent)` }} />
                                <h3 style={{ fontSize: '1rem', fontWeight: 900, letterSpacing: '4px', marginBottom: '8px' }}>TACTICAL DEPLOYMENT</h3>
                                <p style={{ fontSize: '12px', opacity: 0.5, letterSpacing: '1px', marginBottom: '32px' }}>CHOOSE YOUR STARTING FACTION ON {gameState.lastPickedMap || 'DECIDER'}</p>
                                
                                <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                                    <GlowButton 
                                        style={{ padding: '20px 40px', background: 'rgba(0,212,255,0.05)', borderColor: '#00d4ff' }}
                                        onClick={() => sendAction(matchId, 'side', { side: 'CT' }, key)}
                                    >
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                            <ShieldIcon size={24} color="#00d4ff" />
                                            <span style={{ fontSize: '14px' }}>COUNTER-TERRORISTS</span>
                                        </div>
                                    </GlowButton>
                                    <GlowButton 
                                        style={{ padding: '20px 40px', background: 'rgba(255,0,85,0.05)', borderColor: '#ff0055' }}
                                        onClick={() => sendAction(matchId, 'side', { side: 'T' }, key)}
                                    >
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff0055" strokeWidth="2">
                                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                                            </svg>
                                            <span style={{ fontSize: '14px' }}>TERRORISTS</span>
                                        </div>
                                    </GlowButton>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {gameState.finished && myRole === 'admin' && !gameState.result_reported_at && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass-panel" 
                            style={{ padding: '32px', border: '1px solid #ffd70044', background: '#ffd70005', marginBottom: '32px' }}
                        >
                            <h3 style={{ fontSize: '12px', fontWeight: 900, letterSpacing: '2px', color: '#ffd700', marginBottom: '24px' }}>REPORT FINAL MATCH SCORE</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '32px', justifyContent: 'center' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '10px', opacity: 0.5, marginBottom: '8px' }}>{gameState.teamA}</div>
                                    <input 
                                        type="number" 
                                        value={scoreA}
                                        onChange={(e) => setScoreA(e.target.value)}
                                        style={{ width: '80px', height: '60px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', textAlign: 'center', fontSize: '24px', color: '#fff', fontWeight: 900 }}
                                    />
                                </div>
                                <div style={{ fontSize: '24px', fontWeight: 900, opacity: 0.2, marginTop: '20px' }}>VS</div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '10px', opacity: 0.5, marginBottom: '8px' }}>{gameState.teamB}</div>
                                    <input 
                                        type="number" 
                                        value={scoreB}
                                        onChange={(e) => setScoreB(e.target.value)}
                                        style={{ width: '80px', height: '60px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', textAlign: 'center', fontSize: '24px', color: '#fff', fontWeight: 900 }}
                                    />
                                </div>
                            </div>
                            <button 
                                onClick={async () => {
                                    setIsReporting(true);
                                    const winner = parseInt(scoreA) > parseInt(scoreB) ? 'A' : 'B';
                                    await reportResult(matchId, parseInt(scoreA), parseInt(scoreB), winner, key);
                                    setIsReporting(false);
                                }}
                                disabled={isReporting || scoreA === '' || scoreB === ''}
                                className="premium-button"
                                style={{ width: '100%', marginTop: '32px', height: '50px' }}
                            >
                                {isReporting ? 'UPLOADING...' : 'SUBMIT AUTHORITATIVE RESULT'}
                            </button>
                        </motion.div>
                    )}

                    {gameState.result_reported_at && (
                        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', marginBottom: '32px', border: '1px solid #00ff8844', background: '#00ff8805' }}>
                            <div style={{ fontSize: '10px', fontWeight: 900, color: '#00ff88', letterSpacing: '2px', marginBottom: '8px' }}>FINAL SCORE REPORTED</div>
                            <div style={{ fontSize: '24px', fontWeight: 900 }}>
                                {gameState.teamA} <span style={{ color: '#00ff88' }}>{gameState.score_a}</span> - <span style={{ color: '#00ff88' }}>{gameState.score_b}</span> {gameState.teamB}
                            </div>
                        </div>
                    )}

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
                
            </main>
            
            <Watermark branding={branding} />

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
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); borderRadius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--brand-primary, #00d4ff); }
                
                @keyframes teamPulse {
                    0%, 100% { border-left-color: ${gameTheme.primary} }
                    50% { border-left-color: rgba(255,255,255,0.1) }
                }
                @keyframes timerShake {
                    0%, 100% { transform: translateX(0) }
                    25% { transform: translateX(-3px) }
                    75% { transform: translateX(3px) }
                }
                @media (max-width: 1024px) {
                    .veto-header { flex-direction: column; gap: 20px; padding: 20px; }
                    .veto-header > div:nth-child(2) { order: -1; margin-bottom: 20px; }
                    .veto-header h2 { font-size: 2rem !important; }
                    .veto-header .glass-panel { width: 100px !important; height: 100px !important; padding: 12px !important; }
                    .veto-core-layout { grid-template-columns: 1fr !important; padding: 0 16px 40px !important; gap: 24px !important; }
                    .veto-core-layout aside { order: 2; }
                    .veto-core-layout section { order: 1; }
                    .room-status-bar { padding: 8px 16px !important; flex-direction: column; gap: 4px; align-items: center; text-align: center; }
                }
                @media (max-width: 480px) {
                    .veto-header h2 { font-size: 1.5rem !important; }
                    .veto-header { gap: 10px; }
                    .veto-header > div { gap: 15px !important; }
                }
            `}</style>
        </div>
    );
};

export default VetoRoom;
