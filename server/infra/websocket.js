/**
 * ⚡ INFRA LAYER — WEBSOCKET ORCHESTRATION
 * =============================================================================
 * PROBLEM (Architecture Flaw): All WebSocket logic (which is I/O) was mixed
 * into the same file as the veto state machine logic and the REST API routes.
 * This made the 900-line server.js an untestable monolith.
 *
 * PROBLEM (Fragile Logic — Undo): The original undo parsed log strings to
 * determine previous game state. See VetoEngine.js for the fix.
 *
 * PROBLEM (Performance — Memory Leak): The rateLimits Map grew without bound.
 * Keys were never deleted — only entries in the `rooms` object were purged.
 * Under sustained load (40+ events/IP/min) this fills RAM.
 *
 * FIX: WebSocket handlers extracted here. Game transitions delegate to
 * VetoEngine (pure FSM). An undo stack (array of full state snapshots) replaces
 * log-string parsing. The rate limiter now properly evicts expired entries.
 * =============================================================================
 */

'use strict';

const { Server } = require('socket.io');
const crypto = require('crypto');
const VetoEngine = require('../domain/veto-engine/VetoEngine');
const { SEQUENCES } = require('../domain/veto-engine/sequences');
const TournamentService = require('../domain/tournaments/TournamentService');
const db = require('./database');
const { log: auditLog } = require('./auditLog');
const discordWebhook = require('../discord-webhook');
const settings = require('../settings');

// In-memory room store — keyed by roomId. Still needed for O(1) socket lookups.
let rooms = {};

// FIX (Memory Leak): Rate limiter map with proper eviction
const rateLimits = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 40;

function isRateLimited(ip) {
    const now = Date.now();
    let entry = rateLimits.get(ip);
    if (!entry || now > entry.resetAt) {
        entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    }
    entry.count++;
    rateLimits.set(ip, entry);
    return entry.count > RATE_LIMIT_MAX;
}

// FIX: Periodically evict expired rate limit entries (was missing before)
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimits.entries()) {
        if (now > entry.resetAt) rateLimits.delete(ip);
    }
}, 5 * 60_000); // Every 5 minutes

function getClientIp(socket) {
    return socket.handshake.headers['x-forwarded-for']?.split(',')[0].trim()
        || socket.handshake.address;
}

const generateKey = (len = 16) => crypto.randomBytes(len).toString('hex');

function safeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    try {
        const aBuf = Buffer.from(a);
        const bBuf = Buffer.from(b);
        if (aBuf.length !== bBuf.length) return false;
        return crypto.timingSafeEqual(aBuf, bBuf);
    } catch { return false; }
}

function authorize(room, key) {
    if (!room || !key) return null;
    if (safeCompare(key, room.keys.admin)) return 'admin';
    if (safeCompare(key, room.keys.A)) return 'A';
    if (safeCompare(key, room.keys.B)) return 'B';
    return 'viewer';
}

function isSafeLogoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return (url.startsWith('data:image/jpeg;base64,') ||
            url.startsWith('data:image/png;base64,') ||
            url.startsWith('data:image/webp;base64,') ||
            url.startsWith('data:image/gif;base64,')) &&
           url.length < 2_000_000;
}

function isValidWebhook(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        const p = new URL(url);
        return (p.hostname === 'discord.com' || p.hostname === 'discordapp.com') &&
               p.protocol === 'https:' && p.pathname.startsWith('/api/webhooks/');
    } catch { return false; }
}

const safeRoomState = (room) => {
    const { keys, timerHandle, undoStack, ...safe } = room;
    return safe;
};

