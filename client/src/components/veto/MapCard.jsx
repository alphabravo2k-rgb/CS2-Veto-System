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
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: map.status === 'banned' ? 0.3 : 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            whileHover={isInteractive ? { scale: 1.05, y: -5, boxShadow: `0 0 20px ${actionColor}` } : {}}
            transition={{ duration: 0.3 }}
            onClick={onClick} 
            style={{
                ...styles.mapCard,
                backgroundImage: imageFailed ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' : `linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%), url(${imageUrl})`,
                filter: map.status === 'banned' ? 'grayscale(100%)' : 'none',
                border: map.status === 'picked' ? '3px solid #00ff00' : map.status === 'decider' ? '3px solid #ffa500' : isInteractive ? `2px solid ${actionColor}` : '1px solid rgba(255,255,255,0.1)',
                cursor: (map.status === 'available' && isInteractive) ? 'pointer' : 'default',
                boxShadow: '0 5px 15px rgba(0,0,0,0.5)'
            }}
        >
            {map.status === 'picked' && mapOrderLabel && <div style={styles.mapOrderBadge}>{mapOrderLabel}</div>}
            <div style={styles.cardContent}>
                <span style={styles.mapTitle}>{map.name}</span>
                {map.status === 'banned' && <div style={styles.badgeBan}>BANNED BY {logData?.team || '...'}</div>}
                {map.status === 'picked' && <div style={styles.badgePick}>PICKED BY {logData?.team || '...'} <div style={styles.miniSideBadge}>{logData?.sideText || 'WAITING...'}</div></div>}
                {map.status === 'decider' && <div style={styles.badgeDecider}>DECIDER <div style={styles.miniSideBadge}>{logData?.sideText || 'WAITING FOR SIDE'}</div></div>}
            </div>
        </motion.div>
    );
});

export default MapCard;
