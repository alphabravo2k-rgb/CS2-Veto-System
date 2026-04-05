import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { getMapImageUrl } from '../../utils/mapUtils';

const MapCard = React.memo(({ map, isInteractive, onClick, actionColor, logData, mapOrderLabel, styles = {} }) => {
    const mapImageUrls = useMemo(() => getMapImageUrl(map.name, map.customImage), [map.name, map.customImage]);
    const [imageUrl, setImageUrl] = useState(mapImageUrls.primary);
    const [imageFailed, setImageFailed] = useState(false);

    useEffect(() => {
        if (map.customImage) return;
        let testImage = new Image(); 
        let currentIndex = 0; 
        let timer = null;
        const allUrls = [mapImageUrls.primary, ...mapImageUrls.fallbacks]; 

        const tryNextUrl = () => {
            if (currentIndex >= allUrls.length) { setImageFailed(true); return; }
            timer = setTimeout(() => {
                testImage.onload = null; testImage.onerror = null;
                currentIndex++; tryNextUrl();
            }, 3000);
            testImage.src = allUrls[currentIndex];
        };

        testImage.onload = () => { clearTimeout(timer); setImageUrl(allUrls[currentIndex]); setImageFailed(false); };
        testImage.onerror = () => { clearTimeout(timer); currentIndex++; tryNextUrl(); };
        tryNextUrl();

        return () => { clearTimeout(timer); testImage.onload = null; testImage.onerror = null; };
    }, [map.name, map.customImage, mapImageUrls]); 

    // Determine variant styling
    const isBanned = map.status === 'banned';
    const isPicked = map.status === 'picked';
    const isDecider = map.status === 'decider';
    const isAvailable = map.status === 'available';

    const cardStyles = {
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        maxWidth: '140px',
        minWidth: '100px',
        aspectRatio: '16/9',
        borderRadius: '8px',
        cursor: (isAvailable && isInteractive) ? 'pointer' : 'default',
        backgroundImage: imageFailed ? 'linear-gradient(135deg, #0a0f1e 0%, #16213e 100%)' : `url(${imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: isBanned ? 'grayscale(100%) brightness(0.35)' : 'none',
        border: isPicked ? '2px solid var(--brand-primary, #00d4ff)' : isDecider ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.05)',
        boxShadow: isPicked ? '0 0 16px rgba(0,212,255,0.35)' : 'none',
        transition: 'border-color 180ms ease, box-shadow 180ms ease, filter 180ms ease',
        ...styles,
    };

    return (
        <motion.div 
            layout 
            layoutId={`map-${map.name}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={(isAvailable && isInteractive) ? { 
                scale: 1.04, 
                borderColor: actionColor || 'rgba(255,255,255,0.4)',
                boxShadow: `0 0 15px ${actionColor || 'rgba(255,255,255,0.2)'}`
            } : {}}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={onClick} 
            className={`map-card ${map.status}`}
            style={cardStyles}
        >
            {/* 1. BANNED STATE */}
            {isBanned && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(220,38,38,0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
                        <line x1="0" y1="0" x2="100%" y2="100%" stroke="#dc2626" strokeWidth="2" opacity="0.7" />
                        <line x1="100%" y1="0" x2="0" y2="100%" stroke="#dc2626" strokeWidth="2" opacity="0.7" />
                    </svg>
                    <div style={{ position: 'absolute', bottom: '8px', background: 'rgba(0,0,0,0.7)', color: '#dc2626', padding: '2px 8px', fontFamily: 'Rajdhani', fontSize: '10px', letterSpacing: '0.15em', fontWeight: 700 }}>
                        BANNED
                    </div>
                </div>
            )}

            {/* 2. PICKED STATE */}
            {isPicked && (
                <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', color: 'var(--brand-primary, #00d4ff)', fontFamily: 'Rajdhani', fontSize: '10px', letterSpacing: '0.15em', fontWeight: 700, background: 'rgba(0,0,0,0.7)', padding: '2px 8px', borderRadius: '4px', zIndex: 10 }}>
                    PICKED {mapOrderLabel ? `[${mapOrderLabel}]` : ''}
                </div>
            )}

            {/* 3. DECIDER STATE */}
            {isDecider && (
                <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.7)', padding: '2px 8px', borderRadius: '4px', zIndex: 10 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '2px' }}>
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                    <span style={{ color: '#f59e0b', fontFamily: 'Rajdhani', fontSize: '10px', letterSpacing: '0.15em', fontWeight: 700 }}>DECIDER</span>
                </div>
            )}

            {/* MAP NAME OVERLAY */}
            {!isBanned && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 8px 10px', background: 'linear-gradient(transparent, rgba(0,0,0,0.85))', display: 'flex', justifyContent: 'center' }}>
                    <span style={{
                        fontFamily: 'Rajdhani, sans-serif', 
                        fontWeight: 700, 
                        fontSize: '14px',
                        textTransform: 'uppercase', 
                        letterSpacing: '0.1em',
                        color: '#fff',
                        textShadow: '0px 2px 4px rgba(0,0,0,0.8)'
                    }}>
                        {map.name}
                    </span>
                </div>
            )}

            <style>{`
                .map-card.decider {
                    animation: deciderPulse 2s ease-in-out infinite;
                }
                @keyframes deciderPulse {
                    0%, 100% { box-shadow: 0 0 8px rgba(245,158,11,0.4); }
                    50% { box-shadow: 0 0 24px rgba(245,158,11,0.9); }
                }
            `}</style>
        </motion.div>
    );
});

export default MapCard;