async function saveRoom(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    try {
        const { keys, timerHandle, undoStack, ...data } = room;
        await db.run(
            `INSERT INTO match_history (
               id, tournament_id, date, teamA, teamB, teamALogo, teamBLogo, format,
               sequence, step, maps, logs, finished, lastPickedMap, playedMaps,
               useTimer, ready, timerEndsAt, timerDuration, useCoinFlip, coinFlip, keys_data, tempWebhookUrl
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               tournament_id=excluded.tournament_id, teamA=excluded.teamA, teamB=excluded.teamB,
               format=excluded.format, sequence=excluded.sequence, step=excluded.step,
               maps=excluded.maps, logs=excluded.logs, finished=excluded.finished,
               lastPickedMap=excluded.lastPickedMap, playedMaps=excluded.playedMaps,
               useTimer=excluded.useTimer, ready=excluded.ready, timerEndsAt=excluded.timerEndsAt,
               timerDuration=excluded.timerDuration, useCoinFlip=excluded.useCoinFlip,
               coinFlip=excluded.coinFlip, keys_data=excluded.keys_data,
               tempWebhookUrl=excluded.tempWebhookUrl`,
            [
                data.id, data.tournament_id || 'default', data.date,
                (data.teamA||'').slice(0,50), (data.teamB||'').slice(0,50),
                data.teamALogo, data.teamBLogo, data.format,
                JSON.stringify(data.sequence), data.step,
                JSON.stringify(data.maps), JSON.stringify(data.logs),
                data.finished ? 1 : 0, data.lastPickedMap || null,
                JSON.stringify(data.playedMaps),
                data.useTimer ? 1 : 0, JSON.stringify(data.ready),
                data.timerEndsAt || null, data.timerDuration || 60,
                data.useCoinFlip ? 1 : 0,
                data.coinFlip ? JSON.stringify(data.coinFlip) : null,
                !data.finished ? JSON.stringify(keys) : null,
                data.tempWebhookUrl || null,
            ]
        );
    } catch (e) { console.error('[WS] Error saving room:', e.message); }
}

async function notifyWebhook(roomId, eventType, data) {
    try {
        const room = rooms[roomId];
        if (!room) return;
        const adminWebhook = await settings.getAdminWebhook();
        if (adminWebhook) await discordWebhook.sendDiscordNotification(adminWebhook, room, eventType, data);
        if (room.tempWebhookUrl) await discordWebhook.sendDiscordNotification(room.tempWebhookUrl, room, eventType, data);
    } catch { /* Webhooks must never crash the match */ }
}

const startTimer = (io, roomId) => {
    const room = rooms[roomId];
    if (!room || room.finished || !room.useTimer) return;
    if (room.timerHandle) clearTimeout(room.timerHandle);
    const duration = (room.timerDuration || 60) * 1000;
    room.timerEndsAt = Date.now() + duration;
    room.timerHandle = setTimeout(() => {
        if (!rooms[roomId]) return;
        const updated = VetoEngine.handleTimeout(
            rooms[roomId],
            rooms[roomId].teamA || 'Team A',
            rooms[roomId].teamB || 'Team B'
        );
        rooms[roomId] = { ...rooms[roomId], ...updated, timerHandle: null };
        if (!rooms[roomId].finished) {
            startTimer(io, roomId);
        } else {
            rooms[roomId].timerEndsAt = null;
            notifyWebhook(roomId, 'match_complete', {});
        }
        saveRoom(roomId);
        io.to(roomId).emit('update_state', safeRoomState(rooms[roomId]));
    }, duration);
};

let connectedUsers = 0;
const roomUserCounts = {};

// ── Main export ───────────────────────────────────────────────────────────────

