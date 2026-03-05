import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { AnimatedBackground, HomeIcon, CopyIcon, CheckIcon } from '../components/SharedUI';

const SOCKET_URL = window.location.hostname === "localhost" ? "http://localhost:3001" : "https://cs2-veto-server-gh3n.onrender.com";

let globalAudioContext = null;

const playSound = (type = 'action') => {
    try {
        if (!globalAudioContext) globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (globalAudioContext.state === 'suspended') globalAudioContext.resume();

        const oscillator = globalAudioContext.createOscillator();
        const gainNode = globalAudioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(globalAudioContext.destination);

        switch (type) {
            case 'ban':
                oscillator.frequency.value = 220; oscillator.type = 'sine'; 
                gainNode.gain.setValueAtTime(0.08, globalAudioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.001, globalAudioContext.currentTime + 0.15); 
                oscillator.start(globalAudioContext.currentTime); oscillator.stop(globalAudioContext.currentTime + 0.15); break;
            case 'pick':
                oscillator.frequency.value = 330; oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.08, globalAudioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.001, globalAudioContext.currentTime + 0.12); 
                oscillator.start(globalAudioContext.currentTime); oscillator.stop(globalAudioContext.currentTime + 0.12); break;
            case 'side':
                oscillator.frequency.value = 275; oscillator.type = 'sine'; 
                gainNode.gain.setValueAtTime(0.07, globalAudioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.001, globalAudioContext.currentTime + 0.1); 
                oscillator.start(globalAudioContext.currentTime); oscillator.stop(globalAudioContext.currentTime + 0.1); break;
            case 'ready':
                oscillator.frequency.value = 440; oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.06, globalAudioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.001, globalAudioContext.currentTime + 0.08); 
                oscillator.start(globalAudioContext.currentTime); oscillator.stop(globalAudioContext.currentTime + 0.08); break;
            case 'countdown':
                oscillator.frequency.value = 400; oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.05, globalAudioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.001, globalAudioContext.currentTime + 0.05); 
                oscillator.start(globalAudioContext.currentTime); oscillator.stop(globalAudioContext.currentTime + 0.05); break;
            default:
                oscillator.frequency.value = 300; oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.07, globalAudioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.001, globalAudioContext.currentTime + 0.12); 
                oscillator.start(globalAudioContext.currentTime); oscillator.stop(globalAudioContext.currentTime + 0.12);
        }
    } catch (e) { /* silent fail */ }
};

const getMapNameWithPrefix = (mapName) => {
    if (!mapName) return mapName;
    if (mapName.includes('_')) return mapName.toLowerCase();

    const defusalMaps = ['dust2', 'inferno', 'mirage', 'overpass', 'nuke', 'anubis', 'ancient', 'vertigo', 'cache', 'train', 'cobblestone', 'tuscan'];
    const lowerName = mapName.toLowerCase();
    if (defusalMaps.some(m => lowerName.includes(m))) return `de_${lowerName}`;
    return `de_${lowerName}`;
};

const getMapImageUrl = (mapName, customImage = null) => {
    if (customImage) return { primary: customImage, fallbacks: [] };
    const mapWithPrefix = getMapNameWithPrefix(mapName);
    const baseName = mapWithPrefix.toLowerCase();
    return { 
        primary: `https://raw.githubusercontent.com/rpkaul/cs-map-images/refs/heads/main/${baseName}.png`, 
        fallbacks: [
            `https://raw.githubusercontent.com/rpkaul/cs-map-images/refs/heads/main/${baseName}.jpg`,
            `https://image.gametracker.com/images/maps/160x120/csgo/${baseName}.jpg`
        ] 
    };
};

