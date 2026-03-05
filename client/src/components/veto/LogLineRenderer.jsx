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
        let style = { color: '#aaa' };
        if (['banned', 'picked'].includes(word.toLowerCase())) style = { color: '#666' };
        if (word === teamA) style = { color: '#00d4ff', fontWeight: 'bold' };
        if (word === teamB) style = { color: '#ff0055', fontWeight: 'bold' };
        if (word.includes('[BAN]')) style = { color: '#ff4444', fontWeight: 'bold' };
        if (word.includes('[PICK]')) style = { color: '#00ff00', fontWeight: 'bold' };
        return <span key={i} style={style}>{word} </span>;
    };

    return (
        <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ marginBottom: '6px', fontFamily: "'Consolas', monospace", fontSize: '0.9rem', lineHeight: '1.5' }}
        >
            {mainPart.split(' ').map((w, i) => renderWord(w, i))}
            {sidePart && <span style={{ color: '#00ff00', fontWeight: 'bold', marginLeft: '5px' }}>{sidePart}</span>}
        </motion.div>
    );
});

export default LogLineRenderer;
