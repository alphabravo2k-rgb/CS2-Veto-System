import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useVetoStore from '../store/useVetoStore';
import useOrgBranding from '../hooks/useOrgBranding';
import MapCard from '../components/veto/MapCard';
import CoinFlipOverlay from '../components/veto/CoinFlipOverlay';
import LogLineRenderer from '../components/veto/LogLineRenderer';
import Countdown from '../components/veto/Countdown';
import { AnimatedBackground, HomeIcon, CheckIcon } from '../components/SharedUI';

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
            <div className="loading-screen">
                <AnimatedBackground />
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="loading-content"
                >
                    <div className="spinner-large" />
                    <h2 className="loading-text">INITIALIZING VETO STREAM...</h2>
                    {serverError && <p className="error-text">{serverError}</p>}
                </motion.div>
            </div>
        );
    }

    return (
        <div className="veto-room-page">
            <AnimatedBackground />

            {/* ── Status Bar ── */}
            <div className="room-status-bar">
                <div className="spectator-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    <span>{roomUserCount} VIEWERS</span>
                </div>
                <div className={`connection-status ${isConnected ? 'online' : 'reconnecting'}`}>
                    {isConnected ? 'LIVE' : 'RECONNECTING...'}
                </div>
            </div>

            {/* ── Match Header ── */}
            <header className="match-header">
                <div className={`team-block team-a ${gameState.sequence[gameState.step]?.t === 'A' ? 'active-turn' : ''}`}>
                    <div className="team-logo-wrapper">
                        <img src={gameState.teamALogo || 'https://via.placeholder.com/100'} alt={gameState.teamA} />
                    </div>
                    <div className="team-info">
                        <h2 className="team-name">{gameState.teamA}</h2>
                        {gameState.ready?.A ? <span className="ready-tag">READY</span> : <span className="waiting-tag">WAITING</span>}
                    </div>
                </div>

                <div className="match-center">
                    <div className="vs-label">VS</div>
                    <div className="format-badge">{gameState.format.toUpperCase()}</div>
                    {gameState.useTimer && !gameState.finished && (
                        <div className={`timer-wrapper ${gameState.timerEndsAt && (new Date(gameState.timerEndsAt) - new Date() < 5000) ? 'emergency-shake' : ''}`}>
                            <Countdown target={gameState.timerEndsAt} key={gameState.step} />
                        </div>
                    )}
                </div>

                <div className={`team-block team-b ${gameState.sequence[gameState.step]?.t === 'B' ? 'active-turn' : ''}`}>
                    <div className="team-info">
                        <h2 className="team-name">{gameState.teamB}</h2>
                        {gameState.ready?.B ? <span className="ready-tag">READY</span> : <span className="waiting-tag">WAITING</span>}
                    </div>
                    <div className="team-logo-wrapper">
                        <img src={gameState.teamBLogo || 'https://via.placeholder.com/100'} alt={gameState.teamB} />
                    </div>
                </div>
            </header>

            {/* ── Main Layout ── */}
            <main className="room-layout">
                {/* ── Left Sidebar: Logs & Controls ── */}
                <aside className="room-sidebar">
                    <div className="action-card">
                        <h4 className="card-title">MATCH LOG</h4>
                        <div className="log-container" ref={logContainerRef}>
                            <AnimatePresence initial={false}>
                                {gameState.logs.slice(-8).map((log, idx) => (
                                    <motion.div 
                                        key={`${idx}-${log}`}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="log-item-wrapper"
                                    >
                                        <LogLineRenderer log={log} teamA={gameState.teamA} teamB={gameState.teamB} />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>

                    {!gameState.finished && (
                        <div className="action-card controls">
                            <h4 className="card-title">CONTROLS</h4>
                            <div className="controls-stack">
                                {myRole && !gameState.ready?.[myRole] && (
                                    <button className="btn-primary ready-btn" onClick={() => sendReady(matchId, key)}>
                                        I AM READY
                                    </button>
                                )}
                                <button className="btn-secondary share-btn" onClick={copyInvite}>
                                    INVITE PLAYERS
                                </button>
                                {myRole === 'admin' && (
                                    <button className="btn-danger-outline" onClick={() => navigate('/admin')}>
                                        ADMIN OVERRIDE
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </aside>

                {/* ── Center Map Grid ── */}
                <section className="map-grid-section">
                    <div className="step-indicator">
                        {gameState.finished ? (
                            <span className="veto-complete">VETO COMPLETE</span>
                        ) : (
                            <>
                                <span className="current-step-label">NEXT ACTION:</span>
                                <span className="current-step-value" style={{ color: currentActionColor }}>
                                    {gameState.sequence[gameState.step]?.t} {gameState.sequence[gameState.step]?.a.toUpperCase()}
                                </span>
                            </>
                        )}
                    </div>

                    <div className="map-grid">
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

            {/* ── Overlays ── */}
            {gameState.useCoinFlip && (
                <CoinFlipOverlay 
                    gameState={gameState} 
                    myRole={myRole} 
                    onCall={(call) => sendCoinCall(matchId, call, key)}
                    onDecide={(decision) => sendCoinDecide(matchId, decision, key)}
                />
            )}

            {/* ── Toasts ── */}
            <AnimatePresence>
                {!isConnected && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="connection-toast"
                    >
                        <RefreshIcon /> Connection lost — reconnecting...
                    </motion.div>
                )}

                {showCopyNotify && (
                    <motion.div 
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="copy-toast"
                    >
                        <CheckIcon /> LINK COPIED
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .veto-room-page { min-height: 100vh; background: #050a14; color: #fff; font-family: 'Rajdhani', sans-serif; position: relative; }
                .room-status-bar { display: flex; justify-content: space-between; padding: 8px 24px; font-size: 11px; font-weight: 700; background: rgba(0,0,0,0.3); border-bottom: 1px solid rgba(255,255,255,0.05); }
                .spectator-badge { display: flex; align-items: center; gap: 6px; color: rgba(255,255,255,0.5); }
                .connection-status.online { color: #00ff00; }
                .connection-status.reconnecting { color: #ffaa00; animation: blink 1s infinite; }
                .connection-toast { position: fixed; top: 10px; left: 50%; transform: translateX(-50%); background: #ffaa00; color: #000; padding: 8px 20px; border-radius: 4px; font-weight: 700; z-index: 2000; display: flex; align-items: center; gap: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.4); }

                .match-header { display: flex; align-items: center; justify-content: center; padding: 40px 24px; gap: 60px; }
                .team-block { display: flex; align-items: center; gap: 24px; transition: all 0.3s ease; }
                .team-block.active-turn { transform: scale(1.05); }
                .team-block.active-turn .team-logo-wrapper { border-color: var(--brand-primary, #00d4ff); box-shadow: 0 0 30px rgba(0, 212, 255, 0.4); animation: border-pulse 2s infinite; }
                .team-logo-wrapper { width: 100px; height: 100px; border: 3px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 10px; background: rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; }
                .team-logo-wrapper img { max-width: 100%; max-height: 100%; object-fit: contain; }
                .team-name { font-size: 2.5rem; font-weight: 800; margin: 0; }
                .ready-tag { font-size: 12px; color: #00ff00; background: rgba(0,255,0,0.1); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(0,255,0,0.3); }

                .match-center { display: flex; flex-direction: column; align-items: center; gap: 12px; }
                .vs-label { font-size: 1.5rem; font-weight: 900; color: rgba(255,255,255,0.2); }
                .format-badge { background: #fff; color: #000; padding: 2px 12px; font-weight: 800; border-radius: 4px; font-size: 14px; }
                .timer-wrapper { font-size: 3rem; font-weight: 800; }
                .emergency-shake { animation: shake 0.1s infinite; color: #ff4444; }

                .room-layout { display: grid; grid-template-columns: 350px 1fr; gap: 32px; max-width: 1600px; margin: 0 auto; padding: 0 32px 64px; }
                .action-card { background: rgba(15, 20, 35, 0.6); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 24px; margin-bottom: 24px; }
                .card-title { font-size: 12px; color: rgba(255,255,255,0.4); margin: 0 0 16px 0; letter-spacing: 0.2em; font-weight: 700; }
                .log-container { max-height: 400px; overflow-y: auto; scrollbar-width: none; }
                .log-item-wrapper { margin-bottom: 8px; }
                .controls-stack { display: flex; flex-direction: column; gap: 12px; }
                .btn-primary { width: 100%; background: var(--brand-primary, #00d4ff); color: #000; border: none; padding: 12px; border-radius: 6px; font-weight: 700; cursor: pointer; }
                .btn-secondary { width: 100%; background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.1); padding: 12px; border-radius: 6px; font-weight: 700; cursor: pointer; }

                .map-grid-section { display: flex; flex-direction: column; gap: 24px; }
                .step-indicator { background: rgba(0,0,0,0.3); padding: 12px 24px; border-radius: 8px; display: flex; align-items: center; gap: 12px; font-weight: 700; }
                .map-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }

                .copy-toast { position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%); background: #00ff00; color: #000; padding: 12px 24px; border-radius: 50px; font-weight: 800; display: flex; align-items: center; gap: 10px; z-index: 2000; }

                @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                @keyframes border-pulse { 0% { border-color: rgba(0,212,255,0.3); } 50% { border-color: rgba(0,212,255,1); } 100% { border-color: rgba(0,212,255,0.3); } }
                @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-2px); } 75% { transform: translateX(2px); } }
            `}</style>
        </div>
    );
};

export default VetoRoom;

