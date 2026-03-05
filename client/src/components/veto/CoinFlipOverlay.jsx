import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const CoinFlipOverlay = React.memo(({ gameState, myRole, onCall, onDecide, soundEnabled, playSound }) => {
    const [isFlipping, setIsFlipping] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const [flipAnimation, setFlipAnimation] = useState(null);
    const soundIntervalRef = useRef(null);

    useEffect(() => {
        if (gameState.coinFlip.result && gameState.coinFlip.status === 'deciding') {
            const randomRotations = Math.floor(Math.random() * 1800) + 1800; 
            const randomDuration = (Math.random() * 1.5) + 2.5; 
            
            setFlipAnimation({ rotations: randomRotations, duration: randomDuration });
            setIsFlipping(true);

            if (soundEnabled && playSound) {
                playSound('coin');
                soundIntervalRef.current = setInterval(() => playSound('coinLoop'), 150);
            }

            setTimeout(() => {
                if (soundIntervalRef.current) { clearInterval(soundIntervalRef.current); soundIntervalRef.current = null; }
                setIsFlipping(false); setShowResult(true);
            }, randomDuration * 1000);
        }
        return () => { if (soundIntervalRef.current) clearInterval(soundIntervalRef.current); };
    }, [gameState.coinFlip.result, gameState.coinFlip.status, soundEnabled, playSound]);

    const isCaller = myRole === 'A';
    const isWinner = myRole === gameState.coinFlip.winner;

    return (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#1e293b', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}
        >
            <style>
                {flipAnimation && `
                    @keyframes coinFlip3D {
                        0% { transform: rotateY(0deg) scale(1); filter: brightness(1); }
                        50% { transform: rotateY(${flipAnimation.rotations / 2}deg) scale(1.5); filter: brightness(1.5); }
                        100% { transform: rotateY(${flipAnimation.rotations}deg) scale(1); filter: brightness(1); }
                    }
                    .coin-3d { animation: coinFlip3D ${flipAnimation.duration}s cubic-bezier(0.4, 0.0, 0.2, 1) forwards; }
                `}
            </style>
            <h1 style={{ color: '#ffd700', fontSize: '3rem', marginBottom: '30px', textShadow: '0 0 20px #ffd700', fontFamily: "'Rajdhani', sans-serif" }}>COIN TOSS</h1>

            {gameState.coinFlip.status === 'waiting_call' && (
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{ color: '#fff', marginBottom: '20px', fontFamily: "'Rajdhani', sans-serif" }}>{isCaller ? "CALL THE TOSS" : `WAITING FOR ${gameState.teamA}...`}</h2>
                    {isCaller && (
                        <div style={{ display: 'flex', gap: '20px' }}>
                            <button onClick={() => onCall('heads')} style={{ padding: '20px 40px', fontSize: '1.5rem', background: 'transparent', border: '2px solid #ffd700', color: '#ffd700', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontFamily: "'Rajdhani', sans-serif" }}>HEADS</button>
                            <button onClick={() => onCall('tails')} style={{ padding: '20px 40px', fontSize: '1.5rem', background: 'transparent', border: '2px solid #fff', color: '#fff', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontFamily: "'Rajdhani', sans-serif" }}>TAILS</button>
                        </div>
                    )}
                </div>
            )}

            {(isFlipping || showResult) && (
                <div style={{ perspective: '2000px', marginBottom: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div className={isFlipping ? 'coin-3d' : ''} style={{ width: '180px', height: '180px', borderRadius: '50%', border: '6px solid rgba(255, 255, 255, 0.9)', background: gameState.coinFlip.result === 'heads' ? '#ffd700' : '#cbd5e1', marginBottom: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '5rem', fontWeight: '900', color: '#fff', fontFamily: "'Rajdhani', sans-serif" }}>
                        {isFlipping ? '?' : (gameState.coinFlip.result === 'heads' ? 'H' : 'T')}
                    </div>
                    {!isFlipping && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ background: '#fff', color: '#000', padding: '12px 45px', borderRadius: '50px', fontSize: '2.2rem', fontWeight: '900' }}>{gameState.coinFlip.result}</motion.div>}
                </div>
            )}

            {showResult && gameState.coinFlip.status === 'deciding' && (
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{ color: '#00ff00', fontSize: '2rem', marginBottom: '10px', fontFamily: "'Rajdhani', sans-serif" }}>{gameState.coinFlip.winner === 'A' ? gameState.teamA : gameState.teamB} WON!</h2>
                    <h3 style={{ color: '#aaa', marginBottom: '20px', fontFamily: "'Rajdhani', sans-serif" }}>{isWinner ? "CHOOSE WHO BANS FIRST" : "WAITING FOR DECISION..."}</h3>
                    {isWinner && (
                        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                            <button onClick={() => onDecide('first')} style={{ padding: '15px 30px', background: '#00d4ff', border: 'none', color: '#000', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontFamily: "'Rajdhani', sans-serif" }}>WE START</button>
                            <button onClick={() => onDecide('second')} style={{ padding: '15px 30px', background: '#ff0055', border: 'none', color: '#fff', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontFamily: "'Rajdhani', sans-serif" }}>THEY START</button>
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    );
});

export default CoinFlipOverlay;
