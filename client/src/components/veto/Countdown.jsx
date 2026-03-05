import React, { useState, useEffect, useRef } from 'react';

const Countdown = ({ endsAt, soundEnabled = false, playSound }) => {
    const [timeLeft, setTimeLeft] = useState(0);
    const prevTimeRef = useRef(null);
    
    // 🛡️ PERFORMANCE FIX: Stabilize playSound reference so the timer interval never resets and jumps
    const playSoundRef = useRef(playSound);
    useEffect(() => { playSoundRef.current = playSound; }, [playSound]);

    useEffect(() => {
        if (!endsAt) { prevTimeRef.current = null; return; }
        
        const endsAtTime = typeof endsAt === 'number' ? endsAt : new Date(endsAt).getTime();
        const initialTimeLeft = Math.max(0, Math.floor((endsAtTime - Date.now()) / 1000));
        prevTimeRef.current = initialTimeLeft;
        setTimeLeft(initialTimeLeft);

        const interval = setInterval(() => {
            // Recalculates from Date.now() every tick to prevent JS thread drift
            const diff = Math.max(0, Math.floor((endsAtTime - Date.now()) / 1000));
            
            if (soundEnabled && prevTimeRef.current !== null && diff <= 10 && diff >= 0 && diff < prevTimeRef.current) {
                if (playSoundRef.current) playSoundRef.current('countdown');
            }
            
            prevTimeRef.current = diff;
            setTimeLeft(diff);
        }, 1000);
        
        return () => clearInterval(interval);
    }, [endsAt, soundEnabled]); // Removed playSound from dependencies to prevent stuttering

    if (!endsAt || timeLeft <= 0) return null;
    
    return (
        <span style={{ color: timeLeft < 10 ? '#ff4444' : '#00d4ff', fontWeight: 'bold', marginLeft: '10px' }}>
            ({timeLeft}s)
        </span>
    );
};

export default Countdown;
