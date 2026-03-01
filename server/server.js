// File: server.js
/**
 * ⚡ COMP-OS — VETO ENGINE SERVER
 * =============================================================================
 * FILE          : server.js
 * RESPONSIBILITY: Real-time Map Veto Orchestration & Persistence
 * LAYER         : Backend (Node.js / Express / Socket.io)
 * RISK LEVEL    : CRITICAL
 * =============================================================================
 *
 * RELEASE METADATA
 * -----------------------------------------------------------------------------
 * VERSION       : v4.0.0 (SECURE-ORBIT)
 * STATUS        : ENFORCED
 *
 * FEATURES:
 * - Constant-Time String Comparison for Admin Secrets.
 * - Socket-level Rate Limiting to prevent memory exhaustion.
 * - SSRF Protections on dynamic Discord webhooks.
 * - Strict CORS policy enforcement in Production.
 * =============================================================================
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('dotenv').config();

// Load webhook modules
const discordWebhook = require('./discord-webhook');
const settings = require('./settings');

// Load database module with error handling
let db;
let dbError = null;
try {
    db = require('./db');
} catch (error) {
    dbError = error;
    console.error('\n═══════════════════════════════════════════════════════════');
    console.error('[SERVER] ❌ CRITICAL ERROR: Failed to load database module!');
    console.error('═══════════════════════════════════════════════════════════\n');
    console.error('Error:', error.message);
    process.exit(1);
}

const app = express();

// 🛡️ SECURITY FIX: Lock CORS to intended domains in production to prevent hijack connections
const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : []) 
    : "*";

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

const MAPS_FILE = path.join(__dirname, 'maps.json');
const HISTORY_FILE = path.join(__dirname, 'match_history.json'); // 🛡️ CRASH FIX: Moved to global scope so reset endpoint can see it

// 🛡️ SECURITY FIX: Refuse to boot if production is missing a secret
const IS_PROD = process.env.NODE_ENV === 'production';
if (IS_PROD && !process.env.ADMIN_SECRET) {
    console.error('[SERVER] ❌ FATAL: ADMIN_SECRET must be set in production!');
    process.exit(1);
}
const MASTER_SECRET = process.env.ADMIN_SECRET || "default_secret";

let rooms = {};

// --- 5v5 MAPS ---
const DEFAULT_MAPS = [
    { name: "Dust2" }, { name: "Inferno" }, { name: "Mirage" },
    { name: "Overpass" }, { name: "Nuke" }, { name: "Anubis" }, { name: "Ancient" }
];

// --- WINGMAN MAPS ---
const WINGMAN_MAPS = [
    { name: "Vertigo" }, { name: "Nuke" }, { name: "Inferno" },
    { name: "Overpass" }, { name: "Sanctum" }, { name: "Poseidon" }
];

let activeMaps = [...DEFAULT_MAPS];

// 🛡️ SECURITY FIX: Constant-time comparison prevents timing attacks on admin endpoints
function safeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
}

// 🛡️ SECURITY FIX: Centralized Authorization logic
function authorize(room, key, requiredTeam = null) {
    if (!room || !key || typeof key !== 'string') return false;
    if (safeCompare(key, room.keys.admin)) return true;
    if (requiredTeam && safeCompare(key, room.keys[requiredTeam])) return true;
    return false;
}

// 🛡️ SECURITY FIX: SSRF Validation for Webhooks
function isValidWebhook(url) {
    if (!url || typeof url !== 'string') return false;
    return url.startsWith('https://discord.com/api/webhooks/') || url.startsWith('https://discordapp.com/api/webhooks/');
}

// --- LOAD DATA ---
async function loadData() {
    try {
        await db.initDatabase();
        await settings.initSettingsTable();

        const savedMatches = await db.loadAllMatches();
        savedMatches.forEach(match => {
            rooms[match.id] = match;
        });

        // Migration: Load from JSON if it exists (one-time migration)
        if (fs.existsSync(HISTORY_FILE) && savedMatches.length === 0) {
            try {
                const savedData = JSON.parse(fs.readFileSync(HISTORY_FILE));
                for (const match of savedData) {
                    const matchData = {
                        ...match,
                        finished: match.finished || false,
                        timerDuration: match.timerDuration || 60
                    };
                    await db.saveMatch(matchData);
                    rooms[match.id] = matchData;
                }
            } catch (jsonError) {
                console.error("[MIGRATION] Error loading from JSON:", jsonError);
            }
        }
    } catch (e) {
        // Handled silently
    }
}

loadData().catch(error => {
    console.error('[SERVER] ❌ Failed to initialize database on startup:', error.message);
});

if (fs.existsSync(MAPS_FILE)) {
    try {
        activeMaps = JSON.parse(fs.readFileSync(MAPS_FILE));
    } catch (e) { }
} else {
    fs.writeFileSync(MAPS_FILE, JSON.stringify(activeMaps, null, 2));
}

async function saveHistory(roomId = null) {
    try {
        if (roomId && rooms[roomId]) {
            await db.saveMatch(rooms[roomId]);
        } else {
            for (const match of Object.values(rooms)) {
                await db.saveMatch(match);
            }
        }
    } catch (e) {
        console.error("[DB] Error saving history:", e);
    }
}

function saveMaps() {
    try {
        fs.writeFileSync(MAPS_FILE, JSON.stringify(activeMaps, null, 2));
    } catch (e) {
        console.error("Error saving maps:", e);
    }
}

// --- API ROUTES ---
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        database: db ? 'connected' : 'error',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/history', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const results = await db.getPaginatedMatches(page, limit);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch history" });
    }
});

app.get('/api/maps', (req, res) => res.json(activeMaps));

app.post('/api/admin/history', async (req, res) => {
    if (!safeCompare(req.body.secret, MASTER_SECRET)) return res.status(403).json({ error: "Invalid Key" });
    try {
        const activeMatches = Object.values(rooms).map(({ timerHandle, ...keep }) => keep);
        const dbMatches = await db.getAllMatches();

        const matchMap = new Map();
        dbMatches.forEach(m => matchMap.set(m.id, m));
        activeMatches.forEach(m => matchMap.set(m.id, m));

        const allMatches = Array.from(matchMap.values())
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json(allMatches);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch history" });
    }
});

app.post('/api/admin/delete', async (req, res) => {
    if (!safeCompare(req.body.secret, MASTER_SECRET)) return res.status(403).json({ error: "Invalid Key" });
    try {
        const room = rooms[req.body.id];
        if (room) {
            if (room.timerHandle) clearTimeout(room.timerHandle);
            delete rooms[req.body.id];
        }
        await db.deleteMatch(req.body.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete match" });
    }
});

app.post('/api/admin/reset', (req, res) => {
    if (!safeCompare(req.body.secret, MASTER_SECRET)) return res.status(403).json({ error: "Invalid Key" });
    Object.values(rooms).forEach(r => { if (r.timerHandle) clearTimeout(r.timerHandle); });
    rooms = {};
    if (fs.existsSync(HISTORY_FILE)) fs.unlinkSync(HISTORY_FILE);
    res.json({ success: true });
});

app.post('/api/admin/maps/get', (req, res) => {
    if (!safeCompare(req.body.secret, MASTER_SECRET)) return res.status(403).json({ error: "Invalid Key" });
    res.json(activeMaps);
});

app.post('/api/admin/maps/update', (req, res) => {
    if (!safeCompare(req.body.secret, MASTER_SECRET)) return res.status(403).json({ error: "Invalid Key" });
    if (!Array.isArray(req.body.maps)) return res.status(400).json({ error: "Invalid Data" });
    activeMaps = req.body.maps;
    saveMaps();
    res.json({ success: true, maps: activeMaps });
});

app.post('/api/admin/webhook/get', async (req, res) => {
    if (!safeCompare(req.body.secret, MASTER_SECRET)) return res.status(403).json({ error: "Invalid Key" });
    try {
        const webhookUrl = await settings.getAdminWebhook();
        res.json({ webhookUrl: webhookUrl || '' });
    } catch (error) {
        res.status(500).json({ error: "Failed to get webhook" });
    }
});

app.post('/api/admin/webhook/set', async (req, res) => {
    if (!safeCompare(req.body.secret, MASTER_SECRET)) return res.status(403).json({ error: "Invalid Key" });
    try {
        const { webhookUrl } = req.body;
        if (webhookUrl && !isValidWebhook(webhookUrl)) {
            return res.status(400).json({ error: "Invalid Discord webhook URL" });
        }
        await settings.setAdminWebhook(webhookUrl || '');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to set webhook" });
    }
});

app.post('/api/admin/webhook/test', async (req, res) => {
    if (!safeCompare(req.body.secret, MASTER_SECRET)) return res.status(403).json({ error: "Invalid Key" });
    try {
        const { webhookUrl } = req.body;
        if (!webhookUrl || !isValidWebhook(webhookUrl)) {
            return res.status(400).json({ error: "Valid Webhook URL required" });
        }
        await discordWebhook.testWebhook(webhookUrl);
        res.json({ success: true, message: "Webhook test successful" });
    } catch (error) {
        res.status(500).json({ error: error.message || "Webhook test failed" });
    }
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: allowedOrigins } });

let connectedUsers = 0;
const roomUserCounts = {};

// 🛡️ SECURITY FIX: Extremely basic rate limiting for memory-based server
const rateLimits = new Map();
function isRateLimited(socketId) {
    const now = Date.now();
    const limit = rateLimits.get(socketId) || { count: 0, resetAt: now + 60000 };
    if (now > limit.resetAt) {
        limit.count = 0;
        limit.resetAt = now + 60000;
    }
    if (limit.count >= 20) return true; // Max 20 actions per minute per socket
    limit.count++;
    rateLimits.set(socketId, limit);
    return false;
}

function broadcastUserCount() {
    io.emit('user_count', connectedUsers);
}

function broadcastRoomUserCount(roomId) {
    const count = roomUserCounts[roomId] || 0;
    io.to(roomId).emit('room_user_count', { roomId, count });
}

const SEQUENCES = {
    bo1: [{ t: 'A', a: 'ban' }, { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'ban' }, { t: 'B', a: 'side' }],
    bo3: [{ t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'pick' }, { t: 'B', a: 'side' }, { t: 'B', a: 'pick' }, { t: 'A', a: 'side' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'ban' }, { t: 'B', a: 'side' }],
    bo5: [{ t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'pick' }, { t: 'B', a: 'side' }, { t: 'B', a: 'pick' }, { t: 'A', a: 'side' }, { t: 'A', a: 'pick' }, { t: 'B', a: 'side' }, { t: 'B', a: 'pick' }, { t: 'A', a: 'side' }, { t: 'System', a: 'knife' }],
    faceit_bo1: [{ t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'System', a: 'knife' }],
    faceit_bo3: [{ t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'pick' }, { t: 'B', a: 'side' }, { t: 'B', a: 'pick' }, { t: 'A', a: 'side' }, { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'System', a: 'knife' }],
    faceit_bo5: [{ t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'pick' }, { t: 'B', a: 'side' }, { t: 'B', a: 'pick' }, { t: 'A', a: 'side' }, { t: 'A', a: 'pick' }, { t: 'B', a: 'side' }, { t: 'B', a: 'pick' }, { t: 'A', a: 'side' }, { t: 'System', a: 'knife' }],
    wingman_bo1: [{ t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'ban' }, { t: 'System', a: 'knife' }],
    wingman_bo3: [{ t: 'A', a: 'ban' }, { t: 'A', a: 'ban' }, { t: 'A', a: 'pick' }, { t: 'B', a: 'side' }, { t: 'B', a: 'pick' }, { t: 'A', a: 'side' }, { t: 'B', a: 'ban' }, { t: 'System', a: 'knife' }]
};

const generateKey = (len = 16) => crypto.randomBytes(len).toString('hex');

const startTurnTimer = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.finished) return;
    if (room.timerHandle) clearTimeout(room.timerHandle);
    const timerSeconds = room.timerDuration || 60; 
    const duration = timerSeconds * 1000; 
    room.timerEndsAt = Date.now() + duration;
    room.timerHandle = setTimeout(() => { handleAutoAction(roomId); }, duration);
};

const handleAutoAction = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.finished) return;
    const step = room.sequence[room.step];
    if (!step) return; 

    if (step.a === 'ban' || step.a === 'pick') {
        const availableMaps = room.maps.filter(m => m.status === 'available');
        if (availableMaps.length > 0) {
            const randomMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];
            const teamName = step.t === 'A' ? (room.teamA || 'Team A') : (step.t === 'B' ? (room.teamB || 'Team B') : 'System');
            if (step.a === 'ban') {
                randomMap.status = 'banned';
                room.logs.push(`[AUTO-BAN] ${teamName} banned ${randomMap.name} (Timeout)`);
            } else {
                randomMap.status = 'picked';
                randomMap.pickedBy = step.t;
                room.lastPickedMap = randomMap.name;
                room.playedMaps.push(randomMap.name);
                room.logs.push(`[AUTO-PICK] ${teamName} picked ${randomMap.name} (Timeout)`);
            }
            room.step++;
        }
    } else if (step.a === 'side') {
        let target = room.lastPickedMap;
        if (!target) { const d = room.maps.find(m => m.status === 'available'); if (d) target = d.name; }
        const idx = room.maps.findIndex(m => m.name === target);
        if (idx !== -1) {
            const randomSide = Math.random() > 0.5 ? 'CT' : 'T';
            room.maps[idx].side = randomSide;
            const teamName = step.t === 'A' ? (room.teamA || 'Team A') : (step.t === 'B' ? (room.teamB || 'Team B') : 'System');
            const lastLogIndex = room.logs.length - 1;
            const lastLog = room.logs[lastLogIndex];
            if (lastLog && lastLog.includes(`picked ${target}`)) {
                room.logs[lastLogIndex] = `${lastLog} (${teamName} chose ${randomSide} side for ${target})`;
            } else {
                room.logs.push(`[AUTO-SIDE] ${teamName} chose ${randomSide} for ${target} (Timeout)`);
            }
            room.lastPickedMap = null;
            room.step++;
        }
    }

    checkMatchEnd(room);
    if (!room.finished) { startTurnTimer(roomId); } else { room.timerEndsAt = null; }
    saveHistory(roomId);
    const { keys, timerHandle, ...safe } = room;
    io.to(roomId).emit('update_state', safe);
};

const checkMatchEnd = (room) => {
    let checking = true;
    while (checking && !room.finished) {
        checking = false;
        if (room.step >= room.sequence.length) {
            room.finished = true;
            const d = room.maps.find(m => m.status === 'available');
            if (d && d.status !== 'picked') { d.status = 'decider'; room.playedMaps.push(d.name); }
            break;
        }
        const nextStep = room.sequence[room.step];
        if (nextStep && nextStep.a === 'knife') {
            const d = room.maps.find(m => m.status === 'available');
            if (d) { d.status = 'decider'; d.side = 'Knife'; room.playedMaps.push(d.name); room.logs.push(`[DECIDER] ${d.name} (Knife for Side)`); }
            room.finished = true;
            checking = false;
        }
    }
};

async function notifyWebhook(roomId, eventType, data) {
    try {
        const room = rooms[roomId];
        if (!room) return;
        const adminWebhook = await settings.getAdminWebhook();
        if (adminWebhook) {
            await discordWebhook.sendDiscordNotification(adminWebhook, room, eventType, data);
        }
        if (room.tempWebhookUrl && isValidWebhook(room.tempWebhookUrl)) {
            await discordWebhook.sendDiscordNotification(room.tempWebhookUrl, room, eventType, data);
        }
    } catch (error) {
        console.error('[WEBHOOK] Error sending notification:', error);
    }
}

io.on('connection', (socket) => {
    socket.currentRoom = null;
    connectedUsers++;
    socket.emit('user_count', connectedUsers);
    broadcastUserCount();

    socket.on('create_match', ({ teamA, teamB, teamALogo, teamBLogo, format, customMapNames, customSequence, useTimer, useCoinFlip, timerDuration, tempWebhookUrl }) => {
        if (isRateLimited(socket.id)) return socket.emit('error', 'Rate limit exceeded');
        
        // 🛡️ SECURITY FIX: SSRF Protection
        const safeWebhook = isValidWebhook(tempWebhookUrl) ? tempWebhookUrl : null;

        const roomId = generateKey(6);
        let finalSequence = SEQUENCES[format] || SEQUENCES.bo1; // Prevent undefined format crash
        if (format === 'custom' && Array.isArray(customSequence) && customSequence.length > 0) finalSequence = customSequence;

        let finalMaps = [];
        if (format.startsWith('wingman')) {
            finalMaps = WINGMAN_MAPS.map(m => ({ name: m.name, customImage: null, status: 'available', pickedBy: null, side: null }));
        } else if (format === 'custom' && Array.isArray(customMapNames) && customMapNames.length > 0) {
            finalMaps = customMapNames.map(name => {
                const existing = activeMaps.find(m => m.name === name);
                return { name: String(name), customImage: existing ? (existing.customImage || null) : null, status: 'available', pickedBy: null, side: null };
            });
        } else {
            finalMaps = activeMaps.map(m => ({ name: m.name, customImage: m.customImage || null, status: 'available', pickedBy: null, side: null }));
        }

        const parsedTimerDuration = useTimer ? (parseInt(timerDuration) || 60) : 60;
        rooms[roomId] = {
            id: roomId, date: new Date().toISOString(),
            keys: { admin: generateKey(8), A: generateKey(8), B: generateKey(8) },
            teamA: typeof teamA === 'string' ? teamA : "Team A", 
            teamB: typeof teamB === 'string' ? teamB : "Team B",
            teamALogo: typeof teamALogo === 'string' ? teamALogo : null, 
            teamBLogo: typeof teamBLogo === 'string' ? teamBLogo : null,
            format, sequence: finalSequence, step: 0, maps: finalMaps,
            logs: [], finished: false, lastPickedMap: null, playedMaps: [],
            useTimer: !!useTimer, ready: { A: false, B: false }, timerEndsAt: null, timerHandle: null,
            timerDuration: parsedTimerDuration,
            useCoinFlip: !!useCoinFlip,
            coinFlip: useCoinFlip ? { status: 'waiting_call', winner: null, result: null } : null,
            tempWebhookUrl: safeWebhook
        };
        saveHistory(roomId);
        notifyWebhook(roomId, 'match_created', {});
        socket.emit('match_created', { roomId, keys: rooms[roomId].keys });
    });

    socket.on('join_room', ({ roomId, key }) => {
        if (isRateLimited(socket.id)) return;
        if (!rooms[roomId]) return socket.emit('error', 'Match not found');

        if (socket.currentRoom && socket.currentRoom !== roomId) {
            roomUserCounts[socket.currentRoom] = Math.max(0, (roomUserCounts[socket.currentRoom] || 0) - 1);
            socket.leave(socket.currentRoom);
            broadcastRoomUserCount(socket.currentRoom);
        }

        socket.join(roomId);
        socket.currentRoom = roomId;
        roomUserCounts[roomId] = (roomUserCounts[roomId] || 0) + 1;
        broadcastRoomUserCount(roomId);

        const room = rooms[roomId];
        let role = 'viewer';
        if (authorize(room, key, null)) role = 'admin';
        else if (authorize(room, key, 'A')) role = 'A';
        else if (authorize(room, key, 'B')) role = 'B';
        
        socket.emit('role_assigned', role);
        const { keys, timerHandle, ...safe } = room;
        socket.emit('update_state', safe);
    });

    socket.on('team_ready', ({ roomId, key }) => {
        if (isRateLimited(socket.id)) return;
        const room = rooms[roomId];
        if (!room || room.finished || !room.useTimer) return;
        
        let role = null;
        if (authorize(room, key, 'A')) role = 'A';
        else if (authorize(room, key, 'B')) role = 'B';
        
        if (role && !room.ready[role]) {
            room.ready[role] = true;
            const teamName = role === 'A' ? room.teamA : room.teamB;
            room.logs.push(`[READY] ${teamName} is Ready`);
            notifyWebhook(roomId, 'ready', { team: teamName });

            const coinFlipDone = !room.useCoinFlip || (room.coinFlip && room.coinFlip.status === 'done');
            if (room.ready.A && room.ready.B && coinFlipDone) {
                room.logs.push(`[SYSTEM] Both teams ready! Timer started.`);
                startTurnTimer(roomId);
            }
            saveHistory(roomId);
            const { keys, timerHandle, ...safe } = room;
            io.to(roomId).emit('update_state', safe);
        }
    });

    socket.on('coin_call', ({ roomId, call, key }) => {
        if (isRateLimited(socket.id)) return;
        const room = rooms[roomId];
        if (!room || !room.useCoinFlip || !room.coinFlip || room.coinFlip.status !== 'waiting_call') return;
        if (!authorize(room, key, 'A')) return;

        const result = crypto.randomInt(0, 2) === 0 ? 'heads' : 'tails';
        const winner = (call === result) ? 'A' : 'B';

        room.coinFlip.result = result;
        room.coinFlip.winner = winner;
        room.coinFlip.status = 'deciding';

        const winnerName = winner === 'A' ? room.teamA : room.teamB;
        room.logs.push(`[COIN] ${room.teamA} called ${call.toUpperCase()}. Result: ${result.toUpperCase()}. Winner: ${winnerName}`);
        notifyWebhook(roomId, 'coin_flip', { result, winner: winnerName });

        saveHistory(roomId);
        const { keys, timerHandle, ...safe } = room;
        io.to(roomId).emit('update_state', safe);
    });

    socket.on('coin_decision', ({ roomId, decision, key }) => {
        if (isRateLimited(socket.id)) return;
        const room = rooms[roomId];
        if (!room || !room.useCoinFlip || room.coinFlip.status !== 'deciding') return;
        const winner = room.coinFlip.winner;
        if (!authorize(room, key, winner)) return;

        let swapSequence = false;
        if (winner === 'A' && decision === 'second') swapSequence = true;
        if (winner === 'B' && decision === 'first') swapSequence = true;

        if (swapSequence) {
            room.sequence = room.sequence.map(step => {
                if (step.t === 'A') return { ...step, t: 'B' };
                if (step.t === 'B') return { ...step, t: 'A' };
                return step;
            });
        }

        const winnerName = winner === 'A' ? room.teamA : room.teamB;
        if (decision === 'first') {
            room.logs.push(`[COIN] ${winnerName} chose to start first.`);
        } else {
            room.logs.push(`[COIN] ${winnerName} chose to let opponent start.`);
        }

        room.coinFlip.status = 'done';
        if (room.useTimer && room.ready.A && room.ready.B) { startTurnTimer(roomId); }
        saveHistory(roomId);
        const { keys, timerHandle, ...safe } = room;
        io.to(roomId).emit('update_state', safe);
    });

    socket.on('action', ({ roomId, data, key }) => {
        if (isRateLimited(socket.id)) return;
        const room = rooms[roomId];
        if (!room || room.finished) return;
        if (room.useTimer && (!room.ready.A || !room.ready.B)) return;
        if (room.useCoinFlip && (!room.coinFlip || room.coinFlip.status !== 'done')) return;

        const currentStep = room.sequence[room.step];
        if (!currentStep) return; 
        
        // 🛡️ SECURITY FIX: Centralized authorization
        if (currentStep.t !== 'System' && !authorize(room, key, currentStep.t)) return;

        if (currentStep.a === 'ban' || currentStep.a === 'pick') {
            // 🛡️ SANITIZATION: Cast data to string to prevent object injection attacks
            const safeData = String(data);
            const idx = room.maps.findIndex(m => m.name === safeData);
            
            if (idx === -1 || room.maps[idx].status !== 'available') return;
            const map = room.maps[idx];
            const teamName = currentStep.t === 'A' ? room.teamA : room.teamB;

            if (currentStep.a === 'ban') {
                map.status = 'banned';
                room.logs.push(`[BAN] ${teamName} banned ${map.name}`);
                notifyWebhook(roomId, 'ban', { mapName: map.name, team: teamName });
            } else {
                map.status = 'picked';
                map.pickedBy = currentStep.t;
                room.lastPickedMap = map.name;
                room.playedMaps.push(map.name);
                room.logs.push(`[PICK] ${teamName} picked ${map.name}`);
                notifyWebhook(roomId, 'pick', { mapName: map.name, team: teamName, side: null });
            }
            room.step++;
        } else if (currentStep.a === 'side') {
            let target = room.lastPickedMap;
            if (!target) { const d = room.maps.find(m => m.status === 'available'); if (d) target = d.name; }
            const idx = room.maps.findIndex(m => m.name === target);
            if (idx !== -1) {
                const safeData = String(data);
                room.maps[idx].side = safeData;
                const teamName = currentStep.t === 'A' ? room.teamA : room.teamB;
                const lastLogIndex = room.logs.length - 1;
                const lastLog = room.logs[lastLogIndex];
                if (lastLog && lastLog.includes(`picked ${target}`)) {
                    room.logs[lastLogIndex] = `${lastLog} (${teamName} chose ${safeData} side for ${target})`;
                } else {
                    room.logs.push(`[SIDE] ${teamName} chose ${safeData} side for ${target}`);
                }
                notifyWebhook(roomId, 'side', { mapName: target, team: teamName, side: safeData });
                room.lastPickedMap = null;
                room.step++;
            }
        }

        if (room.useTimer) {
            if (room.timerHandle) { clearTimeout(room.timerHandle); room.timerEndsAt = null; }
            if (!room.finished && room.ready.A && room.ready.B) { startTurnTimer(roomId); }
        }
        checkMatchEnd(room);

        if (room.finished) {
            notifyWebhook(roomId, 'match_complete', {});
        }

        saveHistory(roomId);
        const { keys, timerHandle, ...safe } = room;
        io.to(roomId).emit('update_state', safe);
    });

    socket.on('admin_reset_match', ({ roomId, secret }) => {
        if (isRateLimited(socket.id)) return;
        const room = rooms[roomId];
        if (!room || !safeCompare(secret, MASTER_SECRET)) return;
        if (room.timerHandle) clearTimeout(room.timerHandle);
        room.step = 0;
        room.logs = [`[ADMIN] Match reset by Admin`];
        room.finished = false;
        room.lastPickedMap = null;
        room.playedMaps = [];
        room.timerEndsAt = null;
        room.ready = { A: false, B: false };
        if (!room.timerDuration) room.timerDuration = 60;
        room.coinFlip = room.useCoinFlip ? { status: 'waiting_call', winner: null, result: null } : null;
        room.maps.forEach(m => { m.status = 'available'; m.pickedBy = null; m.side = null; });
        saveHistory(roomId);
        const { keys, timerHandle, ...safe } = room;
        io.to(roomId).emit('update_state', safe);
    });

    socket.on('admin_undo_step', ({ roomId, secret }) => {
        if (isRateLimited(socket.id)) return;
        const room = rooms[roomId];
        // 🛡️ SECURITY FIX: Used constant-time string comparison for the secret
        if (!room || !safeCompare(secret, MASTER_SECRET) || room.step === 0) return;
        
        if (room.timerHandle) clearTimeout(room.timerHandle);
        room.timerEndsAt = null;
        room.step--;
        if (room.finished) room.finished = false;
        const lastLog = room.logs[room.logs.length - 1];
        if (!lastLog) return; 
        
        if (lastLog.includes('(') && lastLog.includes('side for')) {
            const splitIdx = lastLog.indexOf('(');
            const mapNameMatch = lastLog.match(/side for (.*?)\)/);
            if (mapNameMatch) {
                const mapName = mapNameMatch[1];
                const map = room.maps.find(m => m.name === mapName);
                if (map) map.side = null;
                room.logs[room.logs.length - 1] = lastLog.substring(0, splitIdx).trim();
                room.lastPickedMap = mapName;
            }
        } else {
            room.logs.pop();
            let mapName = null;
            for (const m of room.maps) { if (lastLog.includes(m.name)) { mapName = m.name; break; } }
            if (mapName) {
                const map = room.maps.find(m => m.name === mapName);
                if (map) {
                    if (lastLog.includes('[BAN]')) map.status = 'available';
                    if (lastLog.includes('[PICK]')) { map.status = 'available'; map.pickedBy = null; room.playedMaps = room.playedMaps.filter(p => p !== mapName); }
                    if (lastLog.includes('[DECIDER]')) { map.status = 'available'; map.side = null; room.playedMaps = room.playedMaps.filter(p => p !== mapName); }
                    if (lastLog.includes('[SIDE]') || lastLog.includes('[AUTO-SIDE]')) { map.side = null; room.lastPickedMap = mapName; }
                }
            }
        }
        if (room.useTimer && room.ready.A && room.ready.B && !room.finished) { startTurnTimer(roomId); }
        saveHistory(roomId);
        const { keys, timerHandle, ...safe } = room;
        io.to(roomId).emit('update_state', safe);
    });

    socket.on('disconnect', () => {
        if (socket.currentRoom) {
            roomUserCounts[socket.currentRoom] = Math.max(0, (roomUserCounts[socket.currentRoom] || 0) - 1);
            broadcastRoomUserCount(socket.currentRoom);
        }
        connectedUsers = Math.max(0, connectedUsers - 1);
        broadcastUserCount();
        rateLimits.delete(socket.id); // Clear memory on disconnect
    });
});

server.listen(3001, () => { console.log('Server running on port 3001'); });
