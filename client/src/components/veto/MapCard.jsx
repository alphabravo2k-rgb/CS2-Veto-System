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
                scale: 1.05, 
                boxShadow: `0 0 30px ${actionColor || 'rgba(0, 212, 255, 0.4)'}` 
            } : {}}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={onClick} 
            className={`map-card glass-panel ${map.status}`}
            style={{
                position: 'relative',
                overflow: 'hidden',
                aspectRatio: '16/9',
                backgroundImage: imageFailed ? 'linear-gradient(135deg, #0a0f1e 0%, #16213e 100%)' : `linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.9) 100%), url(${imageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border: map.status === 'picked' 
                    ? `2px solid var(--brand-primary)` 
                    : map.status === 'decider' 
                    ? '2px solid #ffbb00' 
                    : isInteractive 
                    ? `1px solid ${actionColor || 'rgba(255,255,255,0.2)'}` 
                    : '1px solid rgba(255,255,255,0.05)',
                cursor: (map.status === 'available' && isInteractive) ? 'pointer' : 'default',
            }}
        >
            {/* ── BANNED OVERLAY ── */}
            {map.status === 'banned' && (
                <div className="ban-overlay">
                    <div style={{ transform: 'rotate(-45deg)', background: 'rgba(255, 75, 43, 0.9)', color: '#fff', padding: '4px 40px', fontWeight: 900, letterSpacing: '2px', fontSize: '0.7rem', filter: 'drop-shadow(0 0 10px rgba(255,75,43,0.5))' }}>BANNED</div>
                </div>
            )}

            {/* ── MAP ORDER BADGE ── */}
            {map.status === 'picked' && mapOrderLabel && (
                <div className="glass-panel" style={{ position: 'absolute', top: '10px', right: '10px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--brand-primary)', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', zIndex: 10 }}>
                    {mapOrderLabel}
                </div>
            )}
            
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '1.2rem', background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
                <span className={map.status === 'available' && isInteractive ? "neon-text" : ""} style={{
                    fontFamily: "'Outfit', sans-serif", 
                    fontWeight: 900, 
                    fontSize: '1.5rem',
                    textTransform: 'uppercase', 
                    letterSpacing: '2px',
                    color: '#fff'
                }}>
                    {map.name}
                </span>
                
                {map.status === 'picked' && (
                    <div style={{ color: 'var(--brand-primary)', fontSize: '0.65rem', fontWeight: 900, letterSpacing: '2px', marginTop: '4px' }}>
                        SECURED BY {logData?.team || 'OPPONENT'}
                    </div>
                )}
                
                {map.status === 'decider' && (
                    <div style={{ color: '#ffbb00', fontSize: '0.65rem', fontWeight: 900, letterSpacing: '2px', marginTop: '4px' }}>
                        CRITICAL: DECIDER MAP
                    </div>
                )}
            </div>

            <style>{`
                .map-card.decider {
                    animation: pulse-decider 2s infinite ease-in-out;
                }
                @keyframes pulse-decider {
                    0% { box-shadow: 0 0 5px rgba(255, 187, 0, 0.2); }
                    50% { box-shadow: 0 0 30px rgba(255, 187, 0, 0.5); }
                    100% { box-shadow: 0 0 5px rgba(255, 187, 0, 0.2); }
                }
                .ban-overlay {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 5;
                    background: rgba(0,0,0,0.4);
                }
            `}</style>
        </motion.div>
    );
});

export default MapCard;
