import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { getMapImageUrl } from '../../utils/mapUtils';

const MapCard = React.memo(({ map, isInteractive, onClick, actionColor, logData, mapOrderLabel, styles = {} }) => {
    // 🛡️ ARCHITECTURE FIX: Memoize to prevent infinite dependency re-renders
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

    return (
        <motion.div 
            layout 
            layoutId={`map-${map.name}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
                opacity: 1, 
                scale: 1,
                filter: map.status === 'banned' ? 'grayscale(100%) brightness(0.4)' : 'grayscale(0%) brightness(1)',
            }}
            whileHover={map.status === 'available' && isInteractive ? { 
                scale: 1.04, 
                boxShadow: `0 0 20px ${actionColor || 'var(--brand-primary, #00d4ff)'}` 
            } : {}}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={onClick} 
            className={`map-card ${map.status}`}
            style={{
                ...styles.mapCard,
                position: 'relative',
                overflow: 'hidden',
                backgroundImage: imageFailed ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' : `linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%), url(${imageUrl})`,
                border: map.status === 'picked' 
                    ? `3px solid var(--brand-primary, #00d4ff)` 
                    : map.status === 'decider' 
                    ? '3px solid #ffaa00' 
                    : isInteractive 
                    ? `2px solid ${actionColor || 'rgba(255,255,255,0.2)'}` 
                    : '1px solid rgba(255,255,255,0.1)',
                cursor: (map.status === 'available' && isInteractive) ? 'pointer' : 'default',
                boxShadow: map.status === 'picked' 
                    ? `0 0 20px rgba(0, 212, 255, 0.4)` 
                    : map.status === 'decider' 
                    ? '0 0 20px rgba(255, 170, 0, 0.4)'
                    : '0 5px 15px rgba(0,0,0,0.5)'
            }}
        >
            {/* ── Banned X Overlay ── */}
            {map.status === 'banned' && (
                <div className="ban-overlay">
                    <svg viewBox="0 0 100 100" className="ban-x">
                        <line x1="10" y1="10" x2="90" y2="90" stroke="rgba(255,50,50,0.8)" strokeWidth="3" />
                        <line x1="90" y1="10" x2="10" y2="90" stroke="rgba(255,50,50,0.8)" strokeWidth="3" />
                    </svg>
                </div>
            )}

            {map.status === 'picked' && mapOrderLabel && <div style={styles.mapOrderBadge}>{mapOrderLabel}</div>}
            
            <div style={{...styles.cardContent, isolation: 'isolate'}}>
                <span style={{
                    ...styles.mapTitle, 
                    fontFamily: 'Rajdhani, sans-serif', 
                    fontWeight: 700, 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.08em'
                }}>
                    {map.name}
                </span>
                {map.status === 'banned' && <div style={styles.badgeBan}>BANNED BY {logData?.team || '...'}</div>}
                {map.status === 'picked' && <div style={styles.badgePick}>PICKED BY {logData?.team || '...'} <div style={styles.miniSideBadge}>{logData?.sideText || 'WAITING...'}</div></div>}
                {map.status === 'decider' && <div style={styles.badgeDecider}>DECIDER <div style={styles.miniSideBadge}>{logData?.sideText || 'WAITING FOR SIDE'}</div></div>}
            </div>

            <style>{`
                .map-card.decider {
                    animation: pulse-decider 2s infinite ease-in-out;
                }
                @keyframes pulse-decider {
                    0% { border-color: rgba(255, 170, 0, 0.4); box-shadow: 0 0 5px rgba(255, 170, 0, 0.2); }
                    50% { border-color: rgba(255, 170, 0, 1); box-shadow: 0 0 20px rgba(255, 170, 0, 0.6); }
                    100% { border-color: rgba(255, 170, 0, 0.4); box-shadow: 0 0 5px rgba(255, 170, 0, 0.2); }
                }
                .ban-overlay {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 5;
                    pointer-events: none;
                }
                .ban-x {
                    width: 60%;
                    height: 60%;
                    filter: drop-shadow(0 0 10px rgba(255,0,0,0.5));
                }
            `}</style>
        </motion.div>
    );
});

export default MapCard;
