const express = require('express');
const crypto = require('crypto');
const supabase = require('../infra/supabase');
const { log } = require('../infra/auditLog');

const router = express.Router();

/**
 * Admin Authentication Bridge
 * Prefer JWT platform_admin role; fallback to MASTER_SECRET for emergency access.
 */
function adminAuth(req, res, next) {
    if (req.user?.role === 'platform_admin') return next();

    const secret = req.body?.secret || req.headers['x-admin-secret'];
    const MASTER_SECRET = process.env.ADMIN_SECRET;
    if (!MASTER_SECRET) {
        console.error('[SECURITY] ADMIN_SECRET env var not set');
    }
    
    if (!secret || secret.length !== MASTER_SECRET.length) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    
    try {
        if (!crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(MASTER_SECRET))) {
            return res.status(403).json({ error: 'Invalid secret' });
        }
    } catch {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
}

router.use(adminAuth);

// GET /api/admin/health
router.get('/health', (req, res) => res.json({ status: 'ok', engine: 'supabase' }));

// GET /api/admin/users
router.get('/users', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const { search } = req.query;

        let query = supabase
            .from('users')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range((page - 1) * limit, page * limit - 1);

        if (search) {
            query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%`);
        }

        const { data: users, count, error } = await query;
        if (error) throw error;

        res.json({ users, total: count, page, totalPages: Math.ceil((count || 0) / limit) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/users/:userId/suspend
router.post('/users/:userId/suspend', async (req, res) => {
    try {
        const { suspended = true } = req.body;
        const { error } = await supabase
            .from('users')
            .update({ suspended })
            .eq('id', req.params.userId);

        if (error) throw error;

        await log({ 
            actor_id: req.user?.id || 'master_key', 
            action: suspended ? 'user.suspend' : 'user.unsuspend', 
            target_id: req.params.userId 
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/orgs
router.get('/orgs', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('orgs')
            .select(`
                id, name, slug, 
                org_branding (primary_color, logo_url),
                org_members (count),
                tournaments (count)
            `)
            .order('name');

        if (error) throw error;
        
        // Flatten for API consumer
        const orgs = data.map(o => ({
            id: o.id,
            name: o.name,
            slug: o.slug,
            primary_color: o.org_branding?.[0]?.primary_color,
            logo_url: o.org_branding?.[0]?.logo_url,
            member_count: o.org_members?.[0]?.count || 0,
            tournament_count: o.tournaments?.[0]?.count || 0
        }));

        res.json(orgs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/history
router.get('/history', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const { tournamentId } = req.query;

        let query = supabase
            .from('veto_sessions')
            .select('*', { count: 'exact' })
            .order('date', { ascending: false })
            .range((page - 1) * limit, page * limit - 1);

        if (tournamentId) query = query.eq('tournament_id', tournamentId);

        const { data: matches, count, error } = await query;
        if (error) throw error;

        res.json({ matches, total: count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/admin/matches/:matchId
router.delete('/matches/:matchId', async (req, res) => {
    try {
        const { error } = await supabase.from('veto_sessions').delete().eq('id', req.params.matchId);
        if (error) throw error;

        await log({ 
            actor_id: req.user?.id || 'master_key', 
            action: 'match.delete', 
            target_id: req.params.matchId 
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/audit
router.get('/audit', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
