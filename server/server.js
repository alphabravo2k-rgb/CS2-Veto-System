/**
 * ⚡ SERVER ENTRY POINT — SUPABASE NATIVE (FINAL REFINEMENT)
 * =============================================================================
 * Responsibility: Secure system initialization and route mounting.
 * =============================================================================
 */

'use strict';

const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const path       = require('path');
const supabase   = require('./infra/supabase');

require('dotenv').config();

// ── Infrastructure ────────────────────────────────────────────────────────────
const { initWebSocket } = require('./infra/websocket');
const settings        = require('./settings');

// ── Routes (Application Layer) ────────────────────────────────────────────────
const authRoutes    = require('./routes/auth');
const orgRoutes     = require('./routes/orgs');
const playerRoutes  = require('./routes/players');
const adminRoutes   = require('./routes/admin');
const matchRoutes   = require('./routes/matches');
const paymentRoutes = require('./routes/payments');

// ── Optional auth middleware (for identifying logged-in users on public routes)
const { optionalAuth } = require('./middleware/auth');

// ── App setup ─────────────────────────────────────────────────────────────────
const app = express();

const IS_PROD = process.env.NODE_ENV === 'production';
const allowedOrigins = IS_PROD
    ? (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [])
    : '*';

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '5mb' }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) =>
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ── Root Diagnostic Dashboard ────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Veto.GG | Backend System Core</title>
            <style>
                body { background: #050a14; color: #00d4ff; font-family: monospace; padding: 2rem; }
                .panel { border: 1px solid rgba(0, 212, 255, 0.2); padding: 2rem; border-radius: 8px; background: rgba(0, 212, 255, 0.02); }
                h1 { margin-top: 0; color: #fff; }
                a { color: #00ff88; text-decoration: none; }
                a:hover { text-decoration: underline; }
            </style>
        </head>
        <body>
            <div class="panel">
                <h1>VETO.GG CORE INFRASTRUCTURE</h1>
                <p>Status: <strong>ONLINE</strong> (Supabase-Powered REST & WebSocket Engine)</p>
                <p>Environment: ${IS_PROD ? 'Production' : 'Development'}</p>
                <p>Allowed Origins: ${IS_PROD ? process.env.CORS_ORIGIN || 'None configured' : 'All (*)'}</p>
                <hr style="border-color: rgba(0, 212, 255, 0.2); margin: 2rem 0;">
                <p><a href="/api/health">Check API Health Node &rarr;</a></p>
            </div>
        </body>
        </html>
    `);
});

// ── Route modules ─────────────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/orgs',    orgRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/admin',   optionalAuth, adminRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/payments', paymentRoutes);

// Legacy routes (maps, history) — Refactored for Supabase
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
        const page  = parseInt(req.query.page)  || 1;
        const limit = parseInt(req.query.limit) || 10;
        const from  = (page - 1) * limit;
        const to    = from + limit - 1;
        const tId   = req.query.tournamentId;

        let query = supabase
            .from('veto_sessions')
            .select('*', { count: 'exact' })
            .eq('finished', true)
            .order('finished_at', { ascending: false })
            .range(from, to);

        if (tId) {
            query = query.eq('tournament_id', tId);
        }

        const { data: matches, count: total, error } = await query;
        if (error) throw error;

        res.json({ 
            matches, 
            total, 
            page, 
            totalPages: Math.ceil(total / limit) 
        });
    } catch (err) {
        console.error('[HISTORY] Fetch error:', err.message);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// ── Server startup ────────────────────────────────────────────────────────────
const server = http.createServer(app);

async function start() {
    try {
        // 1. Initialize settings (Just handles logging/verification in the new version)
        await settings.initSettingsTable();
        console.log('[SERVER] Settings verified');

        // 2. Initialize WebSocket (Restores active rooms from Supabase)
        initWebSocket(server, allowedOrigins);
        console.log('[SERVER] WebSocket engine initialized');

        const PORT = process.env.PORT || 3001;
        server.listen(PORT, () => {
            console.log(`[SERVER] Success. Veto System Core operational on port ${PORT}`);
        });

    } catch (err) {
        console.error('[SERVER] Critical startup error:', err.message);
        process.exit(1);
    }
}

start();

module.exports = server;