function initWebSocket(server, allowedOrigins) {
    const io = new Server(server, { cors: { origin: allowedOrigins } });
    const MASTER_SECRET = process.env.ADMIN_SECRET || 'default_secret';

    // Restore active matches from DB on startup
    (async () => {
        try {
            const rows = await db.all(
                'SELECT * FROM match_history WHERE finished = 0 ORDER BY date DESC'
            );
            for (const row of rows) {
                try {
                    rooms[row.id] = {
                        id: row.id,
                        tournament_id: row.tournament_id || 'default',
                        date: row.date,
                        teamA: row.teamA, teamB: row.teamB,
                        teamALogo: row.teamALogo, teamBLogo: row.teamBLogo,
                        format: row.format,
                        sequence: JSON.parse(row.sequence || '[]'),
                        step: row.step, finished: row.finished === 1,
                        maps: JSON.parse(row.maps || '[]'),
                        logs: JSON.parse(row.logs || '[]'),
                        lastPickedMap: row.lastPickedMap,
                        playedMaps: JSON.parse(row.playedMaps || '[]'),
                        useTimer: row.useTimer === 1,
                        ready: JSON.parse(row.ready || '{"A":false,"B":false}'),
                        timerEndsAt: null, timerHandle: null,
                        timerDuration: row.timerDuration || 60,
                        useCoinFlip: row.useCoinFlip === 1,
                        coinFlip: row.coinFlip ? JSON.parse(row.coinFlip) : null,
                        keys: row.keys_data ? JSON.parse(row.keys_data) : {
                            admin: generateKey(8), A: generateKey(8), B: generateKey(8)
                        },
                        tempWebhookUrl: isValidWebhook(row.tempWebhookUrl) ? row.tempWebhookUrl : null,
                        undoStack: [],  // FIX: Initialize undo stack (not persisted across restarts by design)
                    };
                } catch (parseErr) {
                    console.error(`[WS] Failed to restore room ${row.id}:`, parseErr.message);
                }
            }
            console.log(`[WS] Restored ${rows.length} active room(s) from database`);
        } catch (e) {
            console.error('[WS] Failed to restore rooms:', e.message);
        }
    })();

    // Purge rooms older than 24h
    setInterval(() => {
        const TTL = 24 * 60 * 60 * 1000;
        const now = Date.now();
        for (const [roomId, room] of Object.entries(rooms)) {
            if (now - new Date(room.date).getTime() > TTL) {
                if (room.timerHandle) clearTimeout(room.timerHandle);
                delete rooms[roomId];
            }
        }
    }, 60 * 60 * 1000);

    io.on('connection', (socket) => {
        socket.currentRoom = null;
        const clientIp = getClientIp(socket);

        connectedUsers++;
        io.emit('user_count', connectedUsers);

        // ── CREATE MATCH ────────────────────────────────────────────────────
        socket.on('create_match', async (payload) => {
            if (isRateLimited(clientIp)) return socket.emit('error', 'Rate limit exceeded');

            const {
                orgId, tournamentId, teamA, teamB, teamALogo, teamBLogo,
                format, customMapNames, customSequence,
                useTimer, useCoinFlip, timerDuration, tempWebhookUrl
            } = payload || {};

            const safeTeamA   = typeof teamA === 'string' ? teamA.trim().slice(0, 50) : 'Team A';
            const safeTeamB   = typeof teamB === 'string' ? teamB.trim().slice(0, 50) : 'Team B';
            const safeLogoA   = isSafeLogoUrl(teamALogo) ? teamALogo : null;
            const safeLogoB   = isSafeLogoUrl(teamBLogo) ? teamBLogo : null;
            const safeWebhook = isValidWebhook(tempWebhookUrl) ? tempWebhookUrl : null;
            const safeOrgId   = typeof orgId === 'string' && orgId.trim() ? orgId.trim() : 'global';
            const safeTId     = typeof tournamentId === 'string' && tournamentId.trim() ? tournamentId.trim() : 'default';

            // Load map pool from per-tournament config (falls back to CS2 defaults)
            let mapPool;
            try {
                const dbMaps = await TournamentService.getMapPool(safeTId);
                mapPool = dbMaps.map(m => ({ name: m.map_name, customImage: m.map_image_url }));
            } catch {
                const { getDefaultMapPool } = require('../domain/veto-engine/sequences');
                mapPool = getDefaultMapPool(format).map(n => ({ name: n, customImage: null }));
            }

            // For custom format, override map pool with user selection
            if (format === 'custom' && Array.isArray(customMapNames) && customMapNames.length > 0) {
                mapPool = customMapNames.map(n => ({ name: String(n).trim().slice(0, 50), customImage: null }));
            }

            let vetoState;
            try {
                vetoState = VetoEngine.initializeVeto({
                    format,
                    mapPool,
                    customSequence: format === 'custom' ? customSequence : null,
                    useTimer: !!useTimer,
                    timerDuration: parseInt(timerDuration) || 60,
                    useCoinFlip: !!useCoinFlip,
                });
            } catch (err) {
                return socket.emit('error', err.message);
            }

            const roomId = generateKey(6);
            const keys   = { admin: generateKey(8), A: generateKey(8), B: generateKey(8) };

            rooms[roomId] = {
                id: roomId,
                org_id: safeOrgId,
                tournament_id: safeTId,
                date: new Date().toISOString(),
                keys,
                teamA: safeTeamA, teamB: safeTeamB,
                teamALogo: safeLogoA, teamBLogo: safeLogoB,
                tempWebhookUrl: safeWebhook,
                timerHandle: null,
                undoStack: [],  // FIX: Undo stack — stores full state snapshots
                ...vetoState,
            };

            await saveRoom(roomId);
            notifyWebhook(roomId, 'match_created', {});
            socket.emit('match_created', { roomId, keys });
        });

        // ── JOIN ROOM ───────────────────────────────────────────────────────
        socket.on('join_room', ({ roomId, key }) => {
            if (isRateLimited(clientIp)) return socket.emit('error', 'Rate limit exceeded');
            const room = rooms[roomId];
            if (!room) return socket.emit('error', 'Match not found');

            if (socket.currentRoom && socket.currentRoom !== roomId) {
                roomUserCounts[socket.currentRoom] = Math.max(0, (roomUserCounts[socket.currentRoom] || 0) - 1);
                socket.leave(socket.currentRoom);
                io.to(socket.currentRoom).emit('room_user_count', { roomId: socket.currentRoom, count: roomUserCounts[socket.currentRoom] || 0 });
            }

            socket.join(roomId);
            socket.currentRoom = roomId;
            roomUserCounts[roomId] = (roomUserCounts[roomId] || 0) + 1;
            io.to(roomId).emit('room_user_count', { roomId, count: roomUserCounts[roomId] });

            const role = authorize(room, key);
            socket.emit('role_assigned', role);
            socket.emit('update_state', safeRoomState(room));
        });

        // ── TEAM READY ──────────────────────────────────────────────────────
        socket.on('team_ready', ({ roomId, key }) => {
            if (isRateLimited(clientIp)) return socket.emit('error', 'Rate limit exceeded');
            const room = rooms[roomId];
            if (!room || room.finished) return;

            const role = authorize(room, key);
            if (role !== 'A' && role !== 'B') return;

            const teamName = role === 'A' ? room.teamA : room.teamB;
            const { state, bothReady } = VetoEngine.setTeamReady(room, role, teamName);

            rooms[roomId] = { ...room, ...state };

            if (bothReady) {
                const coinFlipDone = !rooms[roomId].useCoinFlip || rooms[roomId].coinFlip?.status === 'done';
                if (coinFlipDone) startTimer(io, roomId);
            }

            saveRoom(roomId);
            io.to(roomId).emit('update_state', safeRoomState(rooms[roomId]));
        });

        // ── COIN FLIP ───────────────────────────────────────────────────────
        socket.on('coin_call', ({ roomId, call, key }) => {
            if (isRateLimited(clientIp)) return socket.emit('error', 'Rate limit exceeded');
            const room = rooms[roomId];
            if (!room) return;

            const role = authorize(room, key);
            if (role !== 'A') return;

            const safeCall = String(call).toLowerCase();
            if (!new Set(['heads', 'tails']).has(safeCall)) return socket.emit('error', 'Invalid coin call');

            const { state, error } = VetoEngine.coinCall(room, safeCall, room.teamA, crypto.randomInt);
            if (error) return socket.emit('error', error);

            rooms[roomId] = { ...room, ...state };
            notifyWebhook(roomId, 'coin_flip', { result: state.coinFlip.result, winner: state.coinFlip.winner });
            saveRoom(roomId);
            io.to(roomId).emit('update_state', safeRoomState(rooms[roomId]));
        });

        socket.on('coin_decision', ({ roomId, decision, key }) => {
            if (isRateLimited(clientIp)) return socket.emit('error', 'Rate limit exceeded');
            const room = rooms[roomId];
            if (!room || !room.coinFlip || room.coinFlip.status !== 'deciding') return;

            const role = authorize(room, key);
            const winner = room.coinFlip.winner;
            if (role !== winner && role !== 'admin') return;

            const safeDecision = String(decision).toLowerCase();
            if (!new Set(['first', 'second']).has(safeDecision)) return socket.emit('error', 'Invalid decision');

            const winnerName = winner === 'A' ? room.teamA : room.teamB;
            const { state, error } = VetoEngine.coinDecision(room, winner, safeDecision, winnerName);
            if (error) return socket.emit('error', error);

            rooms[roomId] = { ...room, ...state };
            if (rooms[roomId].useTimer && rooms[roomId].ready.A && rooms[roomId].ready.B) {
                startTimer(io, roomId);
            }
            saveRoom(roomId);
            io.to(roomId).emit('update_state', safeRoomState(rooms[roomId]));
        });

        // ── VETO ACTION (ban / pick / side) ─────────────────────────────────
        socket.on('action', ({ roomId, data, key }) => {
            if (isRateLimited(clientIp)) return socket.emit('error', 'Rate limit exceeded');
            const room = rooms[roomId];
            if (!room || room.finished) return;

            const role = authorize(room, key);
            const currentStep = room.sequence[room.step];
            if (!currentStep) return;

            // Determine which team is acting — admin can act for anyone
            const actingAs = role === 'admin' ? currentStep.t : role;

            // FIX (Undo Stack): Save snapshot BEFORE mutation so undo can restore it
            const snapshot = VetoEngine._clone(room);
            // Strip non-JSON-safe fields from snapshot
            delete snapshot.timerHandle;

            let result;
            const teamName = actingAs === 'A' ? room.teamA : room.teamB;

            if (currentStep.a === 'ban') {
                result = VetoEngine.banMap(room, actingAs, String(data), teamName);
            } else if (currentStep.a === 'pick') {
                result = VetoEngine.pickMap(room, actingAs, String(data), teamName);
            } else if (currentStep.a === 'side') {
                result = VetoEngine.pickSide(room, actingAs, String(data), teamName);
            } else {
                return;
            }

            if (result.error) return socket.emit('error', result.error);

            // Commit state
            rooms[roomId] = {
                ...room,
                ...result.state,
                timerHandle: room.timerHandle,
                undoStack: [...(room.undoStack || []), snapshot].slice(-20), // Keep last 20 snapshots
            };

            // Timer management
            if (rooms[roomId].useTimer) {
                if (rooms[roomId].timerHandle) { clearTimeout(rooms[roomId].timerHandle); rooms[roomId].timerHandle = null; rooms[roomId].timerEndsAt = null; }
                if (!rooms[roomId].finished && rooms[roomId].ready.A && rooms[roomId].ready.B) {
                    startTimer(io, roomId);
                }
            }

            if (rooms[roomId].finished) notifyWebhook(roomId, 'match_complete', {});

            saveRoom(roomId);
            io.to(roomId).emit('update_state', safeRoomState(rooms[roomId]));
        });

        // ── ADMIN: UNDO ─────────────────────────────────────────────────────
        socket.on('admin_undo_step', ({ roomId, secret }) => {
            if (isRateLimited(clientIp)) return socket.emit('error', 'Rate limit exceeded');
            if (!safeCompare(secret, MASTER_SECRET)) return socket.emit('error', 'Unauthorized');
            const room = rooms[roomId];
            if (!room) return;

            // FIX: Use the undo stack instead of parsing log strings
            const { state, error } = VetoEngine.undoStep(room.undoStack || []);
            if (error) return socket.emit('error', error);

            const newUndoStack = (room.undoStack || []).slice(0, -1);
            if (room.timerHandle) { clearTimeout(room.timerHandle); }

            rooms[roomId] = {
                ...state,
                id: room.id, teamA: room.teamA, teamB: room.teamB,
                teamALogo: room.teamALogo, teamBLogo: room.teamBLogo,
                tournament_id: room.tournament_id, org_id: room.org_id,
                date: room.date, keys: room.keys,
                tempWebhookUrl: room.tempWebhookUrl,
                timerHandle: null, timerEndsAt: null,
                undoStack: newUndoStack,
            };

            if (rooms[roomId].useTimer && rooms[roomId].ready.A && rooms[roomId].ready.B && !rooms[roomId].finished) {
                startTimer(io, roomId);
            }

            auditLog({ actor_id: 'admin', action: 'veto.undo', target_id: roomId });
            saveRoom(roomId);
            io.to(roomId).emit('update_state', safeRoomState(rooms[roomId]));
        });

        // ── ADMIN: RESET MATCH ──────────────────────────────────────────────
        socket.on('admin_reset_match', ({ roomId, secret }) => {
            if (isRateLimited(clientIp)) return socket.emit('error', 'Rate limit exceeded');
            if (!safeCompare(secret, MASTER_SECRET)) return socket.emit('error', 'Unauthorized');
            const room = rooms[roomId];
            if (!room) return;

            if (room.timerHandle) clearTimeout(room.timerHandle);

            const freshState = VetoEngine.resetVeto(room);
            rooms[roomId] = {
                ...room, ...freshState,
                timerHandle: null, undoStack: [],
            };

            auditLog({ actor_id: 'admin', action: 'veto.reset', target_id: roomId });
            saveRoom(roomId);
            io.to(roomId).emit('update_state', safeRoomState(rooms[roomId]));
        });

        // ── DISCONNECT ──────────────────────────────────────────────────────
        socket.on('disconnect', () => {
            if (socket.currentRoom) {
                roomUserCounts[socket.currentRoom] = Math.max(0, (roomUserCounts[socket.currentRoom] || 0) - 1);
                io.to(socket.currentRoom).emit('room_user_count', { roomId: socket.currentRoom, count: roomUserCounts[socket.currentRoom] || 0 });
            }
            connectedUsers = Math.max(0, connectedUsers - 1);
            io.emit('user_count', connectedUsers);
        });
    });

    return io;
}

// Expose room store for admin REST routes that need match state
function getRooms() { return rooms; }
function deleteRoom(roomId) {
    const room = rooms[roomId];
    if (room?.timerHandle) clearTimeout(room.timerHandle);
    delete rooms[roomId];
}

module.exports = { initWebSocket, getRooms, deleteRoom };
