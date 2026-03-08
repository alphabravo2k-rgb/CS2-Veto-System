/**
 * ⚡ APPLICATION LAYER — ORGANIZATION ROUTES
 * =============================================================================
 */

'use strict';

const express = require('express');
const OrgService = require('../domain/organizations/OrgService');
const TournamentService = require('../domain/tournaments/TournamentService');
const { requireAuth, requireOrgAdmin } = require('../middleware/auth');
const { log } = require('../infra/auditLog');

const router = express.Router();

// POST /api/orgs — create org (any authenticated user)
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
    } catch {
        res.status(500).json({ error: 'Failed to fetch organizations' });
    }
});

// GET /api/orgs/:orgId — public profile + branding
router.get('/:orgId', async (req, res) => {
    try {
        const org = await OrgService.getOrgWithBranding(req.params.orgId);
        if (!org) return res.status(404).json({ error: 'Organization not found' });
        res.json(org);
    } catch {
        res.status(500).json({ error: 'Failed to fetch organization' });
    }
});

// PATCH /api/orgs/:orgId/branding — update branding (org admin only)
router.patch('/:orgId/branding', requireAuth, requireOrgAdmin, async (req, res) => {
    try {
        const { displayName, primaryColor, secondaryColor, logoUrl, bannerUrl } = req.body;
        const org = await OrgService.updateBranding(req.params.orgId, { displayName, primaryColor, secondaryColor, logoUrl, bannerUrl });
        await log({ actor_id: req.user.id, action: 'org.updateBranding', target_id: req.params.orgId });
        res.json(org);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET /api/orgs/:orgId/members
router.get('/:orgId/members', requireAuth, requireOrgAdmin, async (req, res) => {
    try {
        const members = await OrgService.getMembers(req.params.orgId);
        res.json(members);
    } catch {
        res.status(500).json({ error: 'Failed to fetch members' });
    }
});

// POST /api/orgs/:orgId/members — invite member
router.post('/:orgId/members', requireAuth, requireOrgAdmin, async (req, res) => {
    try {
        const { email, role } = req.body;
        const result = await OrgService.addMember(req.params.orgId, { inviteEmail: email, role, actorId: req.user.id });
        await log({ actor_id: req.user.id, action: 'org.addMember', target_id: req.params.orgId, meta: { email } });
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
        const tournament = await TournamentService.createTournament({ orgId: req.params.orgId, name, defaultFormat, gameModule });
        await log({ actor_id: req.user.id, action: 'tournament.create', target_id: tournament.id });
        res.status(201).json(tournament);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET /api/orgs/:orgId/tournaments
router.get('/:orgId/tournaments', async (req, res) => {
    try {
        const tournaments = await TournamentService.getTournamentsByOrg(req.params.orgId);
        res.json(tournaments);
    } catch {
        res.status(500).json({ error: 'Failed to fetch tournaments' });
    }
});

// GET /api/orgs/:orgId/tournaments/:tId
router.get('/:orgId/tournaments/:tId', async (req, res) => {
    try {
        const tournament = await TournamentService.getTournament(req.params.tId);
        if (!tournament || tournament.org_id !== req.params.orgId) {
            return res.status(404).json({ error: 'Tournament not found' });
        }
        res.json(tournament);
    } catch {
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
router.get('/:orgId/tournaments/:tId/maps', async (req, res) => {
    try {
        const maps = await TournamentService.getMapPool(req.params.tId);
        res.json(maps);
    } catch {
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