const MapCard = React.memo(({ map, isInteractive, onMouseEnter, onMouseLeave, onClick, actionColor, logData, mapOrderLabel, styles }) => {
    const mapImageUrls = getMapImageUrl(map.name, map.customImage);
    const [imageUrl, setImageUrl] = useState(mapImageUrls.primary);
    const [imageFailed, setImageFailed] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        if (map.customImage) return;
        let testImage = new Image(); 
        let currentIndex = 0; 
        const allUrls = [mapImageUrls.primary, ...mapImageUrls.fallbacks]; 

        const tryNextUrl = () => {
            if (currentIndex >= allUrls.length) { setImageFailed(true); return; }
            testImage.src = allUrls[currentIndex];
        };

        testImage.onload = () => { setImageUrl(allUrls[currentIndex]); setImageFailed(false); };
        testImage.onerror = () => { currentIndex++; tryNextUrl(); };
        tryNextUrl();

        return () => { testImage.onload = null; testImage.onerror = null; };
    }, [map.name, map.customImage]); 

    const cardStyle = {
        ...styles.mapCard,
        backgroundImage: imageFailed ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' : `linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%), url(${imageUrl})`,
        opacity: map.status === 'banned' ? 0.3 : 1,
        filter: map.status === 'banned' ? 'grayscale(100%)' : 'none',
        border: map.status === 'picked' ? '3px solid #00ff00' : map.status === 'decider' ? '3px solid #ffa500' : isInteractive ? `2px solid ${actionColor}` : '1px solid rgba(255,255,255,0.1)',
        cursor: (map.status === 'available' && isInteractive) ? 'pointer' : 'default',
        boxShadow: (isInteractive && isHovered) ? `0 0 20px ${actionColor}` : '0 5px 15px rgba(0,0,0,0.5)',
        transform: (isInteractive && isHovered) ? 'scale(1.05) translateY(-5px)' : 'scale(1)',
    };

    return (
        <div onMouseEnter={() => { setIsHovered(true); onMouseEnter && onMouseEnter(); }} onMouseLeave={() => { setIsHovered(false); onMouseLeave && onMouseLeave(); }} onClick={onClick} style={cardStyle}>
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

export default function VetoRoom() {
    const { orgId, tournamentId, matchId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const socketRef = useRef(null);

    const [gameState, setGameState] = useState(null);
    const [myRole, setMyRole] = useState(null);
    const [serverError, setServerError] = useState(null);
    const [roomUserCount, setRoomUserCount] = useState(0);
    const [hoveredItem, setHoveredItem] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('soundEnabled') !== 'false');
    const [showNotification, setShowNotification] = useState(false);
    
    const prevLogsRef = useRef([]);
    const soundEnabledRef = useRef(soundEnabled);
    const styles = useMemo(() => getStyles(isMobile), [isMobile]);

    useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);

        const key = searchParams.get('key') || sessionStorage.getItem(`lot_key_${matchId}`);
        if (key) sessionStorage.setItem(`lot_key_${matchId}`, key);

        socketRef.current = io(SOCKET_URL);
        socketRef.current.emit('join_room', { roomId: matchId, key });

        socketRef.current.on('room_user_count', ({ count }) => setRoomUserCount(count));
        socketRef.current.on('error', (msg) => { setServerError(msg); setTimeout(() => setServerError(null), 4000); });
        socketRef.current.on('role_assigned', (role) => setMyRole(role));

        socketRef.current.on('update_state', (data) => {
            if (data && data.logs && prevLogsRef.current.length > 0 && soundEnabledRef.current) {
                const newLogs = data.logs.slice(prevLogsRef.current.length);
                newLogs.forEach(log => {
                    if (log.includes('[BAN]')) playSound('ban');
                    else if (log.includes('[PICK]')) playSound('pick');
                    else if (log.includes('[SIDE]') || (log.includes('chose') && log.includes('side'))) playSound('side');
                    else if (log.includes('[READY]')) playSound('ready');
                });
            }
            if (data && data.logs) prevLogsRef.current = [...data.logs];
            setGameState(data);
        });

        return () => {
            window.removeEventListener('resize', handleResize);
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, [matchId, searchParams]);

    const mapLogCache = useMemo(() => {
        const cache = {};
        if (!gameState?.logs) return cache;
        gameState.logs.forEach(log => {
            if (log.includes('banned')) {
                const mapMatch = log.match(/banned (.*?)(\s|$|\()/);
                if (mapMatch) cache[mapMatch[1].trim()] = { type: 'ban', team: log.split(' banned ')[0].replace(/\[.*?\] /g, '').trim() };
            } else if (log.includes('picked')) {
                const mapMatch = log.match(/picked (.*?)(\s|$|\()/);
                if (mapMatch) {
                    const inlineMatch = log.match(/\((.*?) chose (CT|T) side for/);
                    cache[mapMatch[1].trim()] = { type: 'pick', team: log.split(' picked ')[0].replace(/\[.*?\] /g, '').trim(), sideText: inlineMatch ? `${inlineMatch[1]} CHOSE ${inlineMatch[2]}` : "WAITING FOR SIDE" };
                }
            } else if (log.includes('[DECIDER]')) {
                const mapMatch = log.match(/\[DECIDER\] (.*?) \(/);
                if (mapMatch) cache[mapMatch[1].trim()] = { type: 'decider', sideText: 'SIDE VIA KNIFE' };
            }
        });
        return cache;
    }, [gameState?.logs]);

    const handleAction = useCallback((data) => {
        if (!gameState || gameState.finished) return;
        socketRef.current.emit('action', { roomId: matchId, data, key: sessionStorage.getItem(`lot_key_${matchId}`) });
    }, [gameState, matchId]);

    const handleReady = useCallback(() => {
        if (soundEnabledRef.current) playSound('ready');
        socketRef.current.emit('team_ready', { roomId: matchId, key: sessionStorage.getItem(`lot_key_${matchId}`) });
    }, [matchId]);

    if (!gameState) return <div style={styles.container}><AnimatedBackground /><h1 style={{fontSize:'2rem', fontWeight:'bold', color:'#00d4ff'}}>SYNCING ROOM...</h1></div>;

    const currentStep = gameState.sequence[gameState.step];
    const isActionStep = currentStep && (currentStep.a === 'ban' || currentStep.a === 'pick');
    const isSideStep = currentStep && currentStep.a === 'side';
    const isMyTurn = !gameState.finished && currentStep?.t === myRole;
    const actionColor = currentStep?.a === 'ban' ? '#ff4444' : '#00ff00';
    const showReadyButton = gameState.useTimer && !gameState.finished && (myRole === 'A' || myRole === 'B') && !gameState.ready[myRole];

    let instruction = "VETO COMPLETED";
    if (!gameState.finished && currentStep) {
        const teamName = currentStep.t === 'A' ? gameState.teamA : gameState.teamB;
        if (gameState.useTimer && gameState.ready && (!gameState.ready.A || !gameState.ready.B)) instruction = (isMyTurn && !gameState.ready[myRole]) ? "PLEASE CLICK READY" : "WAITING FOR READY";
        else instruction = isMyTurn ? `YOUR TURN: ${currentStep.a.toUpperCase()}` : `WAITING FOR ${teamName.toUpperCase()}`;
    }

    return (
        <div style={styles.container}>
            <AnimatedBackground />
            <button onClick={() => navigate('/')} style={styles.homeBtn}><HomeIcon /> EXIT</button>
            <div style={{ position: 'absolute', top: '20px', right: '20px', color: '#888', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00ff00', boxShadow: '0 0 5px #00ff00' }}></div>
                {roomUserCount} VIEWERS
            </div>

            {serverError && <div style={{ ...styles.notification, background: '#ff4444', color: '#fff', opacity: 1 }}>⚠️ {serverError}</div>}

            <div style={styles.scoreboard}>
                <div style={{ fontSize: '2rem', fontWeight: '900', color: '#00d4ff' }}>{gameState.teamA}</div>
                <div style={{ background: '#fff', color: '#000', padding: '5px 15px', borderRadius: '20px', fontWeight: '900' }}>VS</div>
                <div style={{ fontSize: '2rem', fontWeight: '900', color: '#ff0055' }}>{gameState.teamB}</div>
            </div>

            <div style={{ ...styles.statusBar, borderColor: isMyTurn ? actionColor : '#333', boxShadow: isMyTurn ? `0 0 10px ${actionColor}22` : 'none' }}>
                <h2>{instruction}</h2>
            </div>

            {showReadyButton && (
                <button onClick={handleReady} style={{ background: '#00d4ff', color: '#000', border: 'none', padding: '15px 40px', fontSize: '1.5rem', fontWeight: 'bold', borderRadius: '10px', cursor: 'pointer', marginBottom: '20px' }}>
                    CLICK TO READY UP
                </button>
            )}

            {!isSideStep && (
                <div style={styles.grid}>
                    {gameState.maps.map(map => {
                        const isInteractive = (!gameState.useTimer || (gameState.ready.A && gameState.ready.B)) && isMyTurn && isActionStep && map.status === 'available';
                        const playIndex = gameState.playedMaps ? gameState.playedMaps.indexOf(map.name) : -1;
                        return (
                            <MapCard key={map.name} map={map} isInteractive={isInteractive} onClick={() => isInteractive ? handleAction(map.name) : null}
                                actionColor={actionColor} logData={mapLogCache[map.name]} mapOrderLabel={playIndex !== -1 ? `MAP ${playIndex + 1}` : null} styles={styles}
                            />
                        );
                    })}
                </div>
            )}

            {isSideStep && (
                <div style={{ background: 'rgba(0,0,0,0.8)', border: '1px solid #333', borderRadius: '15px', padding: '40px', textAlign: 'center', width: '100%', maxWidth: '800px' }}>
                    <h2 style={{ marginBottom: '30px' }}>SELECT SIDE</h2>
                    {isMyTurn ? (
                        <div style={{ display: 'flex', gap: '40px', justifyContent: 'center' }}>
                            <div style={{ flex: 1, background: '#111', borderRadius: '10px', padding: '20px', cursor: 'pointer', border: '2px solid #4facfe' }} onClick={() => handleAction('CT')}>
                                <h1 style={{ color: '#4facfe', fontSize: '3rem', margin: 0 }}>CT</h1>
                            </div>
                            <div style={{ flex: 1, background: '#111', borderRadius: '10px', padding: '20px', cursor: 'pointer', border: '2px solid #ff9a9e' }} onClick={() => handleAction('T')}>
                                <h1 style={{ color: '#ff9a9e', fontSize: '3rem', margin: 0 }}>T</h1>
                            </div>
                        </div>
                    ) : <h3 style={{ color: '#888' }}>WAITING FOR OPPONENT...</h3>}
                </div>
            )}
        </div>
    );
}

const getStyles = (isMobile) => ({
    container: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: "'Rajdhani', sans-serif", color: 'white', padding: isMobile ? '10px' : '20px', boxSizing: 'border-box' },
    scoreboard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '1200px', marginBottom: '20px', background: 'rgba(0,0,0,0.6)', padding: '15px 30px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' },
    statusBar: { background: 'rgba(0,0,0,0.8)', padding: '15px 30px', borderRadius: '50px', border: '2px solid #333', marginBottom: '30px' },
    grid: { display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', width: '100%', maxWidth: '1400px' },
    mapCard: { backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: '10px', height: isMobile ? '120px' : '250px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', overflow: 'hidden', transition: 'all 0.2s ease', position: 'relative' },
    cardContent: { padding: '15px', background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)', textAlign: 'center' },
    mapTitle: { fontSize: '1.8rem', fontWeight: '900', textTransform: 'uppercase' },
    badgeBan: { background: '#ff4444', color: 'white', padding: '3px 8px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 'bold', marginTop: '5px' },
    badgePick: { background: '#00ff00', color: 'black', padding: '3px 8px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 'bold', marginTop: '5px' },
    badgeDecider: { background: '#ffa500', color: 'black', padding: '3px 8px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 'bold', marginTop: '5px' },
    homeBtn: { position: 'absolute', top: '20px', left: '20px', background: 'rgba(0,0,0,0.5)', border: '1px solid #333', color: '#aaa', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' },
    notification: { position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: '#00ff00', color: '#000', padding: '10px 20px', borderRadius: '50px', fontWeight: 'bold', zIndex: 4000 }
});
