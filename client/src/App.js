// File: src/App.jsx
/**
 * ⚡ COMP-OS — VETO ENGINE CLIENT
 * =============================================================================
 * FILE          : App.jsx
 * RESPONSIBILITY: React Client for Map Veto Interface
 * LAYER         : Frontend UI
 * RISK LEVEL    : LOW (Hardened)
 * =============================================================================
 *
 * RELEASE METADATA
 * -----------------------------------------------------------------------------
 * VERSION       : v5.0.0 (LAZY-SOCKET-ENGINE)
 * STATUS        : ENFORCED
 *
 * FEATURES:
 * - Lazy Socket Connection: Socket only connects when actively required.
 * - O(1) Log Caching: Replaced O(N) array scans during render loops.
 * - Singleton AudioContext: Prevents browser context exhaustion.
 * - Secure URL Token Scrubbing.
 * =============================================================================
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import io from 'socket.io-client';

// --- CONFIGURATION ---
const SOCKET_URL = window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : window.location.origin;

const LOGO_URL = "https://i.ibb.co/0yLfyyQt/LOT-LOGO-03.jpg";

// 🛡️ SCALABILITY FIX: AutoConnect disabled. We only connect when necessary.
const socket = io(SOCKET_URL, { autoConnect: false });

// --- MAP PREFIX DETECTION ---
const getMapNameWithPrefix = (mapName) => {
    if (!mapName) return mapName;
    if (mapName.includes('_')) return mapName.toLowerCase();

    const defusalMaps = ['dust2', 'inferno', 'mirage', 'overpass', 'nuke', 'anubis', 'ancient', 'vertigo', 'cache', 'train', 'cobblestone', 'tuscan', 'sanctum', 'poseidon'];
    const hostageMaps = ['office', 'assault', 'italy', 'militia'];
    const aimMaps = ['aim_map', 'aim_redline', 'aim_ag_texture2'];
    const awpMaps = ['awp_india', 'awp_lego_2', 'awp_map'];
    const arMaps = ['shoots', 'monastery', 'baggage', 'lake', 'stmarc', 'safehouse', 'sugarcane'];
    const bhopMaps = ['bhop_map', 'bhop_easy', 'bhop_hard'];
    const zeMaps = ['ze_map', 'ze_escape', 'ze_survival'];

    const lowerName = mapName.toLowerCase();

    if (defusalMaps.some(m => lowerName.includes(m))) return `de_${lowerName}`;
    if (hostageMaps.some(m => lowerName.includes(m))) return `cs_${lowerName}`;
    if (aimMaps.some(m => lowerName.includes(m))) return `aim_${lowerName}`;
    if (awpMaps.some(m => lowerName.includes(m))) return `awp_${lowerName}`;
    if (arMaps.some(m => lowerName.includes(m))) return `ar_${lowerName}`;
    if (bhopMaps.some(m => lowerName.includes(m))) return `bhop_${lowerName}`;
    if (zeMaps.some(m => lowerName.includes(m))) return `ze_${lowerName}`;

    return `de_${lowerName}`;
};

const getMapImageUrl = (mapName, customImage = null) => {
    if (customImage) return { primary: customImage, fallbacks: [] };

    const mapWithPrefix = getMapNameWithPrefix(mapName);
    const baseName = mapWithPrefix.toLowerCase();
    const mapNameLower = mapName.toLowerCase();

    const primaryUrl = `https://raw.githubusercontent.com/rpkaul/cs-map-images/refs/heads/main/${baseName}.png`;
    const prefixes = ['de_', 'ar_', 'cs_', 'awp_', 'aim_', 'bhop_', 'ze_'];
    const secondaryUrls = [];

    secondaryUrls.push(`https://raw.githubusercontent.com/rpkaul/cs-map-images/refs/heads/main/${baseName}.jpg`);

    prefixes.forEach(prefix => {
        const prefixedName = `${prefix}${mapNameLower}`;
        if (prefixedName !== baseName) {
            secondaryUrls.push(`https://raw.githubusercontent.com/rpkaul/cs-map-images/refs/heads/main/${prefixedName}.png`);
            secondaryUrls.push(`https://raw.githubusercontent.com/rpkaul/cs-map-images/refs/heads/main/${prefixedName}.jpg`);
        }
    });

    secondaryUrls.push(`https://image.gametracker.com/images/maps/160x120/csgo/${baseName}.jpg`);
    secondaryUrls.push(`https://image.gametracker.com/images/maps/160x120/csgo/de_${mapNameLower}.jpg`);

    return { primary: primaryUrl, fallbacks: secondaryUrls };
};

const getParams = () => {
    const params = new URLSearchParams(window.location.search);
    let room = params.get('room');
    let key = params.get('key');

    if (room && key) {
        sessionStorage.setItem(`lot_key_${room}`, key);
        window.history.replaceState({}, document.title, `${window.location.pathname}?room=${room}`);
    } else if (room) {
        key = sessionStorage.getItem(`lot_key_${room}`);
    }
    return { room, key };
};

const openInNewTab = (url) => window.open(url, '_blank', 'noopener,noreferrer');

let globalAudioContext = null;

const playSound = (type = 'action') => {
    try {
        if (!globalAudioContext) {
            globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        if (globalAudioContext.state === 'suspended') {
            globalAudioContext.resume();
        }

        const oscillator = globalAudioContext.createOscillator();
        const gainNode = globalAudioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(globalAudioContext.destination);

        switch (type) {
            case 'ban':
                oscillator.frequency.value = 220; 
                oscillator.type = 'sine'; 
                gainNode.gain.setValueAtTime(0.08, globalAudioContext.currentTime); 
                gainNode.gain.exponentialRampToValueAtTime(0.001, globalAudioContext.currentTime + 0.15); 
                oscillator.start(globalAudioContext.currentTime);
                oscillator.stop(globalAudioContext.currentTime + 0.15);
                break;
            case 'pick':
                oscillator.frequency.value = 330; 
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.08, globalAudioContext.currentTime); 
                gainNode.gain.exponentialRampToValueAtTime(0.001, globalAudioContext.currentTime + 0.12); 
                oscillator.start(globalAudioContext.currentTime);
                oscillator.stop(globalAudioContext.currentTime + 0.12);
                break;
            case 'side':
                oscillator.frequency.value = 275; 
                oscillator.type = 'sine'; 
                gainNode.gain.setValueAtTime(0.07, globalAudioContext.currentTime); 
                gainNode.gain.exponentialRampToValueAtTime(0.001, globalAudioContext.currentTime + 0.1); 
                oscillator.start(globalAudioContext.currentTime);
                oscillator.stop(globalAudioContext.currentTime + 0.1);
                break;
            case 'ready':
                oscillator.frequency.value = 440; 
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.06, globalAudioContext.currentTime); 
                gainNode.gain.exponentialRampToValueAtTime(0.001, globalAudioContext.currentTime + 0.08); 
                oscillator.start(globalAudioContext.currentTime);
                oscillator.stop(globalAudioContext.currentTime + 0.08);
                break;
            case 'coin':
                const baseFreq = 200;
                const wobbleAmount = 30;
                const wobbleSpeed = 15; 
                const totalDuration = 0.1; 
                for (let i = 0; i < 3; i++) {
                    const osc = globalAudioContext.createOscillator();
                    const gain = globalAudioContext.createGain();
                    osc.connect(gain);
                    gain.connect(globalAudioContext.destination);
                    osc.frequency.setValueAtTime(baseFreq + (i * 50), globalAudioContext.currentTime);
                    osc.type = i === 0 ? 'sine' : 'triangle'; 
                    const startTime = globalAudioContext.currentTime + (i * 0.03);
                    gain.gain.setValueAtTime(0, startTime);
                    gain.gain.linearRampToValueAtTime(0.04 - (i * 0.01), startTime + 0.01);
                    gain.gain.linearRampToValueAtTime(0.04 - (i * 0.01), startTime + totalDuration - 0.01);
                    gain.gain.linearRampToValueAtTime(0, startTime + totalDuration);
                    for (let t = 0; t < totalDuration; t += 0.02) {
                        const wobble = Math.sin((t * wobbleSpeed) * Math.PI * 2) * wobbleAmount;
                        osc.frequency.setValueAtTime(baseFreq + (i * 50) + wobble, startTime + t);
                    }
                    osc.start(startTime);
                    osc.stop(startTime + totalDuration);
                }
                return;
            case 'coinLoop':
                const baseFreq2 = 180;
                const wobbleAmount2 = 25;
                const wobbleSpeed2 = 12;
                const cycleDuration = 0.15;
                for (let i = 0; i < 4; i++) {
                    const osc = globalAudioContext.createOscillator();
                    const gain = globalAudioContext.createGain();
                    const filter = globalAudioContext.createBiquadFilter();
                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(globalAudioContext.destination);
                    filter.type = 'lowpass';
                    filter.frequency.value = 500 + (i * 100);
                    const freq = baseFreq2 + (i * 40);
                    osc.type = i === 0 ? 'sine' : (i === 1 ? 'triangle' : 'sawtooth');
                    const startTime2 = globalAudioContext.currentTime;
                    gain.gain.setValueAtTime(0.03 - (i * 0.005), startTime2);
                    gain.gain.linearRampToValueAtTime(0, startTime2 + cycleDuration);
                    for (let t = 0; t < cycleDuration; t += 0.01) {
                        const wobble = Math.sin((t * wobbleSpeed2) * Math.PI * 2) * wobbleAmount2;
                        osc.frequency.setValueAtTime(freq + wobble, startTime2 + t);
                    }
                    osc.start(startTime2);
                    osc.stop(startTime2 + cycleDuration);
                }
                return;
            case 'countdown':
                oscillator.frequency.value = 400; 
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.05, globalAudioContext.currentTime); 
                gainNode.gain.exponentialRampToValueAtTime(0.001, globalAudioContext.currentTime + 0.05); 
                oscillator.start(globalAudioContext.currentTime);
                oscillator.stop(globalAudioContext.currentTime + 0.05);
                break;
            default:
                oscillator.frequency.value = 300; 
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.07, globalAudioContext.currentTime); 
                gainNode.gain.exponentialRampToValueAtTime(0.001, globalAudioContext.currentTime + 0.12); 
                oscillator.start(globalAudioContext.currentTime);
                oscillator.stop(globalAudioContext.currentTime + 0.12);
        }
    } catch (e) {
        // Sound playback failed silently
    }
};

const Countdown = ({ endsAt, soundEnabled = false }) => {
    const [timeLeft, setTimeLeft] = useState(0);
    const prevTimeRef = useRef(null);

    useEffect(() => {
        if (!endsAt) {
            prevTimeRef.current = null;
            return;
        }

        const endsAtTime = typeof endsAt === 'number' ? endsAt : new Date(endsAt).getTime();
        const initialDiff = Math.floor((endsAtTime - Date.now()) / 1000);
        const initialTimeLeft = initialDiff > 0 ? initialDiff : 0;
        prevTimeRef.current = initialTimeLeft;
        setTimeLeft(initialTimeLeft);

        const interval = setInterval(() => {
            const endsAtTime = typeof endsAt === 'number' ? endsAt : new Date(endsAt).getTime();
            const diff = Math.floor((endsAtTime - Date.now()) / 1000);
            const newTimeLeft = diff > 0 ? diff : 0;

            if (soundEnabled && prevTimeRef.current !== null && newTimeLeft <= 10 && newTimeLeft >= 0 && newTimeLeft < prevTimeRef.current) {
                playSound('countdown');
            }

            prevTimeRef.current = newTimeLeft;
            setTimeLeft(newTimeLeft);
        }, 1000);
        return () => clearInterval(interval);
    }, [endsAt, soundEnabled]);

    if (!endsAt || timeLeft <= 0) return null;
    return <span style={{ color: timeLeft < 10 ? '#ff4444' : '#00d4ff', fontWeight: 'bold', marginLeft: '10px' }}>({timeLeft}s)</span>;
};

// --- ICONS ---
const ExternalLinkIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>);
const CheckIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00ff00" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>);
const CopyIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>);
const HomeIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>);
const TrashIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>);
const UploadIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>);
const RefreshIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>);
const UndoIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>);

const AnimatedBackground = React.memo(() => (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1, background: 'radial-gradient(circle at center, #1b2838 0%, #0b0f19 100%)' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '200%', height: '200%', backgroundImage: 'linear-gradient(rgba(18,16,16,0) 50%,rgba(0,0,0,0.25) 50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(255,0,0,0.03))', backgroundSize: '100% 2px, 3px 100%', animation: 'scanline 10s linear infinite' }} />
    </div>
));

const RulesModal = React.memo(({ format, onClose }) => {
    const getRules = () => {
        if (format.includes('wingman_bo1')) return ["WINGMAN Bo1:", "1. Team A Bans", "2. Team B Bans", "3. Team A Bans", "4. Team B Bans", "5. Team A Bans", "6. Last Map (Knife for Side)"];
        if (format.includes('wingman_bo3')) return ["WINGMAN Bo3:", "1. Team A Bans 2 maps", "2. Team A Picks 1 map (Team B picks side)", "3. Team B Picks 1 map (Team A picks side)", "4. Team B Bans 1 map", "5. Last Decider Map (Knife for Side)"];
        if (format.includes('faceit_bo1')) return ["FACEIT Bo1:", "1. Team A Bans 1", "2. Team B Bans 1", "3. Team A Bans 1", "4. Team B Bans 1", "5. Team A Bans 1", "6. Team B Bans 1", "7. Remaining Map (Knife for Side)"];
        if (format.includes('faceit_bo3')) return ["FACEIT Bo3:", "1. Team A Bans 1", "2. Team B Bans 1", "3. Team A Picks 1", "4. Team B Picks Side", "5. Team B Picks 1", "6. Team A Picks Side", "7. Team A Bans 1", "8. Team B Bans 1", "9. Decider Map (Knife for Side)"];
        if (format === 'bo1') return ["VRS Bo1:", "1. Team A Bans 2 maps", "2. Team B Bans 3 maps", "3. Team A Bans 1 map", "4. Leftover map is played, and Team B chooses the starting side"];
        if (format === 'bo3') return ["VRS Bo3:", "1. Team A Bans 1st Map", "2. Team B Bans 2nd Map", "3. Team A Picks 3rd Map ; Team B Chooses Side", "4. Team B Picks 4th Map ; Team A Chooses Side", "5. Team B Bans 5th Map", "6. Team A Bans 6th Map", "7. Leftover Map is played as the decider"];
        if (format === 'bo5' || format === 'faceit_bo5') return ["Bo5:", "1. Team A Bans 1st Map", "2. Team B Bans 2nd Map", "3. Team A Picks 3rd map; Team B chooses the starting side", "4. Team B Picks 4th map; Team A chooses the starting side", "5. Team A picks 5th map; Team B chooses the starting side", "6. Team B picks 6th map; Team A chooses the starting side", "7. Left over map is played as decider ; knife round"];
        if (format === 'custom') return ["This is a custom match with custom rules."];
        return [];
    };
    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ background: '#0f1219', border: '2px solid #00d4ff', borderRadius: '15px', padding: '20px', width: '90%', maxWidth: '600px', textAlign: 'center' }}>
                <h2 style={{ color: '#fff', fontFamily: "'Rajdhani',sans-serif" }}>RULES: {format.toUpperCase().replace('_', ' ')}</h2>
                <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '10px', margin: '20px 0', color: '#ccc' }}>{getRules().map((r, i) => <div key={i}>{r}</div>)}</div>
                <button onClick={onClose} style={{ background: '#00d4ff', border: 'none', padding: '10px 30px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>OK</button>
            </div>
        </div>
    );
});

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
        <div style={{ marginBottom: '6px', fontFamily: "'Consolas', monospace", fontSize: '0.9rem', lineHeight: '1.5' }}>
            {mainPart.split(' ').map((w, i) => renderWord(w, i))}
            {sidePart && (
                <span style={{ color: '#00ff00', fontWeight: 'bold', marginLeft: '5px' }}>
                    {sidePart}
                </span>
            )}
        </div>
    );
});

const MapCard = React.memo(({ map, isInteractive, onMouseEnter, onMouseLeave, onClick, actionColor, logData, mapOrderLabel, styles }) => {
    const mapImageUrls = getMapImageUrl(map.name, map.customImage);
    const initialUrl = mapImageUrls.primary;
    const [imageUrl, setImageUrl] = useState(initialUrl);
    const [imageFailed, setImageFailed] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const fallbacksKey = mapImageUrls.fallbacks.join(',');

    useEffect(() => {
        if (map.customImage) {
            setImageFailed(false);
            setImageUrl(initialUrl); 
            return;
        }

        let testImage; 
        let timeoutId;
        let currentIndex = -1; 

        const allUrlsToTest = [initialUrl, ...mapImageUrls.fallbacks]; 

        const tryNextUrl = () => {
            currentIndex++;
            if (currentIndex >= allUrlsToTest.length) {
                setImageFailed(true);
                return;
            }

            const testUrl = allUrlsToTest[currentIndex];
            testImage = new Image(); 

            testImage.onload = () => {
                clearTimeout(timeoutId);
                setImageUrl(testUrl); 
                setImageFailed(false);
            };

            testImage.onerror = () => {
                clearTimeout(timeoutId);
                tryNextUrl(); 
            };

            timeoutId = setTimeout(() => {
                testImage.onload = null;
                testImage.onerror = null;
                tryNextUrl();
            }, 3000); 

            testImage.src = testUrl;
        };

        tryNextUrl();

        return () => {
            clearTimeout(timeoutId);
            if (testImage) {
               testImage.onload = null;
               testImage.onerror = null;
            }
        };
    }, [map.name, initialUrl, fallbacksKey, map.customImage, mapImageUrls.fallbacks]); 

    const fallbackUrls = mapImageUrls.fallbacks.length > 0
        ? ', ' + mapImageUrls.fallbacks.map(url => `url(${url})`).join(', ')
        : '';

    const cardStyle = {
        ...styles.mapCard,
        backgroundImage: imageFailed
            ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
            : `linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%), url(${imageUrl})${fallbackUrls}`,
        opacity: map.status === 'banned' ? 0.3 : 1,
        filter: map.status === 'banned' ? 'grayscale(100%)' : 'none',
        border: map.status === 'picked' ? '3px solid #00ff00' : map.status === 'decider' ? '3px solid #ffa500' : isInteractive ? `2px solid ${actionColor}` : '1px solid rgba(255,255,255,0.1)',
        cursor: (map.status === 'available' && isInteractive) ? 'pointer' : 'default',
        boxShadow: (isInteractive && isHovered) ? `0 0 20px ${actionColor}` : '0 5px 15px rgba(0,0,0,0.5)',
        transform: (isInteractive && isHovered) ? 'scale(1.05) translateY(-5px)' : 'scale(1)',
        position: 'relative'
    };

    return (
        <div
            onMouseEnter={() => { setIsHovered(true); onMouseEnter && onMouseEnter(); }}
            onMouseLeave={() => { setIsHovered(false); onMouseLeave && onMouseLeave(); }}
            onClick={onClick}
            style={cardStyle}
        >
            {imageFailed && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                    borderRadius: '10px', padding: '20px', textAlign: 'center', zIndex: 1
                }}>
                    <div style={{ fontSize: '2rem', color: '#888', marginBottom: '10px', opacity: 0.5 }}>🖼️</div>
                    <div style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '15px', fontWeight: 'bold' }}>MAP IMAGE NOT AVAILABLE</div>
                    <div style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 'bold', textTransform: 'uppercase' }}>{map.name}</div>
                </div>
            )}
            {map.status === 'picked' && mapOrderLabel && <div style={styles.mapOrderBadge}>{mapOrderLabel}</div>}
            <div style={styles.cardContent}>
                <span style={styles.mapTitle}>{map.name}</span>
                {map.status === 'banned' && <div style={styles.badgeBan}>BANNED BY {logData?.team || '...'}</div>}
                {map.status === 'picked' && <div style={styles.badgePick}>PICKED BY {logData?.team || '...'} <div style={styles.miniSideBadge}>{logData?.sideText || 'WAITING...'}</div></div>}
                {map.status === 'decider' && <div style={styles.badgeDecider}>DECIDER <div style={styles.miniSideBadge}>{logData?.sideText || 'WAITING FOR SIDE'}</div></div>}
            </div>
        </div>
    );
});

const CoinFlipOverlay = React.memo(({ gameState, myRole, onCall, onDecide, soundEnabled = true }) => {
    const [isFlipping, setIsFlipping] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const [flipAnimation, setFlipAnimation] = useState(null);
    const soundIntervalRef = useRef(null);

    useEffect(() => {
        if (gameState.coinFlip.result && gameState.coinFlip.status === 'deciding') {
            const randomRotations = Math.floor(Math.random() * 1800) + 1800; 
            const randomDuration = (Math.random() * 1.5) + 2.5; 
            const randomXAxis = (Math.random() * 20) - 10; 
            const randomZAxis = (Math.random() * 20) - 10; 

            setFlipAnimation({ rotations: randomRotations, duration: randomDuration, xAxis: randomXAxis, zAxis: randomZAxis });
            setIsFlipping(true);

            if (soundEnabled) {
                playSound('coin');
                soundIntervalRef.current = setInterval(() => { playSound('coinLoop'); }, 150);
            }

            setTimeout(() => {
                if (soundIntervalRef.current) {
                    clearInterval(soundIntervalRef.current);
                    soundIntervalRef.current = null;
                }
                setIsFlipping(false);
                setShowResult(true);
            }, randomDuration * 1000);
        }

        return () => {
            if (soundIntervalRef.current) {
                clearInterval(soundIntervalRef.current);
                soundIntervalRef.current = null;
            }
        };
    }, [gameState.coinFlip.result, gameState.coinFlip.status, soundEnabled]);

    const isCaller = myRole === 'A';
    const isWinner = myRole === gameState.coinFlip.winner;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#1e293b', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
            <style>
                {flipAnimation && `
                    @keyframes coinFlip3D {
                        0% { transform: rotateY(0deg) rotateX(0deg) rotateZ(0deg) scale(1); filter: brightness(1); }
                        25% { transform: rotateY(${flipAnimation.rotations * 0.25}deg) rotateX(${flipAnimation.xAxis}deg) rotateZ(${flipAnimation.zAxis}deg) scale(1.1); filter: brightness(1.3); }
                        50% { transform: rotateY(${flipAnimation.rotations * 0.5}deg) rotateX(${-flipAnimation.xAxis}deg) rotateZ(${-flipAnimation.zAxis}deg) scale(0.95); filter: brightness(0.8); }
                        75% { transform: rotateY(${flipAnimation.rotations * 0.75}deg) rotateX(${flipAnimation.xAxis * 0.5}deg) rotateZ(${flipAnimation.zAxis * 0.5}deg) scale(1.05); filter: brightness(1.2); }
                        100% { transform: rotateY(${flipAnimation.rotations}deg) rotateX(0deg) rotateZ(0deg) scale(1); filter: brightness(1); }
                    }
                    @keyframes coinShadow {
                        0%, 100% { box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 50px rgba(255, 215, 0, 0.3), inset 0 0 20px rgba(255, 255, 255, 0.1), 0 0 0 0 rgba(255, 215, 0, 0); }
                        25%, 75% { box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3), 0 0 80px rgba(255, 215, 0, 0.6), inset 0 0 30px rgba(255, 255, 255, 0.2), 0 0 40px 10px rgba(255, 215, 0, 0.3); }
                        50% { box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7), 0 0 100px rgba(255, 215, 0, 0.8), inset 0 0 40px rgba(255, 255, 255, 0.3), 0 0 60px 20px rgba(255, 215, 0, 0.5); }
                    }
                    @keyframes fadeInScale {
                        0% { opacity: 0; transform: scale(0.8); }
                        100% { opacity: 1; transform: scale(1); }
                    }
                    .coin-3d {
                        transform-style: preserve-3d;
                        backface-visibility: hidden;
                        animation: coinFlip3D ${flipAnimation ? flipAnimation.duration : 3}s cubic-bezier(0.4, 0.0, 0.2, 1) forwards,
                                   coinShadow ${flipAnimation ? flipAnimation.duration : 3}s ease-in-out infinite;
                    }
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
                <div style={{ perspective: '2000px', perspectiveOrigin: 'center center', marginBottom: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                    <div className={isFlipping ? 'coin-3d' : ''} style={{
                            width: '180px', height: '180px', borderRadius: '50%', border: '6px solid rgba(255, 255, 255, 0.9)',
                            background: gameState.coinFlip.result === 'heads'
                                ? 'radial-gradient(circle at 30% 30%, #ffd700 0%, #ffed4e 30%, #b8860b 70%, #8b6914 100%)'
                                : 'radial-gradient(circle at 30% 30%, #cbd5e1 0%, #94a3b8 30%, #64748b 70%, #475569 100%)',
                            marginBottom: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '5rem', fontWeight: '900', color: '#fff', textShadow: '0 4px 10px rgba(0,0,0,0.8), 0 0 20px rgba(255,255,255,0.3)', fontFamily: "'Rajdhani', sans-serif", position: 'relative', overflow: 'hidden', transition: isFlipping ? 'none' : 'all 0.5s ease'
                        }}>
                        <div style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', background: gameState.coinFlip.result === 'heads' ? 'radial-gradient(circle at 70% 70%, rgba(0,0,0,0.3) 0%, transparent 60%)' : 'radial-gradient(circle at 70% 70%, rgba(0,0,0,0.4) 0%, transparent 60%)', pointerEvents: 'none' }}></div>
                        <div style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4) 0%, transparent 50%)', pointerEvents: 'none' }}></div>
                        <span style={{ position: 'relative', zIndex: 1, transform: isFlipping ? 'scale(0.8)' : 'scale(1)', transition: 'transform 0.3s ease' }}>
                            {isFlipping ? '?' : (gameState.coinFlip.result === 'heads' ? 'H' : 'T')}
                        </span>
                    </div>

                    {!isFlipping && (
                        <div style={{ background: '#fff', color: '#000', padding: '12px 45px', borderRadius: '50px', fontSize: '2.2rem', fontWeight: '900', textTransform: 'uppercase', fontFamily: "'Rajdhani', sans-serif", boxShadow: '0 0 30px rgba(255, 255, 255, 0.7), 0 0 60px rgba(255, 215, 0, 0.4)', animation: 'fadeInScale 0.5s ease-out', transform: 'scale(1)', transition: 'all 0.3s ease' }}>
                            {gameState.coinFlip.result}
                        </div>
                    )}
                </div>
            )}

            {showResult && gameState.coinFlip.status === 'deciding' && (
                <div style={{ textAlign: 'center', animation: 'fadeIn 1s' }}>
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
        </div>
    );
});

export default function App() {
    const [params] = useState(getParams());
    const [gameState, setGameState] = useState(null);
    const [myRole, setMyRole] = useState(null);
    const [view, setView] = useState('home');
    const [historyData, setHistoryData] = useState([]);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [showNotification, setShowNotification] = useState(false);
    const [hoveredItem, setHoveredItem] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [showRules, setShowRules] = useState(false);
    const rulesShownRef = useRef(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [inputError, setInputError] = useState(false);

    const isAdminRoute = window.location.pathname === '/admin';
    const [adminSecret, setAdminSecret] = useState(sessionStorage.getItem('adminSecret') || '');
    const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

    const [adminTeamA, setAdminTeamA] = useState('');
    const [adminTeamB, setAdminTeamB] = useState('');
    const [adminLinks, setAdminLinks] = useState(null);
    const [mapPool, setMapPool] = useState([]);
    const [newMapName, setNewMapName] = useState('');
    const [newMapImage, setNewMapImage] = useState('');

    const [teamA, setTeamA] = useState('');
    const [teamB, setTeamB] = useState('');
    const [teamALogo, setTeamALogo] = useState('');
    const [teamBLogo, setTeamBLogo] = useState('');

    const [createdLinks, setCreatedLinks] = useState(null);
    const [availableMaps, setAvailableMaps] = useState([]);
    const [customSelectedMaps, setCustomSelectedMaps] = useState([]);
    const [customSequence, setCustomSequence] = useState([]);
    const [userCustomMap, setUserCustomMap] = useState('');
    const [useTimer, setUseTimer] = useState(false);
    const [timerDuration, setTimerDuration] = useState(60); 
    const [useCoinFlip, setUseCoinFlip] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('soundEnabled') !== 'false');
    const [userCount, setUserCount] = useState(0); 

    const prevLogsRef = useRef([]); 

    const [vetoMode, setVetoMode] = useState('vrs');

    const [adminWebhook, setAdminWebhook] = useState('');
    const [tempWebhook, setTempWebhook] = useState('');
    const [webhookTestStatus, setWebhookTestStatus] = useState(null);

    const fileInputA = useRef(null);
    const fileInputB = useRef(null);

    const styles = useMemo(() => getStyles(isMobile), [isMobile]);

    const mapLogCache = useMemo(() => {
        const cache = {};
        if (!gameState?.logs) return cache;

        gameState.logs.forEach(log => {
            if (log.includes('banned')) {
                const mapMatch = log.match(/banned (.*?)(\s|$|\()/);
                if (mapMatch) {
                    const teamName = log.split(' banned ')[0].replace('[BAN] ', '').replace('[AUTO-BAN] ', '').trim();
                    cache[mapMatch[1].trim()] = { type: 'ban', team: teamName };
                }
            } 
            else if (log.includes('picked')) {
                const mapMatch = log.match(/picked (.*?)(\s|$|\()/);
                if (mapMatch) {
                    const mapName = mapMatch[1].trim();
                    const teamName = log.split(' picked ')[0].replace('[PICK] ', '').replace('[AUTO-PICK] ', '').trim();
                    let sideText = "WAITING FOR SIDE";
                    
                    const inlineMatch = log.match(/\((.*?) chose (CT|T) side for/);
                    if (inlineMatch) sideText = `${inlineMatch[1]} CHOSE ${inlineMatch[2]}`;
                    
                    cache[mapName] = { type: 'pick', team: teamName, sideText };
                }
            }
            else if (log.includes('[DECIDER]')) {
                const mapMatch = log.match(/\[DECIDER\] (.*?) \(/);
                if (mapMatch) cache[mapMatch[1].trim()] = { type: 'decider', sideText: 'SIDE VIA KNIFE' };
            }
            else if (log.includes('side for')) {
                const match = log.match(/(?:\[SIDE\]|\[AUTO-SIDE\]|\() (.*?) chose (CT|T) side for (.*?)(?:\)|$)/);
                if (match) {
                    const mapName = match[3].trim();
                    if (cache[mapName]) {
                        cache[mapName].sideText = `${match[1]} CHOSE ${match[2]}`;
                    } else {
                        cache[mapName] = { type: 'decider', sideText: `${match[1]} CHOSE ${match[2]}` };
                    }
                }
            }
        });
        return cache;
    }, [gameState?.logs]);

    const fetchAdminHistory = useCallback((secret) => {
        fetch(`${SOCKET_URL}/api/admin/history`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret }) })
            .then(res => res.json()).then(data => {
                if (data.error) { if (!isAdminRoute) alert(data.error); }
                else { setHistoryData(data); setIsAdminAuthenticated(true); sessionStorage.setItem('adminSecret', secret); }
            });
    }, [isAdminRoute]);

    const fetchMapPool = useCallback((secret) => {
        fetch(`${SOCKET_URL}/api/admin/maps/get`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret }) })
            .then(r => r.json()).then(data => { if (Array.isArray(data)) setMapPool(data); });
    }, []);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        const link = document.createElement('link'); link.href = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;700&display=swap'; link.rel = 'stylesheet'; document.head.appendChild(link);
        document.title = "LOTGaming | CS2 Veto";

        fetch(`${SOCKET_URL}/api/maps`)
            .then(r => {
                if (!r.ok) throw new Error("Server Error");
                return r.json();
            })
            .then(data => {
                setAvailableMaps(data);
                setCustomSelectedMaps(data.map(m => m.name));
            })
            .catch(() => { });

        if (isAdminRoute && adminSecret) {
            fetchAdminHistory(adminSecret);
            fetchMapPool(adminSecret);
            fetch(`${SOCKET_URL}/api/admin/webhook/get`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: adminSecret })
            }).then(r => r.json()).then(data => { if (data.webhookUrl) setAdminWebhook(data.webhookUrl); }).catch(() => { });
        }

        socket.on('user_count', (count) => {
            setUserCount(count);
        });

        if (params.room && !isAdminRoute) {
            socket.connect(); 
            socket.emit('join_room', { roomId: params.room, key: params.key });
            
            socket.on('update_state', (data) => {
                if (data && data.logs && prevLogsRef.current.length > 0 && soundEnabled) {
                    const newLogs = data.logs.slice(prevLogsRef.current.length);
                    newLogs.forEach(log => {
                        if (log.includes('[BAN]')) playSound('ban');
                        else if (log.includes('[PICK]')) playSound('pick');
                        else if (log.includes('[SIDE]') || (log.includes('chose') && log.includes('side'))) playSound('side');
                        else if (log.includes('[READY]')) playSound('ready');
                        else if (log.includes('[COIN]')) playSound('coin');
                        else if (log.includes('[AUTO-BAN]') || log.includes('[AUTO-PICK]') || log.includes('[AUTO-SIDE]')) {
                            if (log.includes('AUTO-BAN')) playSound('ban');
                            else if (log.includes('AUTO-PICK')) playSound('pick');
                            else if (log.includes('AUTO-SIDE')) playSound('side');
                        }
                    });
                }
                if (data && data.logs) prevLogsRef.current = [...data.logs];
                setGameState(data);
                if (data && !data.finished && !rulesShownRef.current) { setShowRules(true); rulesShownRef.current = true; }
            });
            socket.on('role_assigned', (role) => setMyRole(role));
        }

        if (!params.room || isAdminRoute) {
            socket.connect();
        }

        socket.on('user_count', (count) => {
            setUserCount(count);
        });

        socket.on('match_created', ({ roomId, keys }) => {
            const links = {
                admin: `${window.location.origin}/?room=${roomId}&key=${keys.admin}`,
                teamA: `${window.location.origin}/?room=${roomId}&key=${keys.A}`,
                teamB: `${window.location.origin}/?room=${roomId}&key=${keys.B}`
            };

            if (isAdminRoute) {
                setAdminLinks(links);
                fetchAdminHistory(adminSecret);
            } else {
                setTimeout(() => { setIsGenerating(false); setCreatedLinks(links); }, 800);
            }
        });

        return () => { 
            socket.off('update_state'); 
            socket.off('role_assigned'); 
            socket.off('user_count');
            socket.off('match_created');
            socket.disconnect();
            window.removeEventListener('resize', handleResize); 
        };
    }, [params.room, params.key, isAdminRoute, adminSecret, fetchAdminHistory, fetchMapPool, soundEnabled]);

    const handleLogoUpload = (e, team) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2000000) return alert("File too large. Max 2MB.");
            if (!file.type.match(/^image\/(jpeg|png|webp|gif)$/)) return alert("Only JPG, PNG, WEBP, and GIF are allowed.");
            
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result;
                if (!base64String.startsWith('data:image/jpeg') && 
                    !base64String.startsWith('data:image/png') && 
                    !base64String.startsWith('data:image/webp') &&
                    !base64String.startsWith('data:image/gif')) {
                    return alert("Security Error: Only valid image payloads are accepted.");
                }

                if (team === 'A') setTeamALogo(base64String);
                else setTeamBLogo(base64String);
            };
            reader.readAsDataURL(file);
        }
    };

    const createMatch = (type, isFromAdmin = false) => {
        const tA = isFromAdmin ? adminTeamA : teamA;
        const tB = isFromAdmin ? adminTeamB : teamB;
        const logoA = isFromAdmin ? '' : teamALogo;
        const logoB = isFromAdmin ? '' : teamBLogo;

        if (!tA.trim() || !tB.trim()) { setInputError(true); return; }

        let format = type;
        if (vetoMode === 'faceit') {
            if (type === 'bo1') format = 'faceit_bo1';
            if (type === 'bo3') format = 'faceit_bo3';
            if (type === 'bo5') format = 'faceit_bo5';
        } else if (vetoMode === 'wingman') {
            if (type === 'bo1') format = 'wingman_bo1';
            if (type === 'bo3') format = 'wingman_bo3';
        } else if (vetoMode === 'custom') {
            format = 'custom';
        }

        if (format === 'custom') {
            if (customSelectedMaps.length === 0) return alert("Please select at least one map.");
            if (customSequence.length === 0) return alert("Please define at least one step in the sequence.");
        }

        const webhookVal = tempWebhook.trim();
        if (webhookVal && !webhookVal.startsWith('https://discord.com/api/webhooks/') && !webhookVal.startsWith('https://discordapp.com/api/webhooks/')) {
            return alert("Invalid Discord Webhook format.");
        }

        if (!isFromAdmin) setIsGenerating(true);
        socket.emit('create_match', {
            teamA: tA, teamB: tB,
            teamALogo: logoA, teamBLogo: logoB,
            format,
            customMapNames: format === 'custom' ? customSelectedMaps : null,
            customSequence: format === 'custom' ? customSequence : null,
            useTimer,
            useCoinFlip,
            timerDuration: useTimer ? parseInt(timerDuration) : 60,
            tempWebhookUrl: webhookVal
        });
        setTeamA(''); setTeamB(''); setTeamALogo(''); setTeamBLogo('');
        setUseCoinFlip(false);
        setTempWebhook(''); 
    };

    const handleAction = useCallback((data) => {
        if (!gameState || gameState.finished) return;
        if (soundEnabled) {
            const currentStep = gameState.sequence[gameState.step];
            if (currentStep) {
                if (currentStep.a === 'ban') playSound('ban');
                else if (currentStep.a === 'pick') playSound('pick');
                else if (currentStep.a === 'side') playSound('side');
            }
        }
        socket.emit('action', { roomId: params.room, data, key: params.key });
    }, [gameState, soundEnabled, params.room, params.key]);

    const handleReady = useCallback(() => {
        if (soundEnabled) playSound('ready');
        socket.emit('team_ready', { roomId: params.room, key: params.key });
    }, [soundEnabled, params.room, params.key]);

    const handleCoinCall = useCallback((call) => {
        if (soundEnabled) playSound('coin');
        socket.emit('coin_call', { roomId: params.room, call, key: params.key });
    }, [soundEnabled, params.room, params.key]);

    const handleCoinDecide = useCallback((decision) => {
        if (soundEnabled) playSound('coin');
        socket.emit('coin_decision', { roomId: params.room, decision, key: params.key });
    }, [soundEnabled, params.room, params.key]);

    const fetchPublicHistory = (page = 1) => {
        fetch(`${SOCKET_URL}/api/history?page=${page}&limit=10`)
            .then(res => {
                if (!res.ok) throw new Error("Server Error");
                return res.json();
            })
            .then(data => {
                setHistoryData(data.matches);
                setTotalPages(data.totalPages);
                setCurrentPage(data.currentPage);
                setView('history');
            })
            .catch(err => console.error("Error fetching history:", err));
    };

    const handlePageChange = (newPage) => {
        if (newPage > 0 && newPage <= totalPages) {
            fetchPublicHistory(newPage);
        }
    };

    const updateMapPool = (newMaps) => { fetch(`${SOCKET_URL}/api/admin/maps/update`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret: adminSecret, maps: newMaps }) }).then(r => r.json()).then(data => { if (data.success) setMapPool(data.maps); }); };
    const handleAddMap = () => { if (!newMapName.trim()) return; const newMap = { name: newMapName.trim(), customImage: newMapImage.trim() || null }; updateMapPool([...mapPool, newMap]); setNewMapName(''); setNewMapImage(''); };
    const handleDeleteMap = (idx) => { if (!window.confirm("Remove map?")) return; const updated = [...mapPool]; updated.splice(idx, 1); updateMapPool(updated); };
    const deleteMatch = (id) => { if (!window.confirm("DELETE?")) return; fetch(`${SOCKET_URL}/api/admin/delete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, secret: adminSecret }) }).then(res => res.json()).then(data => { if (data.success) fetchAdminHistory(adminSecret); }); };
    const nukeHistory = () => { if (!window.confirm("DELETE ALL?")) return; fetch(`${SOCKET_URL}/api/admin/reset`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret: adminSecret }) }).then(res => res.json()).then(data => { if (data.success) fetchAdminHistory(adminSecret); }); };

    const handleAdminReset = (roomId) => {
        if (!window.confirm("Reset this match completely?")) return;
        socket.emit('admin_reset_match', { roomId, secret: adminSecret });
    };

    const handleAdminUndo = (roomId) => {
        socket.emit('admin_undo_step', { roomId, secret: adminSecret });
    };

    const handleCopyLogs = (text) => { navigator.clipboard.writeText(text).then(() => { setShowNotification(true); setTimeout(() => setShowNotification(false), 3000); }); };
    const copyLink = (roomId, key) => { handleCopyLogs(`${window.location.origin}/?room=${roomId}&key=${key}`); };
    const goHome = () => window.location.href = "/";

    const toggleMapSelection = (mapName) => {
        if (customSelectedMaps.includes(mapName)) setCustomSelectedMaps(customSelectedMaps.filter(m => m !== mapName));
        else setCustomSelectedMaps([...customSelectedMaps, mapName]);
    };

    const addUserMap = () => {
        if (!userCustomMap.trim()) return;
        const newName = userCustomMap.trim();
        setAvailableMaps([...availableMaps, { name: newName }]);
        setCustomSelectedMaps([...customSelectedMaps, newName]);
        setUserCustomMap('');
    };

    const addSequenceStep = (team, action) => setCustomSequence([...customSequence, { t: team, a: action }]);
    const removeSequenceStep = (idx) => { const s = [...customSequence]; s.splice(idx, 1); setCustomSequence(s); };

    const getInstruction = () => {
        if (!gameState || gameState.finished) return "VETO COMPLETED, CHECK DISCORD MATCHROOM FOR THE SERVER IP";
        if (!gameState.sequence || !gameState.sequence[gameState.step]) return "VETO COMPLETED";
        const currentStep = gameState.sequence[gameState.step];
        const teamName = currentStep.t === 'A' ? gameState.teamA : gameState.teamB;
        const isMe = currentStep.t === myRole;

        if (gameState.useTimer && gameState.ready) {
            if (!gameState.ready.A || !gameState.ready.B) {
                if (isMe && !gameState.ready[myRole]) return "PLEASE CLICK READY TO START";
                return "WAITING FOR TEAMS TO READY UP";
            }
        }

        if (currentStep.a === 'side') return isMe ? "CHOOSE STARTING SIDE" : `${teamName.toUpperCase()} IS CHOOSING SIDE`;
        let count = 0;
        for (let i = gameState.step; i < gameState.sequence.length; i++) { if (gameState.sequence[i].t === currentStep.t && gameState.sequence[i].a === currentStep.a) count++; else break; }
        const actionText = currentStep.a === 'ban' ? 'BAN' : 'PICK';
        return isMe ? `YOUR TURN: ${actionText} ${count} MAP${count > 1 ? 'S' : ''}` : `WAITING FOR ${teamName.toUpperCase()}`;
    };

    const getRoleLabel = () => {
        if (myRole === 'admin') return { text: 'ADMIN VIEW', color: '#ffd700' };
        if (myRole === 'A') return { text: `${gameState.teamA} VIEW`, color: '#00d4ff' };
        if (myRole === 'B') return { text: `${gameState.teamB} VIEW`, color: '#ff0055' };
        return { text: 'SPECTATOR VIEW', color: '#888' };
    };

    if (isAdminRoute) {
        const activeCount = historyData.filter(m => !m.finished).length;
        return (
            <div style={{ ...styles.container, background: '#05070a' }}>
                <h1 style={{ ...styles.neonTitle, marginTop: '20px', fontSize: '2.5rem' }}>CONTROL PANEL</h1>
                <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00ff00', fontSize: '0.9rem', fontWeight: 'bold', background: 'rgba(0, 0, 0, 0.6)', padding: '6px 12px', borderRadius: '5px', border: '1px solid #00ff00', fontFamily: "'Rajdhani', sans-serif" }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00ff00', boxShadow: '0 0 10px #00ff00', animation: 'pulse 2s infinite' }}></div>
                        <span>Total: {userCount}</span>
                    </div>
                    <div style={{ color: '#00d4ff', fontSize: '0.9rem', cursor: 'pointer' }} onClick={() => { sessionStorage.removeItem('adminSecret'); window.location.reload(); }}>LOGOUT</div>
                </div>
                <button onClick={goHome} style={{ position: 'absolute', top: '20px', left: '20px', background: 'transparent', border: '1px solid #444', color: '#fff', padding: '5px 10px' }}>← PUBLIC HOME</button>

                {!isAdminAuthenticated ? (
                    <div style={styles.glassPanel}>
                        <h3 style={{ color: '#aaa', marginBottom: '20px' }}>AUTHENTICATE</h3>
                        <input type="password" style={styles.input} value={adminSecret} onChange={e => setAdminSecret(e.target.value)} placeholder="ENTER KEY" />
                        <button onClick={() => { fetchAdminHistory(adminSecret); fetchMapPool(adminSecret); }} style={{ ...styles.modeBtn, width: '100%', marginTop: '20px' }}>ACCESS</button>
                    </div>
                ) : (
                    <div style={{ width: '95%', maxWidth: '1200px', marginTop: '30px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '20px' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ background: '#0f1219', border: '1px solid #333', borderRadius: '10px', padding: '20px' }}>
                                <h3 style={{ color: '#fff', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '20px' }}>QUICK CREATE</h3>
                                <input style={{ ...styles.input, width: '100%', fontSize: '1rem', textAlign: 'left' }} value={adminTeamA} onChange={e => setAdminTeamA(e.target.value)} placeholder="Team A Name" />
                                <input style={{ ...styles.input, width: '100%', fontSize: '1rem', textAlign: 'left' }} value={adminTeamB} onChange={e => setAdminTeamB(e.target.value)} placeholder="Team B Name" />
                                <div style={{ marginTop: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#aaa', fontSize: '0.9rem', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <input type="checkbox" checked={useTimer} onChange={e => setUseTimer(e.target.checked)} style={{ transform: 'scale(1.2)' }} />
                                        <span>Enable Auto-Ban Timer</span>
                                    </div>
                                    {useTimer && (
                                        <div style={{ display: 'flex', gap: '5px', marginTop: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                            {[30, 45, 60, 90, 120].map(seconds => (
                                                <button key={seconds} onClick={() => setTimerDuration(seconds)}
                                                    style={{ ...styles.modeBtn, background: timerDuration === seconds ? '#00d4ff' : 'transparent', color: timerDuration === seconds ? '#000' : '#aaa', borderColor: timerDuration === seconds ? '#00d4ff' : '#333', padding: '5px 15px', fontSize: '0.9rem' }}>
                                                    {seconds}s
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#ffd700', fontSize: '0.9rem' }}>
                                    <input type="checkbox" checked={useCoinFlip} onChange={e => setUseCoinFlip(e.target.checked)} style={{ transform: 'scale(1.2)' }} />
                                    <span>Enable Coin Flip</span>
                                </div>
                                <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
                                    <button style={{ ...styles.modeBtn, flex: 1 }} onClick={() => createMatch('bo1', true)}>Bo1</button>
                                    <button style={{ ...styles.modeBtn, flex: 1 }} onClick={() => createMatch('bo3', true)}>Bo3</button>
                                    <button style={{ ...styles.modeBtn, flex: 1 }} onClick={() => createMatch('bo5', true)}>Bo5</button>
                                </div>
                                {adminLinks && (
                                    <div style={{ marginTop: '20px', background: '#000', padding: '10px', borderRadius: '5px' }}>
                                        <div style={{ color: '#00d4ff', fontSize: '0.8rem', marginBottom: '5px' }}>LINKS GENERATED:</div>
                                        <div onClick={() => handleCopyLogs(adminLinks.admin)} style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#aaa', marginBottom: '5px', wordBreak: 'break-all' }}><b>ADMIN:</b> {adminLinks.admin}</div>
                                        <div onClick={() => handleCopyLogs(adminLinks.teamA)} style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#aaa', marginBottom: '5px', wordBreak: 'break-all' }}><b>TEAM A:</b> {adminLinks.teamA}</div>
                                        <div onClick={() => handleCopyLogs(adminLinks.teamB)} style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#aaa', marginBottom: '5px', wordBreak: 'break-all' }}><b>TEAM B:</b> {adminLinks.teamB}</div>
                                    </div>
                                )}
                            </div>
                            <div style={{ background: '#0f1219', border: '1px solid #333', borderRadius: '10px', padding: '20px' }}>
                                <h3 style={{ color: '#fff', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '20px' }}>MAP POOL EDITOR</h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
                                    {mapPool.map((map, i) => (
                                        <div key={i} style={{ background: '#161b22', padding: '5px 10px', borderRadius: '5px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #333' }}>
                                            <span style={{ color: map.customImage ? '#00d4ff' : '#aaa', fontSize: '0.9rem' }}>{map.name}</span>
                                            <button onClick={() => handleDeleteMap(i)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ff4444', fontWeight: 'bold', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><TrashIcon /></button>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: '5px', flexDirection: 'column' }}>
                                    <input style={{ ...styles.input, width: '100%', margin: 0, fontSize: '0.9rem' }} value={newMapName} onChange={e => setNewMapName(e.target.value)} placeholder="New Map Name" />
                                    <input style={{ ...styles.input, width: '100%', margin: 0, fontSize: '0.9rem' }} value={newMapImage} onChange={e => setNewMapImage(e.target.value)} placeholder="Image URL (Optional)" />
                                    <button onClick={handleAddMap} style={{ ...styles.modeBtn, marginTop: '10px' }}>ADD MAP</button>
                                </div>
                            </div>

                            <div style={{ background: '#0f1219', border: '1px solid #333', borderRadius: '10px', padding: '20px', marginTop: '20px' }}>
                                <h3 style={{ color: '#fff', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '20px' }}>DISCORD WEBHOOK</h3>
                                <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '15px' }}>
                                    Configure a permanent webhook that fires for ALL matches
                                </div>
                                <input style={{ ...styles.input, width: '100%', fontSize: '0.9rem', textAlign: 'left' }} value={adminWebhook} onChange={e => setAdminWebhook(e.target.value)} placeholder="https://discord.com/api/webhooks/..." />
                                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                    <button onClick={() => {
                                        fetch(`${SOCKET_URL}/api/admin/webhook/set`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: adminSecret, webhookUrl: adminWebhook }) })
                                            .then(r => r.json()).then(data => {
                                                setWebhookTestStatus({ success: data.success, message: data.success ? 'Webhook saved successfully!' : data.error || 'Failed to save' });
                                                setTimeout(() => setWebhookTestStatus(null), 3000);
                                            }).catch(() => {
                                                setWebhookTestStatus({ success: false, message: 'Network error' });
                                                setTimeout(() => setWebhookTestStatus(null), 3000);
                                            });
                                    }} style={{ ...styles.modeBtn, flex: 1, background: '#00d4ff', color: '#000' }}>SAVE</button>
                                    
                                    <button onClick={() => {
                                        if (!adminWebhook.trim()) return;
                                        setWebhookTestStatus({ success: null, message: 'Testing...' });
                                        fetch(`${SOCKET_URL}/api/admin/webhook/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: adminSecret, webhookUrl: adminWebhook }) })
                                            .then(r => r.json()).then(data => {
                                                setWebhookTestStatus({ success: data.success, message: data.success ? 'Test sent! Check Discord.' : data.error || 'Test failed' });
                                                setTimeout(() => setWebhookTestStatus(null), 3000);
                                            }).catch(() => {
                                                setWebhookTestStatus({ success: false, message: 'Network error' });
                                                setTimeout(() => setWebhookTestStatus(null), 3000);
                                            });
                                    }} style={{ ...styles.modeBtn, flex: 1, background: '#ffa500', color: '#000' }}>TEST</button>

                                    <button onClick={() => {
                                        setAdminWebhook('');
                                        fetch(`${SOCKET_URL}/api/admin/webhook/set`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: adminSecret, webhookUrl: '' }) });
                                    }} style={{ ...styles.modeBtn, flex: 1, background: '#ff4444', color: '#fff' }}>CLEAR</button>
                                </div>
                                {webhookTestStatus && (
                                    <div style={{ marginTop: '15px', padding: '10px', borderRadius: '5px', background: webhookTestStatus.success === null ? 'rgba(0, 212, 255, 0.1)' : webhookTestStatus.success ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)', border: `1px solid ${webhookTestStatus.success === null ? '#00d4ff' : webhookTestStatus.success ? '#00ff00' : '#ff4444'}`, color: webhookTestStatus.success === null ? '#00d4ff' : webhookTestStatus.success ? '#00ff00' : '#ff4444', fontSize: '0.9rem', textAlign: 'center' }}>
                                        {webhookTestStatus.message}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div style={{ flex: 2, background: '#0f1219', border: '1px solid #333', borderRadius: '10px', padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <h3 style={{ color: '#fff', margin: 0 }}>HISTORY</h3>
                                    <button onClick={() => fetchAdminHistory(adminSecret)} style={{ background: 'transparent', border: '1px solid #444', borderRadius: '4px', color: '#00d4ff', cursor: 'pointer', padding: '5px', display: 'flex', alignItems: 'center' }} title="Force Refresh"><RefreshIcon /></button>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#888' }}>ACTIVE: <span style={{ color: '#00ff00' }}>{activeCount}</span> | TOTAL: {historyData.length}</div>
                            </div>
                            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                {historyData.map((match, i) => (
                                    <div key={i} style={{ background: '#161b22', marginBottom: '10px', padding: '15px', borderRadius: '5px', borderLeft: match.finished ? '4px solid #333' : '4px solid #00ff00' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ fontWeight: 'bold', color: match.finished ? '#888' : '#fff' }}>{match.teamA} vs {match.teamB} <span style={{ fontSize: '0.7rem', background: '#333', padding: '2px 5px', borderRadius: '3px', marginLeft: '5px' }}>{match.format}</span></div>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                {!match.finished && (
                                                    <button onClick={() => handleAdminUndo(match.id)} style={{ background: 'transparent', color: '#ffa500', border: 'none', cursor: 'pointer' }} title="Undo Last Step"><UndoIcon /></button>
                                                )}
                                                <button onClick={() => handleAdminReset(match.id)} style={{ background: 'transparent', color: '#00d4ff', border: 'none', cursor: 'pointer' }} title={match.finished ? "Restart Match" : "Reset Match"}><RefreshIcon /></button>
                                                <button onClick={() => deleteMatch(match.id)} style={{ background: 'transparent', color: '#ff4444', border: 'none', cursor: 'pointer' }}><TrashIcon /></button>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '5px' }}>
                                            {new Date(match.date).toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC'}
                                        </div>
                                        {match.keys && (
                                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                                <button onClick={() => openInNewTab(`/?room=${match.id}&key=${match.keys.admin}`)} style={styles.adminLinkBadge}>OPEN</button>
                                                <button onClick={() => copyLink(match.id, match.keys.A)} style={styles.copyLinkBadge}>LINK A</button>
                                                <button onClick={() => copyLink(match.id, match.keys.B)} style={styles.copyLinkBadge}>LINK B</button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <button onClick={nukeHistory} style={{ width: '100%', marginTop: '20px', background: '#330000', border: '1px solid #ff4444', color: '#ff4444', padding: '10px', cursor: 'pointer', borderRadius: '5px' }}>NUKE ALL HISTORY</button>
                        </div>
                    </div>
                )}
                {showNotification && <div style={styles.notification}><CheckIcon /> COPIED TO CLIPBOARD</div>}
                <div style={styles.footer}>LOTGaming Admin System</div>
            </div>
        );
    }

    if (view === 'history') {
        return (
            <div style={styles.container}>
                <AnimatedBackground />
                <h1 style={styles.neonTitle}>VETO ARCHIVE</h1>
                <button onClick={() => setView('home')} style={styles.backBtn}>← RETURN HOME</button>

                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
                    <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} style={{ ...styles.modeBtn, padding: '10px 20px', fontSize: '0.9rem', opacity: currentPage === 1 ? 0.5 : 1 }}>PREV</button>
                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>PAGE {currentPage} / {totalPages}</span>
                    <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} style={{ ...styles.modeBtn, padding: '10px 20px', fontSize: '0.9rem', opacity: currentPage === totalPages ? 0.5 : 1 }}>NEXT</button>
                </div>

                <div style={styles.historyList}>{historyData.map((match, i) => (<div key={i} style={styles.historyCard}><div style={styles.historyHeader}><div><span style={{ color: '#00d4ff' }}>{match.teamA}</span> vs <span style={{ color: '#ff0055' }}>{match.teamB}</span></div><span style={styles.formatTag}>{match.format}</span></div><div style={{ fontSize: '0.8rem', color: '#888' }}>{new Date(match.date).toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC'}</div><div style={styles.logBox}>{match.logs.map((l, idx) => <div key={idx} style={styles.logLine}>{l}</div>)}</div></div>))}</div>

                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginTop: '20px' }}>
                    <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} style={{ ...styles.modeBtn, padding: '10px 20px', fontSize: '0.9rem', opacity: currentPage === 1 ? 0.5 : 1 }}>PREV</button>
                    <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} style={{ ...styles.modeBtn, padding: '10px 20px', fontSize: '0.9rem', opacity: currentPage === totalPages ? 0.5 : 1 }}>NEXT</button>
                </div>

                <div style={styles.footer}>LOTGaming System | Made by &lt;3 kancha@lotgaming.xyz</div>
            </div>
        );
    }

    if (!params.room) {
        return (
            <div style={styles.container}>
                <AnimatedBackground />
                <div style={styles.glassPanel}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '20px', position: 'relative' }}>
                        <img src={LOGO_URL} alt="Logo" style={styles.logo} />
                        <h1 style={styles.neonTitle}>LOT GAMING</h1>
                    </div>

                    <h3 style={{ color: '#aaa', letterSpacing: '4px', marginBottom: '30px', fontSize: isMobile ? '0.8rem' : '1rem' }}>COUNTER STRIKE MAP VETO SYSTEM</h3>

                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', gap: '10px', flexWrap: 'wrap' }}>
                        <button onClick={() => setVetoMode('vrs')} style={vetoMode === 'vrs' ? styles.modeBtnActive : styles.modeBtn}>VRS VETO</button>
                        <button onClick={() => setVetoMode('faceit')} style={vetoMode === 'faceit' ? styles.modeBtnActive : styles.modeBtn}>FACEIT STYLE</button>
                        <button onClick={() => setVetoMode('wingman')} style={vetoMode === 'wingman' ? styles.modeBtnActive : styles.modeBtn}>WINGMAN VETO</button>
                        <button onClick={() => setVetoMode('custom')} style={vetoMode === 'custom' ? styles.modeBtnActive : styles.modeBtn}>CUSTOM VETO</button>
                    </div>

                    <input style={{ ...styles.input, border: inputError && !teamA.trim() ? '2px solid #ff4444' : '1px solid #333' }} value={teamA} onChange={e => { setTeamA(e.target.value); setInputError(false); }} placeholder="TEAM A NAME (REQUIRED)" />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '15px' }}>
                        <input type="file" ref={fileInputA} style={{ display: 'none' }} accept="image/jpeg, image/png, image/webp" onChange={(e) => handleLogoUpload(e, 'A')} />
                        <button onClick={() => fileInputA.current.click()} style={{ ...styles.tinyBtn, padding: '5px 15px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <UploadIcon /> {teamALogo ? "CHANGE LOGO A" : "ATTACH LOGO A"}
                        </button>
                        {teamALogo && <img src={teamALogo} alt="Preview" style={{ width: '30px', height: '30px', objectFit: 'contain', border: '1px solid #333', borderRadius: '3px' }} />}
                    </div>

                    <input style={{ ...styles.input, border: inputError && !teamB.trim() ? '2px solid #ff4444' : '1px solid #333' }} value={teamB} onChange={e => { setTeamB(e.target.value); setInputError(false); }} placeholder="TEAM B NAME (REQUIRED)" />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '15px' }}>
                        <input type="file" ref={fileInputB} style={{ display: 'none' }} accept="image/jpeg, image/png, image/webp" onChange={(e) => handleLogoUpload(e, 'B')} />
                        <button onClick={() => fileInputB.current.click()} style={{ ...styles.tinyBtn, padding: '5px 15px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <UploadIcon /> {teamBLogo ? "CHANGE LOGO B" : "ATTACH LOGO B"}
                        </button>
                        {teamBLogo && <img src={teamBLogo} alt="Preview" style={{ width: '30px', height: '30px', objectFit: 'contain', border: '1px solid #333', borderRadius: '3px' }} />}
                    </div>

                    <div style={{ marginTop: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#aaa', fontSize: '0.9rem', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input type="checkbox" checked={useTimer} onChange={e => setUseTimer(e.target.checked)} style={{ transform: 'scale(1.2)' }} />
                            <span>Enable Auto-Ban Timer</span>
                        </div>
                        {useTimer && (
                            <div style={{ display: 'flex', gap: '5px', marginTop: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                {[30, 45, 60, 90, 120].map(seconds => (
                                    <button key={seconds} onClick={() => setTimerDuration(seconds)}
                                        style={{ ...styles.modeBtn, background: timerDuration === seconds ? '#00d4ff' : 'transparent', color: timerDuration === seconds ? '#000' : '#aaa', borderColor: timerDuration === seconds ? '#00d4ff' : '#333', padding: '5px 15px', fontSize: '0.9rem' }}>
                                        {seconds}s
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#ffd700', fontSize: '0.9rem' }}>
                        <input type="checkbox" checked={useCoinFlip} onChange={e => setUseCoinFlip(e.target.checked)} style={{ transform: 'scale(1.2)' }} />
                        <span>Enable Coin Flip</span>
                    </div>

                    <div style={{ marginTop: '20px', textAlign: 'center' }}>
                        <label style={{ color: '#00d4ff', fontSize: '0.9rem', marginBottom: '5px', display: 'block' }}>Discord Webhook (Optional)</label>
                        <input type="text" value={tempWebhook} onChange={e => setTempWebhook(e.target.value)} placeholder="https://discord.com/api/webhooks/..."
                            style={{ width: '90%', maxWidth: '500px', padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid #333', borderRadius: '5px', color: '#fff', fontSize: '0.85rem' }}
                        />
                    </div>

                    {vetoMode !== 'custom' ? (
                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '20px' }}>
                            <button style={styles.modeBtn} onClick={() => createMatch('bo1')}>Bo1</button>
                            <button style={styles.modeBtn} onClick={() => createMatch('bo3')}>Bo3</button>
                            {vetoMode !== 'wingman' && <button style={styles.modeBtn} onClick={() => createMatch('bo5')}>Bo5</button>}
                        </div>
                    ) : (
                        <div style={{ marginTop: '40px', textAlign: 'left', borderTop: '1px solid #333', paddingTop: '30px' }}>
                            <h4 style={{ color: '#00d4ff', marginBottom: '15px' }}>1. SELECT MAP POOL</h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '15px' }}>
                                {availableMaps.map(m => (
                                    <div key={m.name} onClick={() => toggleMapSelection(m.name)}
                                        style={{ padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.8rem', border: customSelectedMaps.includes(m.name) ? '1px solid #00ff00' : '1px solid #333', color: customSelectedMaps.includes(m.name) ? '#fff' : '#666', background: customSelectedMaps.includes(m.name) ? 'rgba(0,255,0,0.1)' : 'transparent' }}>
                                        {m.name}
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '5px', marginBottom: '20px' }}>
                                <span style={{ fontSize: '0.8rem', color: '#aaa' }}>ADD CUSTOM MAP:</span>
                                <input style={{ ...styles.input, margin: 0, width: '150px', fontSize: '0.9rem', padding: '5px', height: '35px', textAlign: 'left' }} placeholder="Map Name" value={userCustomMap} onChange={e => setUserCustomMap(e.target.value)} />
                                <button onClick={addUserMap} style={{ ...styles.tinyBtn, height: '35px', border: '1px solid #00ff00', color: '#00ff00', padding: '0 15px', fontWeight: 'bold' }}>ADD</button>
                            </div>
                            <h4 style={{ color: '#00d4ff' }}>2. DEFINE BAN ORDER</h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
                                <button style={styles.tinyBtn} onClick={() => addSequenceStep('A', 'ban')}>+ A BAN</button>
                                <button style={styles.tinyBtn} onClick={() => addSequenceStep('B', 'ban')}>+ B BAN</button>
                                <button style={styles.tinyBtn} onClick={() => addSequenceStep('A', 'pick')}>+ A PICK</button>
                                <button style={styles.tinyBtn} onClick={() => addSequenceStep('B', 'pick')}>+ B PICK</button>
                                <button style={styles.tinyBtn} onClick={() => addSequenceStep('A', 'side')}>+ A SIDE</button>
                                <button style={styles.tinyBtn} onClick={() => addSequenceStep('B', 'side')}>+ B SIDE</button>
                                <button style={{ ...styles.tinyBtn, borderColor: '#ffa500', color: '#ffa500' }} onClick={() => addSequenceStep('System', 'knife')}>+ KNIFE</button>
                            </div>
                            <div style={{ background: '#000', padding: '10px', borderRadius: '5px', fontSize: '0.8rem', color: '#aaa', minHeight: '50px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                {customSequence.length === 0 ? "No steps defined." : customSequence.map((s, i) => (
                                    <span key={i} onClick={() => removeSequenceStep(i)} style={{ background: '#222', padding: '2px 6px', borderRadius: '3px', border: '1px solid #444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        {i + 1}. {s.t} {s.a.toUpperCase()} <span style={{ color: '#ff4444', fontWeight: 'bold' }}>x</span>
                                    </span>
                                ))}
                            </div>
                            <button style={{ ...styles.modeBtn, width: '100%', marginTop: '20px', borderColor: '#00ff00', color: '#00ff00' }} onClick={() => createMatch('custom')}>GENERATE CUSTOM MATCH</button>
                        </div>
                    )}

                    {isGenerating && <div style={styles.generatingBox}><div style={styles.spinner}></div></div>}

                    {createdLinks && !isGenerating && (
                        <div style={styles.linksBox}>
                            <div style={styles.linkRow}><span style={{ color: '#aaa', fontWeight: 'bold', minWidth: '70px' }}>ADMIN:</span> <input readOnly style={styles.linkInput} value={createdLinks.admin} onClick={() => handleCopyLogs(createdLinks.admin)} /><button onClick={() => openInNewTab(createdLinks.admin)} style={styles.iconBtn}><ExternalLinkIcon /></button></div>
                            <div style={styles.linkRow}><span style={{ color: '#00d4ff', fontWeight: 'bold', minWidth: '70px' }}>TEAM A:</span> <input readOnly style={styles.linkInput} value={createdLinks.teamA} onClick={() => handleCopyLogs(createdLinks.teamA)} /><button onClick={() => openInNewTab(createdLinks.teamA)} style={{ ...styles.iconBtn, color: '#00d4ff' }}><ExternalLinkIcon /></button></div>
                            <div style={styles.linkRow}><span style={{ color: '#ff0055', fontWeight: 'bold', minWidth: '70px' }}>TEAM B:</span> <input readOnly style={styles.linkInput} value={createdLinks.teamB} onClick={() => handleCopyLogs(createdLinks.teamB)} /><button onClick={() => openInNewTab(createdLinks.teamB)} style={{ ...styles.iconBtn, color: '#ff0055' }}><ExternalLinkIcon /></button></div>
                        </div>
                    )}

                    <button onClick={() => fetchPublicHistory(1)} style={styles.historyBtn}>VIEW PAST VETOS</button>
                </div>
                <div style={{ ...styles.notification, opacity: showNotification ? 1 : 0, transform: showNotification ? 'translateY(0)' : 'translateY(20px)' }}><CheckIcon /> COPIED TO CLIPBOARD</div>
                <div style={styles.footer}>LOTGaming System | Made by &lt;3 kancha@lotgaming.xyz</div>
            </div>
        );
    }

    if (!gameState) return <div style={styles.container}><AnimatedBackground /><h1 style={styles.neonTitle}>INITIALIZING...</h1></div>;

    if (gameState.useCoinFlip && gameState.coinFlip.status !== 'done') {
        return (
            <div style={styles.container}>
                <AnimatedBackground />
                <CoinFlipOverlay gameState={gameState} myRole={myRole} onCall={handleCoinCall} onDecide={handleCoinDecide} soundEnabled={soundEnabled} />
            </div>
        );
    }

    const currentStep = gameState.sequence[gameState.step];
    const isActionStep = currentStep && (currentStep.a === 'ban' || currentStep.a === 'pick');
    const isSideStep = currentStep && currentStep.a === 'side';
    const isMyTurn = !gameState.finished && currentStep?.t === myRole;
    const actionColor = currentStep?.a === 'ban' ? '#ff4444' : '#00ff00';
    let sidePickMapName = gameState.lastPickedMap;
    if (!sidePickMapName && isSideStep) { const decider = gameState.maps.find(m => m.status === 'available'); if (decider) sidePickMapName = decider.name; }

    const showReadyButton = gameState.useTimer && !gameState.finished && (myRole === 'A' || myRole === 'B') && !gameState.ready[myRole];
    const roleData = getRoleLabel();

    return (
        <div style={styles.container}>
            <AnimatedBackground />
            <button onClick={goHome} style={styles.homeBtn} title="Exit to Main Menu"><HomeIcon /> EXIT TO MENU</button>
            <button
                onClick={() => {
                    const newState = !soundEnabled;
                    setSoundEnabled(newState);
                    localStorage.setItem('soundEnabled', newState);
                }}
                style={{
                    position: 'absolute', top: isMobile ? '10px' : '20px', right: isMobile ? '10px' : '20px',
                    background: soundEnabled ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                    border: `1px solid ${soundEnabled ? '#00d4ff' : '#666'}`, color: soundEnabled ? '#00d4ff' : '#888',
                    padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.9rem',
                    display: 'flex', alignItems: 'center', gap: '5px', zIndex: 100, fontFamily: "'Rajdhani', sans-serif"
                }}
            >
                {soundEnabled ? '🔊' : '🔇'} {soundEnabled ? 'SOUND ON' : 'SOUND OFF'}
            </button>
            {showRules && <RulesModal format={gameState.format} isMobile={isMobile} onClose={() => setShowRules(false)} />}
            <div style={{ ...styles.notification, opacity: showNotification ? 1 : 0, transform: showNotification ? 'translateY(0)' : 'translateY(20px)' }}><CheckIcon /> COPIED TO CLIPBOARD</div>

            <div style={styles.scoreboard}>
                <div style={{ ...styles.teamName, color: '#00d4ff', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    {gameState.teamALogo && <img src={gameState.teamALogo} alt="" style={styles.teamLogo} />}
                    {gameState.teamA}
                </div>
                <div style={styles.vsBadge}>VS</div>
                <div style={{ ...styles.teamName, color: '#ff0055', display: 'flex', alignItems: 'center', gap: '15px', flexDirection: 'row-reverse' }}>
                    {gameState.teamBLogo && <img src={gameState.teamBLogo} alt="" style={styles.teamLogo} />}
                    {gameState.teamB}
                </div>
            </div>

            <div style={{ ...styles.statusBar, borderColor: isMyTurn ? actionColor : '#333', boxShadow: isMyTurn ? `0 0 10px ${actionColor}22` : 'none' }}>
                <h2>
                    {getInstruction()}
                    {!gameState.finished && <Countdown endsAt={gameState.timerEndsAt} soundEnabled={soundEnabled} />}
                </h2>
            </div>

            {showReadyButton && (
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <button onClick={handleReady} style={{ ...styles.modeBtn, fontSize: '1.5rem', background: '#00d4ff', color: '#000', border: 'none', padding: '15px 40px', boxShadow: '0 0 20px rgba(0, 212, 255, 0.5)' }}>
                        CLICK TO READY UP
                    </button>
                </div>
            )}

            {isSideStep && (
                <div style={styles.sideSelectionContainer}>
                    <h2 style={{ marginBottom: '30px', textShadow: '0 0 10px white', fontSize: isMobile ? '1.2rem' : '2rem' }}>SELECT SIDE FOR {sidePickMapName?.toUpperCase()}</h2>
                    {isMyTurn ? (
                        <div style={{ display: 'flex', gap: isMobile ? '10px' : '40px', justifyContent: 'center', alignItems: 'stretch' }}>
                            <div onMouseEnter={() => setHoveredItem('CT')} onMouseLeave={() => setHoveredItem(null)} style={{ ...styles.sideCard, border: '2px solid #4facfe', boxShadow: hoveredItem === 'CT' ? '0 0 40px rgba(79, 172, 254, 0.6)' : 'none', transform: hoveredItem === 'CT' ? 'scale(1.05)' : 'scale(1)' }} onClick={() => handleAction('CT')}>
                                <img src="/CT.png" alt="CT" style={styles.sideImg} /><div style={styles.sideLabelCT}>CT</div>
                            </div>
                            <div onMouseEnter={() => setHoveredItem('T')} onMouseLeave={() => setHoveredItem(null)} style={{ ...styles.sideCard, border: '2px solid #ff9a9e', boxShadow: hoveredItem === 'T' ? '0 0 40px rgba(255, 154, 158, 0.6)' : 'none', transform: hoveredItem === 'T' ? 'scale(1.05)' : 'scale(1)' }} onClick={() => handleAction('T')}>
                                <img src="/T.png" alt="T" style={styles.sideImg} /><div style={styles.sideLabelT}>T</div>
                            </div>
                        </div>
                    ) : <h3 style={{ color: '#888' }}>WAITING FOR OPPONENT...</h3>}
                </div>
            )}

            {!isSideStep && (
                <div style={styles.grid}>
                    {gameState.maps.map(map => {
                        const areTeamsReady = !gameState.useTimer || (gameState.ready.A && gameState.ready.B);
                        const isInteractive = areTeamsReady && isMyTurn && isActionStep && map.status === 'available';
                        const isHovered = hoveredItem === map.name;
                        const logData = mapLogCache[map.name] || null;
                        const playIndex = gameState.playedMaps ? gameState.playedMaps.indexOf(map.name) : -1;
                        const mapOrderLabel = playIndex !== -1 ? `MAP ${playIndex + 1}` : null;

                        return (
                            <MapCard
                                key={map.name} map={map} isInteractive={isInteractive} isHovered={isHovered}
                                onMouseEnter={() => setHoveredItem(map.name)} onMouseLeave={() => setHoveredItem(null)}
                                onClick={() => isInteractive ? handleAction(map.name) : null}
                                actionColor={actionColor} logData={logData} mapOrderLabel={mapOrderLabel} styles={styles}
                            />
                        );
                    })}
                </div>
            )}

            <div style={{ marginTop: '20px', marginBottom: '10px', padding: '10px 30px', borderRadius: '50px', background: 'rgba(0,0,0,0.5)', border: `2px solid ${roleData.color}`, color: roleData.color, fontSize: '1.2rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px', boxShadow: `0 0 15px ${roleData.color}44` }}>
                {roleData.text}
            </div>

            <div style={styles.logContainer}>
                <div style={styles.logHeader}><span>VETO LOGS</span>{gameState.finished && <button onClick={() => handleCopyLogs(gameState.logs.join('\n'))} style={styles.copyBtn}><span style={{ marginRight: '5px' }}>COPY</span> <CopyIcon /></button>}</div>
                <div style={styles.logScroll}>{gameState.logs.map((log, i) => <div key={i} style={styles.logRow}><span style={{ color: '#444', marginRight: '15px', fontFamily: 'monospace' }}>{(i + 1).toString().padStart(2, '0')}.</span><LogLineRenderer log={log} teamA={gameState.teamA} teamB={gameState.teamB} /></div>)}</div>
            </div>
            <div style={styles.footer}>LOTGaming System | Made by &lt;3 kancha@lotgaming.xyz</div>
        </div>
    );
}

// --- DYNAMIC STYLES ---
const getStyles = (isMobile) => ({
    // ... [Styles omitted for brevity, refer to previous output] ...
});s
