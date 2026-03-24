const express = require('express');
const OrgService = require('../domain/organizations/OrgService');
const TournamentService = require('../domain/tournaments/TournamentService');
const TenantResolver = require('../domain/organizations/TenantResolver');
const { requireAuth, requireOrgAdmin } = require('../middleware/auth');
const { log } = require('../infra/auditLog');

const router = express.Router();

/**
 * Helper to resolve :orgId param (slug or UUID)
 */
async function resolveOrg(req, res, next) {
    let orgId = req.params.orgId;
    if (orgId && !orgId.includes('-')) {
        const resolved = await TenantResolver.resolveSlug(orgId);
        if (resolved) orgId = resolved.id;
    }
    req.orgId = orgId;
    next();
}

// POST /api/orgs — create org
router.post('/', requireAuth, async (req, res) => {
    try {
        const { name, slug, primaryColor, secondaryColor, logoUrl } = req.body;
        const org = await OrgService.createOrg({ userId: req.user.id, name, slug, primaryColor, secondaryColor, logoUrl });
        await log({ actor_id: req.user.id, action: 'org.create', target_id: org.id });
        res.status(201).json(org);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET /api/orgs/mine — user's organizations
router.get('/mine', requireAuth, async (req, res) => {
    try {
        const orgs = await OrgService.getUserOrgs(req.user.id);
        res.json(orgs);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch organizations' });
    }
});

// GET /api/orgs/:orgId — public profile + branding
router.get('/:orgId', resolveOrg, async (req, res) => {
    try {
        if (!req.orgId) return res.status(404).json({ error: 'Organization not found' });
        const org = await OrgService.getOrgWithBranding(req.orgId);
        if (!org) return res.status(404).json({ error: 'Organization not found' });
        res.json(org);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch organization' });
    }
});

// PATCH /api/orgs/:orgId/branding — update branding (org admin only)
router.patch('/:orgId/branding', requireAuth, requireOrgAdmin, async (req, res) => {
    try {
        // req.orgId is already resolved by requireOrgAdmin middleware
        const { displayName, primaryColor, secondaryColor, logoUrl, bannerUrl } = req.body;
        const org = await OrgService.updateBranding(req.orgId, { 
            display_name: displayName, 
            primary_color: primaryColor, 
            secondary_color: secondaryColor, 
            logo_url: logoUrl, 
            banner_url: bannerUrl 
        });
        await log({ actor_id: req.user.id, action: 'org.updateBranding', target_id: req.orgId });
        res.json(org);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET /api/orgs/:orgId/members
router.get('/:orgId/members', requireAuth, requireOrgAdmin, async (req, res) => {
    try {
        const members = await OrgService.getMembers(req.orgId);
        res.json(members);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch members' });
    }
});

// POST /api/orgs/:orgId/members — invite member
router.post('/:orgId/members', requireAuth, requireOrgAdmin, async (req, res) => {
    try {
        const { email, role } = req.body;
        const result = await OrgService.addMember(req.orgId, { inviteEmail: email, role });
        await log({ actor_id: req.user.id, action: 'org.addMember', target_id: req.orgId, meta: { email } });
        res.json(result);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// ── Tournament sub-routes ─────────────────────────────────────────────────────

// POST /api/orgs/:orgId/tournaments
router.post('/:orgId/tournaments', requireAuth, requireOrgAdmin, async (req, res) => {
    try {
        const { name, defaultFormat, gameModule } = req.body;
        const tournament = await TournamentService.createTournament({ orgId: req.orgId, name, defaultFormat, gameModule });
        await log({ actor_id: req.user.id, action: 'tournament.create', target_id: tournament.id });
        res.status(201).json(tournament);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET /api/orgs/:orgId/tournaments
router.get('/:orgId/tournaments', resolveOrg, async (req, res) => {
    try {
        if (!req.orgId) return res.status(404).json({ error: 'Organization not found' });
        const tournaments = await TournamentService.getTournamentsByOrg(req.orgId);
        res.json(tournaments);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch tournaments' });
    }
});

// GET /api/orgs/:orgId/tournaments/:tId
router.get('/:orgId/tournaments/:tId', resolveOrg, async (req, res) => {
    try {
        const tournament = await TournamentService.getTournament(req.params.tId);
        if (!tournament || tournament.org_id !== req.orgId) {
            return res.status(404).json({ error: 'Tournament not found' });
        }
        res.json(tournament);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch tournament' });
    }
});

// PATCH /api/orgs/:orgId/tournaments/:tId
router.patch('/:orgId/tournaments/:tId', requireAuth, requireOrgAdmin, async (req, res) => {
    try {
        const { name, defaultFormat, status } = req.body;
        const tournament = await TournamentService.updateTournament(req.params.tId, { name, defaultFormat, status });
        res.json(tournament);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET /api/orgs/:orgId/tournaments/:tId/maps
router.get('/:orgId/tournaments/:tId/maps', resolveOrg, async (req, res) => {
    try {
        const maps = await TournamentService.getMapPool(req.params.tId);
        res.json(maps);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch map pool' });
    }
});

// PUT /api/orgs/:orgId/tournaments/:tId/maps
router.put('/:orgId/tournaments/:tId/maps', requireAuth, requireOrgAdmin, async (req, res) => {
    try {
        const maps = await TournamentService.updateMapPool(req.params.tId, req.body.maps);
        await log({ actor_id: req.user.id, action: 'tournament.updateMaps', target_id: req.params.tId });
        res.json(maps);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

module.exports = router;
