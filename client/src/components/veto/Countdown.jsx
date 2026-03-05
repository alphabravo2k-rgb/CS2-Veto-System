import React, { useState, useEffect, useRef } from 'react';

const Countdown = ({ endsAt, soundEnabled = false, playSound }) => {
    const [timeLeft, setTimeLeft] = useState(0);
    const prevTimeRef = useRef(null);

    useEffect(() => {
        if (!endsAt) { prevTimeRef.current = null; return; }
        const endsAtTime = typeof endsAt === 'number' ? endsAt : new Date(endsAt).getTime();
        const initialTimeLeft = Math.max(0, Math.floor((endsAtTime - Date.now()) / 1000));
        prevTimeRef.current = initialTimeLeft;
        setTimeLeft(initialTimeLeft);

        const interval = setInterval(() => {
            const diff = Math.max(0, Math.floor((endsAtTime - Date.now()) / 1000));
            if (soundEnabled && prevTimeRef.current !== null && diff <= 10 && diff >= 0 && diff < prevTimeRef.current) {
                if (playSound) playSound('countdown');
            }
            prevTimeRef.current = diff;
            setTimeLeft(diff);
        }, 1000);
        return () => clearInterval(interval);
    }, [endsAt, soundEnabled, playSound]);

    if (!endsAt || timeLeft <= 0) return null;
    return <span style={{ color: timeLeft < 10 ? '#ff4444' : '#00d4ff', fontWeight: 'bold', marginLeft: '10px' }}>({timeLeft}s)</span>;
};

export default Countdown;
