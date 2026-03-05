import React from 'react';
import { motion } from 'framer-motion';

const LogLineRenderer = React.memo(({ log, teamA, teamB }) => {
    const splitIndex = log.indexOf('(');
    let mainPart = log;
    let sidePart = "";

    if (splitIndex !== -1) {
        mainPart = log.substring(0, splitIndex).trim();
        sidePart = log.substring(splitIndex).trim();
    }

    const renderWord = (word, i) => {
        // 🛡️ LOGIC FIX: Explicit priority returns to prevent color overlap bugs
        if (word.includes('[BAN]') || word.includes('[AUTO-BAN]')) return <span key={i} style={{ color: '#ff4444', fontWeight: 'bold' }}>{word} </span>;
        if (word.includes('[PICK]') || word.includes('[AUTO-PICK]')) return <span key={i} style={{ color: '#00ff00', fontWeight: 'bold' }}>{word} </span>;
        if (word.includes('[SIDE]') || word.includes('[AUTO-SIDE]')) return <span key={i} style={{ color: '#4facfe', fontWeight: 'bold' }}>{word} </span>;
        if (word.includes('[DECIDER]')) return <span key={i} style={{ color: '#ffa500', fontWeight: 'bold' }}>{word} </span>;
        if (word.includes('[SYSTEM]') || word.includes('[COIN]')) return <span key={i} style={{ color: '#ffd700', fontWeight: 'bold' }}>{word} </span>;
        if (word.includes('[READY]')) return <span key={i} style={{ color: '#00ff00', fontWeight: 'bold' }}>{word} </span>;

        if (word === teamA) return <span key={i} style={{ color: '#00d4ff', fontWeight: 'bold' }}>{word} </span>;
        if (word === teamB) return <span key={i} style={{ color: '#ff0055', fontWeight: 'bold' }}>{word} </span>;
        
        if (['banned', 'picked'].includes(word.toLowerCase())) return <span key={i} style={{ color: '#666' }}>{word} </span>;
        
        return <span key={i} style={{ color: '#aaa' }}>{word} </span>;
    };

    return (
        <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            // 🛡️ UI/UX FIX: Forces a clean slide-in instead of a springy bounce
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ marginBottom: '6px', fontFamily: "'Consolas', monospace", fontSize: '0.9rem', lineHeight: '1.5' }}
        >
            {mainPart.split(' ').map((w, i) => renderWord(w, i))}
            {sidePart && <span style={{ color: '#00ff00', fontWeight: 'bold', marginLeft: '5px' }}>{sidePart}</span>}
        </motion.div>
    );
});

export default LogLineRenderer;
