import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useVetoStore from '../store/useVetoStore';
import MapCard from '../components/veto/MapCard';
import CoinFlipOverlay from '../components/veto/CoinFlipOverlay';
import Countdown from '../components/veto/Countdown';
import { NeonText, GlassPanel, ScanlineOverlay } from '../components/veto/VetoUIPrimitives';

/**
 * ⚡ UI LAYER — STREAM OVERLAY MODE
 * =============================================================================
 * Responsibility: High-contrast, minimalist veto view for OBS browser sources.
 * Features: Chromakey-friendly, no background, maximized readability.
 * =============================================================================
 */
const StreamOverlay = () => {
    const { matchId } = useParams();
    const location = useLocation();
    const query = new URLSearchParams(location.search);
    const key = query.get('key');

    const { 
        gameState, 
        connectToRoom, 
        disconnectRoom 
    } = useVetoStore();

    useEffect(() => {
        if (matchId) connectToRoom(matchId, key);
        return () => disconnectRoom();
    }, [matchId, key, connectToRoom, disconnectRoom]);

    if (!gameState) return null;

    return (
        <div className="stream-overlay" style={{ 
            width: '1920px', height: '1080px', 
            background: 'transparent', // Crucial for OBS
            overflow: 'hidden', 
            fontFamily: 'Rajdhani',
            position: 'relative'
        }}>
            <ScanlineOverlay />

            {/* Header: Teams and Timer */}
            <div style={{ 
                position: 'absolute', top: '40px', left: '0', right: '0', 
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '80px' 
            }}>
                <div style={{ textAlign: 'right' }}>
                    <h2 style={{ fontSize: '3rem', fontWeight: 900, margin: 0, color: '#fff' }}>{gameState.teamA}</h2>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '4px 16px', border: '1px solid #00d4ff', color: '#00d4ff', fontSize: '14px', fontWeight: 900 }}>
                        {gameState.format.toUpperCase()}
                    </div>
                    {gameState.useTimer && !gameState.finished && (
                        <div style={{ fontSize: '3rem', fontWeight: 900, color: '#fff' }}>
                            <Countdown target={gameState.timerEndsAt} />
                        </div>
                    )}
                </div>

                <div style={{ textAlign: 'left' }}>
                    <h2 style={{ fontSize: '3rem', fontWeight: 900, margin: 0, color: '#fff' }}>{gameState.teamB}</h2>
                </div>
            </div>

            {/* Main: Map Grid */}
            <div style={{ 
                position: 'absolute', top: '250px', left: '100px', right: '100px', 
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                gap: '20px' 
            }}>
                <AnimatePresence mode="popLayout">
                    {gameState.maps.map((m, index) => {
                        const pickIndex = gameState.logs.filter(l => l.includes('[PICK]')).findIndex(l => l.includes(m.name));
                        return (
                            <motion.div
                                key={m.name}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                            >
                                <MapCard 
                                    map={m}
                                    isInteractive={false}
                                    mapOrderLabel={pickIndex !== -1 ? (pickIndex + 1).toString() : null}
                                />
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Footer: Phase Status */}
            <div style={{ 
                position: 'absolute', bottom: '60px', left: '0', right: '0', 
                textAlign: 'center' 
            }}>
                <NeonText fontSize="2.5rem">
                    {gameState.finished ? 'MATCH READY' : `${gameState.sequence[gameState.step]?.t} / ${gameState.sequence[gameState.step]?.a.toUpperCase()}`}
                </NeonText>
            </div>

            {/* Coin Flip Overlay */}
            {gameState.useCoinFlip && (
                <CoinFlipOverlay gameState={gameState} myRole="viewer" />
            )}

            <style>{`
                body { background: transparent !important; }
                .map-card { transform: scale(0.9); }
            `}</style>
        </div>
    );
};

export default StreamOverlay;
