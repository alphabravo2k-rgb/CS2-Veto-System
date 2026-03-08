/**
 * ⚡ APPLICATION LAYER — ADMIN ROUTES
 * =============================================================================
 * PROBLEM (Architecture Flaw): Admin logic was scattered across server.js
 * inline with main application logic. No separation of concerns.
 *
 * PROBLEM (Security Vulnerability): Rate limiter used an in-memory Map that
 * grew indefinitely — a memory leak that would exhaust RAM under sustained load.
 * The interval that cleaned it only deleted TTL-expired entries from the ROOM
 * store, not from the rate limit map.
 *
 * FIX: Admin routes extracted to their own module. Rate limiter cleanup fixed.
 * =============================================================================
 */

'use strict';

const express = require('express');
const crypto = require('crypto');
const db = require('../infra/database');
const { log } = require('../infra/auditLog');
const { requirePlatformAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require JWT platform admin OR fall back to MASTER_SECRET
// for backward compatibility during the migration period.
function adminAuth(req, res, next) {
    // JWT path (preferred)
    if (req.user?.role === 'platform_admin') return next();

    // Legacy MASTER_SECRET path
    const secret = req.body?.secret || req.headers['x-admin-secret'];
    const MASTER_SECRET = process.env.ADMIN_SECRET || 'default_secret';
    if (!secret || secret.length !== MASTER_SECRET.length) {
        return res.status(403).json({ error: 'Admin authentication required' });
    }
    try {
        const secretBuf = Buffer.from(secret);
        const masterBuf = Buffer.from(MASTER_SECRET);
        if (!crypto.timingSafeEqual(secretBuf, masterBuf)) {
            return res.status(403).json({ error: 'Invalid admin credentials' });
        }
    } catch {
        return res.status(403).json({ error: 'Invalid admin credentials' });
    }
    req.adminLegacy = true;
    next();
}

router.use(adminAuth);

// GET /api/admin/health
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/admin/users — list all users (platform admin)
router.get('/users', async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const offset = (page - 1) * limit;
        const search = req.query.search ? `%${req.query.search}%` : null;

        const sql = search
            ? 'SELECT id, email, username, display_name, role, suspended, created_at FROM users WHERE username LIKE ? OR email LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
            : 'SELECT id, email, username, display_name, role, suspended, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?';
        const params = search ? [search, search, limit, offset] : [limit, offset];

        const users = await db.all(sql, params);
        const { total } = await db.get(
            search ? 'SELECT COUNT(*) as total FROM users WHERE username LIKE ? OR email LIKE ?' : 'SELECT COUNT(*) as total FROM users',
            search ? [search, search] : []
        );
        res.json({ users, total, page, totalPages: Math.ceil(total / limit) });
    } catch {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// POST /api/admin/users/:userId/suspend
router.post('/users/:userId/suspend', async (req, res) => {
    try {
        const { suspended = true } = req.body;
        await db.run('UPDATE users SET suspended = ? WHERE id = ?', [suspended ? 1 : 0, req.params.userId]);
        const actorId = req.user?.id || 'legacy_admin';
        await log({ actor_id: actorId, action: suspended ? 'user.suspend' : 'user.unsuspend', target_id: req.params.userId });
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// GET /api/admin/orgs — list all orgs
router.get('/orgs', async (req, res) => {
    try {
        const orgs = await db.all(
            `SELECT o.id, o.name, ob.primary_color, ob.logo_url,
                    (SELECT COUNT(*) FROM org_members WHERE org_id = o.id) as member_count,
                    (SELECT COUNT(*) FROM tournaments WHERE org_id = o.id) as tournament_count
             FROM organizations o
             LEFT JOIN org_branding ob ON ob.org_id = o.id
             ORDER BY o.name ASC`
        );
        res.json(orgs);
    } catch {
        res.status(500).json({ error: 'Failed to fetch organizations' });
    }
});

// GET /api/admin/history — all matches (paginated)
router.get('/history', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const tournamentId = req.query.tournamentId || null;

        const where = tournamentId ? 'WHERE tournament_id = ?' : '';
        const params = tournamentId ? [tournamentId, limit, offset] : [limit, offset];

        const matches = await db.all(
            `SELECT id, tournament_id, teamA, teamB, format, finished, date
             FROM match_history ${where} ORDER BY date DESC LIMIT ? OFFSET ?`,
            params
        );
        res.json(matches);
    } catch {
        res.status(500).json({ error: 'Failed to fetch match history' });
    }
});

// DELETE /api/admin/matches/:matchId
router.delete('/matches/:matchId', async (req, res) => {
    try {
        await db.run('DELETE FROM match_history WHERE id = ?', [req.params.matchId]);
        const actorId = req.user?.id || 'legacy_admin';
        await log({ actor_id: actorId, action: 'match.delete', target_id: req.params.matchId });
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Failed to delete match' });
    }
});

// GET /api/admin/audit — audit log viewer
router.get('/audit', async (req, res) => {
    try {
        const logs = await db.all(
            'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200'
        );
        res.json(logs);
    } catch {
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

module.exports = router;
