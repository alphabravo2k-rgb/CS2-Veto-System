import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useVetoStore from '../store/useVetoStore';
import MapCard from '../components/veto/MapCard';
import Countdown from '../components/veto/Countdown';
import AudioService from '../services/AudioService';
import { NeonText, ScanlineOverlay } from '../components/veto/VetoUIPrimitives';

/**
 * ⚡ UI LAYER — CINEMATIC STREAM OVERLAY
 * =============================================================================
 * Responsibility: Premium, high-fidelity broadcast overlay for OBS.
 * Features: Map reveal animations, audio cues, branding integration.
 * =============================================================================
 */
const StreamOverlay = () => {
    const { matchId } = useParams();
    const location = useLocation();
    const query = new URLSearchParams(location.search);
    const key = query.get('key');
    const isMinimal = query.get('mode') === 'minimal';

    const { gameState, branding, connectToRoom, disconnectRoom } = useVetoStore();
    const [lastStep, setLastStep] = useState(-1);
    const [revealMap, setRevealMap] = useState(null);
    const primaryColor = branding?.primary_color || '#00d4ff';

    useEffect(() => {
        if (matchId) connectToRoom(matchId, key);
        return () => disconnectRoom();
    }, [matchId, key, connectToRoom, disconnectRoom]);

    // Handle Cinematic Reveals & Audio
    useEffect(() => {
        if (!gameState) return;
        
        if (gameState.step > lastStep && lastStep !== -1) {
            const lastAction = gameState.sequence[gameState.step - 1];
            const lastMapName = gameState.logs[gameState.logs.length - 1]?.split(']').pop()?.trim();
            const mapObj = gameState.maps.find(m => m.name === lastMapName);

            if (lastAction && mapObj) {
                // Play Sound
                if (lastAction.a === 'ban') AudioService.play('BAN');
                else if (lastAction.a === 'pick') AudioService.play('PICK');
                
                // Trigger Reveal
                setRevealMap({ ...mapObj, action: lastAction.a });
                setTimeout(() => setRevealMap(null), 3000);
            }
            
            if (gameState.finished) AudioService.play('FINISH');
        }
        setLastStep(gameState.step);
    }, [gameState?.step, gameState?.finished]);

    if (!gameState) return null;

    if (isMinimal) return <MinimalScorebug gameState={gameState} primaryColor={primaryColor} />;

    return (
        <div className="stream-overlay-container" style={{ 
            width: '100vw', height: '100vh',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', overflow: 'hidden'
        }}>
            <div className="stream-overlay" style={{ 
                width: '1920px', height: '1080px', 
                background: 'transparent',
                overflow: 'hidden', 
                fontFamily: 'Rajdhani',
                position: 'relative',
                color: '#fff',
                transform: 'scale(var(--overlay-scale, 1))',
                transformOrigin: 'center center'
            }}>
                <ScanlineOverlay />

            {/* Header: Team Bars */}
            <div style={{ 
                position: 'absolute', top: '40px', left: '0', right: '0', 
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0' 
            }}>
                <TeamBar team={gameState.teamA} side="left" color={primaryColor} />
                <div style={{ width: '200px', textAlign: 'center', zIndex: 10 }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: primaryColor, letterSpacing: '4px' }}>VS</div>
                    {gameState.useTimer && !gameState.finished && (
                        <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>
                            <Countdown target={gameState.timerEndsAt} />
                        </div>
                    )}
                </div>
                <TeamBar team={gameState.teamB} side="right" color={primaryColor} />
            </div>

            {/* Main: Cinematic Map Strip */}
            <div style={{ 
                position: 'absolute', bottom: '150px', left: '50px', right: '50px', 
                display: 'flex', justifyContent: 'center', gap: '20px' 
            }}>
                <AnimatePresence>
                    {gameState.maps.map((m, index) => {
                        const log = gameState.logs.find(l => l.includes(m.name));
                        const isPicked = log?.includes('[PICK]');
                        const isBanned = log?.includes('[BAN]');
                        const pickOrder = gameState.logs.filter(l => l.includes('[PICK]')).findIndex(l => l.includes(m.name)) + 1;

                        return (
                            <motion.div
                                key={m.name}
                                initial={{ y: 50, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: index * 0.05 }}
                                style={{ width: '220px' }}
                            >
                                <MapCard 
                                    map={m}
                                    isInteractive={false}
                                    mapOrderLabel={isPicked ? `PICK ${pickOrder}` : null}
                                />
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Status Footer */}
            <div style={{ position: 'absolute', bottom: '60px', width: '100%', textAlign: 'center' }}>
                <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                >
                    <NeonText fontSize="3rem" color={primaryColor}>
                        {gameState.finished ? 'MATCH READY' : `${gameState.sequence[gameState.step]?.t} ${gameState.sequence[gameState.step]?.a.toUpperCase()}ING...`}
                    </NeonText>
                </motion.div>
            </div>

            {/* CINEMATIC REVEAL OVERLAY */}
            <AnimatePresence>
                {revealMap && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', inset: 0, 
                            background: 'rgba(0,0,0,0.9)', 
                            display: 'flex', flexDirection: 'column', 
                            alignItems: 'center', justifyContent: 'center',
                            zIndex: 1000,
                            backdropFilter: 'blur(20px)'
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.5, y: 100 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 1.5, opacity: 0 }}
                            style={{ textAlign: 'center' }}
                        >
                            <h1 style={{ fontSize: '120px', fontWeight: 900, margin: 0, color: revealMap.action === 'ban' ? '#ff4444' : primaryColor }}>
                                {revealMap.action.toUpperCase()}ED
                            </h1>
                            <div style={{ fontSize: '60px', fontWeight: 900, marginTop: '-20px', textTransform: 'uppercase' }}>
                                {revealMap.name}
                            </div>
                            <img src={revealMap.image} alt={revealMap.name} style={{ width: '800px', height: '450px', objectFit: 'cover', marginTop: '40px', border: `4px solid ${revealMap.action === 'ban' ? '#ff4444' : primaryColor}` }} />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                body { background: transparent !important; margin: 0; padding: 0; }
                :root { --overlay-scale: min(calc(100vw / 1920), calc(100vh / 1080)); }
                .map-card { transform: scale(0.85); transition: all 0.3s ease; }
                .map-card.banned { filter: grayscale(1) brightness(0.5); transform: scale(0.8) translateY(20px); }
                .map-card.picked { border: 2px solid ${primaryColor}; transform: scale(0.9) translateY(-10px); }
            `}</style>
            </div>
        </div>
    );
};

const TeamBar = ({ team, side, color }) => (
    <div style={{ 
        width: '600px', height: '80px', 
        background: `linear-gradient(${side === 'left' ? '90deg' : '270deg'}, ${color}44, transparent)`,
        borderLeft: side === 'left' ? `8px solid ${color}` : 'none',
        borderRight: side === 'right' ? `8px solid ${color}` : 'none',
        display: 'flex', alignItems: 'center',
        justifyContent: side === 'left' ? 'flex-end' : 'flex-start',
        padding: '0 40px',
        clipPath: side === 'left' ? 'polygon(0 0, 100% 0, 95% 100%, 0% 100%)' : 'polygon(5% 0, 100% 0, 100% 100%, 0% 100%)'
    }}>
        <span style={{ fontSize: '2.5rem', fontWeight: 900, textTransform: 'uppercase' }}>{team}</span>
    </div>
);

const MinimalScorebug = ({ gameState, primaryColor }) => (
    <div style={{ position: 'absolute', top: '20px', left: '20px', background: 'rgba(0,0,0,0.8)', borderLeft: `4px solid ${primaryColor}`, padding: '10px 20px', display: 'flex', gap: '20px', alignItems: 'center', fontFamily: 'Rajdhani', color: '#fff' }}>
        <div style={{ fontWeight: 900 }}>{gameState.teamA} vs {gameState.teamB}</div>
        <div style={{ color: primaryColor, fontWeight: 900 }}>{gameState.format.toUpperCase()}</div>
        {gameState.useTimer && !gameState.finished && <Countdown target={gameState.timerEndsAt} />}
    </div>
);

export default StreamOverlay;
