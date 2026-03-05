/**
 * ⚡ COMP-OS — VETO ENGINE SERVER
 * =============================================================================
 * FILE          : server.js
 * RESPONSIBILITY: Multi-Tenant API Gateway & Real-time Orchestration
 * LAYER         : Backend (Node.js / Express / Socket.io)
 * RISK LEVEL    : SECURE (Auditor Hardened)
 * =============================================================================
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fsPromises = require('fs').promises; 
const path = require('path');
const crypto = require('crypto');

require('dotenv').config();

const discordWebhook = require('./discord-webhook');
const settings = require('./settings');

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

const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : []) 
    : "*";

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

const MAPS_FILE = path.join(__dirname, 'maps.json');
const HISTORY_FILE = path.join(__dirname, 'match_history.json'); 

const IS_PROD = process.env.NODE_ENV === 'production';
if (IS_PROD && !process.env.ADMIN_SECRET) {
    console.error('[SERVER] ❌ FATAL: ADMIN_SECRET must be set in production!');
    process.exit(1);
}
const MASTER_SECRET = process.env.ADMIN_SECRET || "default_secret";

let rooms = {};

const DEFAULT_MAPS = [
    { name: "Dust2" }, { name: "Inferno" }, { name: "Mirage" },
    { name: "Overpass" }, { name: "Nuke" }, { name: "Anubis" }, { name: "Ancient" }
];

const WINGMAN_MAPS = [
    { name: "Vertigo" }, { name: "Nuke" }, { name: "Inferno" },
    { name: "Overpass" }, { name: "Sanctum" }, { name: "Poseidon" }
];

let activeMaps = [...DEFAULT_MAPS];

function safeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
}

function authorize(room, key, requiredTeam = null) {
    if (!room || !key || typeof key !== 'string') return false;
    if (safeCompare(key, room.keys.admin)) return true;
    if (requiredTeam && safeCompare(key, room.keys[requiredTeam])) return true;
    return false;
}

// 🛡️ SECURITY FIX: Canonical URL Parsing to prevent Path Traversal
function isValidWebhook(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        const parsed = new URL(url);
        return (parsed.hostname === 'discord.com' || parsed.hostname === 'discordapp.com') &&
               parsed.protocol === 'https:' &&
               parsed.pathname.startsWith('/api/webhooks/');
    } catch { return false; }
}

// 🛡️ SECURITY FIX: Enforce strict Data URI validation for Base64 Images
function isSafeLogoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return url.startsWith('data:image/jpeg;base64,') ||
           url.startsWith('data:image/png;base64,') ||
           url.startsWith('data:image/webp;base64,') ||
           url.startsWith('data:image/gif;base64,');
}

// --- LOAD DATA (FULLY ASYNCHRONOUS) ---
async function loadData() {
    try {
        await db.initDatabase();
        await settings.initSettingsTable(db.getRawInstance ? db.getRawInstance() : null);

        const savedMatches = await db.loadAllMatches();
        savedMatches.forEach(match => {
            rooms[match.id] = match;
        });

        try {
            await fsPromises.access(HISTORY_FILE);
            if (savedMatches.length === 0) {
                const savedData = JSON.parse(await fsPromises.readFile(HISTORY_FILE, 'utf8'));
                for (const match of savedData) {
                    const matchData = {
                        ...match,
                        tournament_id: match.tournament_id || 'default',
                        finished: match.finished || false,
                        timerDuration: match.timerDuration || 60
                    };
                    await db.saveMatch(matchData);
                    rooms[match.id] = matchData;
                }
            }
        } catch (e) { /* Safe to ignore */ }

        try {
            await fsPromises.access(MAPS_FILE);
            activeMaps = JSON.parse(await fsPromises.readFile(MAPS_FILE, 'utf8'));
        } catch (e) {
            await fsPromises.writeFile(MAPS_FILE, JSON.stringify(activeMaps, null, 2));
        }

    } catch (e) {
        console.error('[SERVER] Startup data load error:', e);
    }
}

loadData().catch(error => {
    console.error('[SERVER] ❌ Failed to initialize on startup:', error.message);
});

async function saveHistory(roomId = null) {
    try {
        if (roomId && rooms[roomId]) {
            await db.saveMatch(rooms[roomId]);
        } else {
            for (const match of Object.values(rooms)) {
                await db.saveMatch(match);
            }
        }
    } catch (e) { console.error("[DB] Error saving history:", e); }
}

