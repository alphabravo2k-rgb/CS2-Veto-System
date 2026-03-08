/**
 * ⚡ SERVER ENTRY POINT — REWRITTEN (ARCHITECTURAL UPGRADE)
 * =============================================================================
 * PROBLEM (Architecture Flaw): The original server.js was a 900-line monolith
 * combining REST routes, WebSocket handlers, domain logic, and infrastructure
 * concerns in a single file with no separation of concerns.
 *
 * FIX: This file is now ~80 lines. It only:
 *   1. Initializes infrastructure (DB, WebSocket)
 *   2. Mounts route modules
 *   3. Starts the HTTP server
 *
 * All logic lives in the appropriate layer.
 * =============================================================================
 */

'use strict';

const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const path       = require('path');

require('dotenv').config();

// ── Infrastructure ────────────────────────────────────────────────────────────
const dbAdapter       = require('./infra/database');
const { initWebSocket } = require('./infra/websocket');
const settings        = require('./settings');

// ── Routes (Application Layer) ────────────────────────────────────────────────
const authRoutes    = require('./routes/auth');
const orgRoutes     = require('./routes/orgs');
const playerRoutes  = require('./routes/players');
const adminRoutes   = require('./routes/admin');

// ── Optional auth middleware (for identifying logged-in users on public routes)
const { optionalAuth } = require('./middleware/auth');

// ── App setup ─────────────────────────────────────────────────────────────────
const app = express();

const IS_PROD = process.env.NODE_ENV === 'production';
const allowedOrigins = IS_PROD
    ? (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [])
    : '*';

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '5mb' })); // 5MB limit to accommodate base64 logos

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) =>
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ── Route modules ─────────────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/orgs',    orgRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/admin',   optionalAuth, adminRoutes);

// Legacy routes (maps, history) — kept for backward compatibility
// with existing deployed clients while they migrate to /api/orgs/:orgId/tournaments/:tId/maps
app.get('/api/maps', async (req, res) => {
    try {
        const TournamentService = require('./domain/tournaments/TournamentService');
        const tournamentId = req.query.tournamentId || 'default';
        const maps = await TournamentService.getMapPool(tournamentId);
        res.json(maps.map(m => ({ name: m.map_name, customImage: m.map_image_url })));
    } catch {
        res.json([]);
    }
});

app.get('/api/history', async (req, res) => {
    try {
        const db = require('./infra/database');
        const page  = parseInt(req.query.page)  || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const tId = req.query.tournamentId;

        const where = tId ? 'WHERE finished = 1 AND tournament_id = ?' : 'WHERE finished = 1';
        const params = tId ? [tId, limit, offset] : [limit, offset];

        const { total } = await db.get(`SELECT COUNT(*) as total FROM match_history ${where}`, tId ? [tId] : []);
        const matches   = await db.all(`SELECT * FROM match_history ${where} ORDER BY date DESC LIMIT ? OFFSET ?`, params);

        res.json({ matches, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// ── Server startup ────────────────────────────────────────────────────────────
const server = http.createServer(app);

async function start() {
    try {
        // 1. Initialize DB connection
        await dbAdapter.initDb();
        console.log('[SERVER] Database initialized');

        // 2. Initialize settings table (webhook storage)
        const rawDb = dbAdapter.getRawInstance();
        await settings.initSettingsTable(rawDb);

        // 3. Initialize WebSocket (also restores active rooms from DB)
        initWebSocket(server, allowedOrigins);
        console.log('[SERVER] WebSocket initialized');

        // 4. Start listening
        const PORT = parseInt(process.env.PORT) || 3001;
        server.listen(PORT, () => {
            console.log(`[SERVER] ✅ Listening on port ${PORT}`);
            if (!IS_PROD) console.log(`[SERVER] API: http://localhost:${PORT}/api`);
        });
    } catch (err) {
        console.error('[SERVER] ❌ Startup failed:', err.message);
        process.exit(1);
    }
}

start();