async function saveMaps() {
    try { await fsPromises.writeFile(MAPS_FILE, JSON.stringify(activeMaps, null, 2)); } 
    catch (e) { console.error("Error saving maps:", e); }
}

// ============================================================================
// MULTI-TENANT API ROUTES (REST)
// ============================================================================

app.get('/api/health', (req, res) => res.json({ status: 'ok', database: db ? 'connected' : 'error', timestamp: new Date().toISOString() }));

app.post('/api/orgs', async (req, res) => {
    if (!safeCompare(req.body.secret, MASTER_SECRET)) return res.status(403).json({ error: "Invalid Key" });
    try {
        const { id, name, logoUrl, discordSupportLink } = req.body;
        if (!id || !name) return res.status(400).json({ error: "id and name required" });
        await db.createOrganization(id, name, logoUrl, discordSupportLink);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orgs/:id', async (req, res) => {
    try {
        const org = await db.getOrganization(req.params.id);
        if (!org) return res.status(404).json({ error: "Not found" });
        res.json(org);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tournaments', async (req, res) => {
    if (!safeCompare(req.body.secret, MASTER_SECRET)) return res.status(403).json({ error: "Invalid Key" });
    try {
        const { id, org_id, name, defaultFormat } = req.body;
        if (!id || !org_id || !name) return res.status(400).json({ error: "id, org_id, and name required" });
        await db.createTournament(id, org_id, name, defaultFormat);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tournaments/org/:orgId', async (req, res) => {
    try {
        const tournaments = await db.getTournamentsByOrg(req.params.orgId);
        res.json(tournaments);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/history', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const tournamentId = req.query.tournamentId || null;
        const results = await db.getPaginatedMatches(page, limit, tournamentId);
        res.json(results);
    } catch (error) { res.status(500).json({ error: "Failed to fetch history" }); }
});

app.get('/api/maps', (req, res) => res.json(activeMaps));

app.post('/api/admin/history', async (req, res) => {
    if (!safeCompare(req.body.secret, MASTER_SECRET)) return res.status(403).json({ error: "Invalid Key" });
    const { tournamentId } = req.body;

    try {
        const activeMatches = Object.values(rooms)
            .filter(m => !tournamentId || m.tournament_id === tournamentId)
            .map(({ timerHandle, ...keep }) => keep);

        let dbMatches = await db.getAllMatches();
        if (tournamentId) {
            dbMatches = dbMatches.filter(m => m.tournament_id === tournamentId);
        }

        const matchMap = new Map();
        dbMatches.forEach(m => matchMap.set(m.id, m));
        activeMatches.forEach(m => matchMap.set(m.id, m));

        const allMatches = Array.from(matchMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json(allMatches);
    } catch (error) { res.status(500).json({ error: "Failed to fetch history" }); }
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
    } catch (error) { res.status(500).json({ error: "Failed to delete match" }); }
});

app.post('/api/admin/reset', async (req, res) => {
    if (!safeCompare(req.body.secret, MASTER_SECRET)) return res.status(403).json({ error: "Invalid Key" });
    Object.values(rooms).forEach(r => { if (r.timerHandle) clearTimeout(r.timerHandle); });
    rooms = {};
    
    try { await fsPromises.unlink(HISTORY_FILE); } catch (e) { }

    // 🛡️ SECURITY FIX: Properly clear the SQLite table
    if (typeof db.resetAllMatches === 'function') {
        await db.resetAllMatches();
    } else if (db.getRawInstance) {
        db.getRawInstance().run('DELETE FROM match_history');
    }
    
    res.json({ success: true });
});

app.post('/api/admin/maps/get', (req, res) => {
    if (!safeCompare(req.body.secret, MASTER_SECRET)) return res.status(403).json({ error: "Invalid Key" });
    res.json(activeMaps);
});

app.post('/api/admin/maps/update', async (req, res) => {
    if (!safeCompare(req.body.secret, MASTER_SECRET)) return res.status(403).json({ error: "Invalid Key" });
    if (!Array.isArray(req.body.maps)) return res.status(400).json({ error: "Invalid Data" });
    activeMaps = req.body.maps;
    await saveMaps();
    res.json({ success: true, maps: activeMaps });
});

app.post('/api/admin/webhook/get', async (req, res) => {
    if (!safeCompare(req.body.secret, MASTER_SECRET)) return res.status(403).json({ error: "Invalid Key" });
    try {
        const webhookUrl = await settings.getAdminWebhook();
        res.json({ webhookUrl: webhookUrl || '' });
    } catch (error) { res.status(500).json({ error: "Failed to get webhook" }); }
});

app.post('/api/admin/webhook/set', async (req, res) => {
    if (!safeCompare(req.body.secret, MASTER_SECRET)) return res.status(403).json({ error: "Invalid Key" });
    try {
        const { webhookUrl } = req.body;
        if (webhookUrl && !isValidWebhook(webhookUrl)) return res.status(400).json({ error: "Invalid Discord webhook URL" });
        await settings.setAdminWebhook(webhookUrl || '');
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Failed to set webhook" }); }
});

app.post('/api/admin/webhook/test', async (req, res) => {
    if (!safeCompare(req.body.secret, MASTER_SECRET)) return res.status(403).json({ error: "Invalid Key" });
    try {
        const { webhookUrl } = req.body;
        if (!webhookUrl || !isValidWebhook(webhookUrl)) return res.status(400).json({ error: "Valid Webhook URL required" });
        await discordWebhook.testWebhook(webhookUrl);
        res.json({ success: true, message: "Webhook test successful" });
    } catch (error) { res.status(500).json({ error: error.message || "Webhook test failed" }); }
});


// ============================================================================
// WEBSOCKET ORCHESTRATION
// ============================================================================

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: allowedOrigins } });

let connectedUsers = 0;
const roomUserCounts = {};

const rateLimits = new Map();

function getClientIp(socket) {
    return socket.handshake.headers['x-forwarded-for']?.split(',')[0].trim() || socket.handshake.address;
}

function isRateLimited(ip) {
    const now = Date.now();
    const limit = rateLimits.get(ip) || { count: 0, resetAt: now + 60000 };
    if (now > limit.resetAt) { limit.count = 0; limit.resetAt = now + 60000; }
    if (limit.count >= 40) return true; 
    limit.count++; rateLimits.set(ip, limit);
    return false;
}

function broadcastUserCount() { io.emit('user_count', connectedUsers); }
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

const VALID_SIDES = new Set(['CT', 'T']);
const VALID_CALLS = new Set(['heads', 'tails']);
const VALID_DECISIONS = new Set(['first', 'second']);

const generateKey = (len = 16) => crypto.randomBytes(len).toString('hex');

const startTurnTimer = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.finished) return;
    if (room.timerHandle) clearTimeout(room.timerHandle);
    const duration = (room.timerDuration || 60) * 1000; 
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
    const clientIp = getClientIp(socket);

    connectedUsers++;
    socket.emit('user_count', connectedUsers);
    broadcastUserCount();

    socket.on('create_match', ({ orgId, tournamentId, teamA, teamB, teamALogo, teamBLogo, format, customMapNames, customSequence, useTimer, useCoinFlip, timerDuration, tempWebhookUrl }) => {
        if (isRateLimited(clientIp)) return socket.emit('error', 'Rate limit exceeded');
        
        // 🛡️ SECURITY FIX: Enforce string limits and data sanitization
        const safeTeamA = typeof teamA === 'string' ? teamA.trim().slice(0, 50) : "Team A";
        const safeTeamB = typeof teamB === 'string' ? teamB.trim().slice(0, 50) : "Team B";
        
        const safeLogoA = isSafeLogoUrl(teamALogo) && teamALogo.length < 2000000 ? teamALogo : null;
        const safeLogoB = isSafeLogoUrl(teamBLogo) && teamBLogo.length < 2000000 ? teamBLogo : null;

        const safeWebhook = isValidWebhook(tempWebhookUrl) ? tempWebhookUrl : null;
        
        // 🛡️ ARCHITECTURE FIX: Secure context parameters
        const safeOrgId = typeof orgId === 'string' && orgId.trim() !== '' ? orgId.trim() : 'global';
        const safeTournamentId = typeof tournamentId === 'string' && tournamentId.trim() !== '' ? tournamentId.trim() : 'default';

        const roomId = generateKey(6);
        let finalSequence = SEQUENCES[format] || SEQUENCES.bo1; 
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
            id: roomId, 
            org_id: safeOrgId,
            tournament_id: safeTournamentId, 
            date: new Date().toISOString(),
            keys: { admin: generateKey(8), A: generateKey(8), B: generateKey(8) },
            teamA: safeTeamA, 
            teamB: safeTeamB,
            teamALogo: safeLogoA, 
            teamBLogo: safeLogoB,
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
        if (isRateLimited(clientIp)) return socket.emit('error', 'Rate limit exceeded');
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
        if (isRateLimited(clientIp)) return socket.emit('error', 'Rate limit exceeded');
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
        if (isRateLimited(clientIp)) return socket.emit('error', 'Rate limit exceeded');
        
        const safeCall = String(call).toLowerCase();
        if (!VALID_CALLS.has(safeCall)) return socket.emit('error', 'Invalid coin call payload');

        const room = rooms[roomId];
        if (!room || !room.useCoinFlip || !room.coinFlip || room.coinFlip.status !== 'waiting_call') return;
        if (!authorize(room, key, 'A')) return;

        const result = crypto.randomInt(0, 2) === 0 ? 'heads' : 'tails';
        const winner = (safeCall === result) ? 'A' : 'B';

        room.coinFlip.result = result;
        room.coinFlip.winner = winner;
        room.coinFlip.status = 'deciding';

        const winnerName = winner === 'A' ? room.teamA : room.teamB;
        room.logs.push(`[COIN] ${room.teamA} called ${safeCall.toUpperCase()}. Result: ${result.toUpperCase()}. Winner: ${winnerName}`);
        notifyWebhook(roomId, 'coin_flip', { result, winner: winnerName });

        saveHistory(roomId);
        const { keys, timerHandle, ...safe } = room;
        io.to(roomId).emit('update_state', safe);
    });

    socket.on('coin_decision', ({ roomId, decision, key }) => {
        if (isRateLimited(clientIp)) return socket.emit('error', 'Rate limit exceeded');

        const safeDecision = String(decision).toLowerCase();
        if (!VALID_DECISIONS.has(safeDecision)) return socket.emit('error', 'Invalid coin decision payload');

        const room = rooms[roomId];
        if (!room || !room.useCoinFlip || room.coinFlip.status !== 'deciding') return;
        const winner = room.coinFlip.winner;
        if (!authorize(room, key, winner)) return;

        let swapSequence = false;
        if (winner === 'A' && safeDecision === 'second') swapSequence = true;
        if (winner === 'B' && safeDecision === 'first') swapSequence = true;

        if (swapSequence) {
            room.sequence = room.sequence.map(step => {
                if (step.t === 'A') return { ...step, t: 'B' };
                if (step.t === 'B') return { ...step, t: 'A' };
                return step;
            });
        }

        const winnerName = winner === 'A' ? room.teamA : room.teamB;
        if (safeDecision === 'first') {
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
        if (isRateLimited(clientIp)) return socket.emit('error', 'Rate limit exceeded');
        const room = rooms[roomId];
        if (!room || room.finished) return;
        if (room.useTimer && (!room.ready.A || !room.ready.B)) return;
        if (room.useCoinFlip && (!room.coinFlip || room.coinFlip.status !== 'done')) return;

        const currentStep = room.sequence[room.step];
        if (!currentStep) return; 
        
        if (currentStep.t !== 'System' && !authorize(room, key, currentStep.t)) return;

        if (currentStep.a === 'ban' || currentStep.a === 'pick') {
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
                if (!VALID_SIDES.has(safeData)) return socket.emit('error', 'Invalid side payload');

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
        if (isRateLimited(clientIp)) return socket.emit('error', 'Rate limit exceeded');
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
        if (isRateLimited(clientIp)) return socket.emit('error', 'Rate limit exceeded');
        const room = rooms[roomId];
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
    });
});

// 🛡️ SCALABILITY FIX: Memory Leak Patched by only deleting expired map entries
setInterval(() => {
    const now = Date.now();
    const TTL = 24 * 60 * 60 * 1000; 
    let purgedCount = 0;

    for (const [roomId, room] of Object.entries(rooms)) {
        const roomAge = now - new Date(room.date).getTime();
        if (roomAge > TTL) {
            if (room.timerHandle) clearTimeout(room.timerHandle);
            delete rooms[roomId];
            purgedCount++;
        }
    }
    
    // Only delete expired rate limit entries, do NOT wipe the entire Map
    for (const [ip, limit] of rateLimits.entries()) {
        if (now > limit.resetAt) {
            rateLimits.delete(ip);
        }
    }

    if (purgedCount > 0) {
        console.log(`[SERVER-GC] Successfully purged ${purgedCount} stale rooms from memory.`);
    }
}, 60 * 60 * 1000);

// 🛡️ SCALABILITY FIX: Using Env variable for port mapping in production
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => { console.log(`[SERVER] Running on port ${PORT}`); });
