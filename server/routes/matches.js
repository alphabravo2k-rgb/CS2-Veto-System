const express = require('express');
const MatchService = require('../domain/matches/MatchService');
const { requireAuth, requireOrgAdmin } = require('../middleware/auth');
const router = express.Router();

/**
 * ⚡ APPLICATION LAYER — MATCH COORDINATION
 * =============================================================================
 * Responsibility: Secure endpoints for generating and managing veto sessions.
 * =============================================================================
 */

// POST /api/matches — create a new veto match (org admin only)
router.post('/', requireAuth, async (req, res) => {
    try {
        const { orgId, tournamentId, teamA, teamB, teamALogo, teamBLogo, format, settings } = req.body;
        const result = await MatchService.createMatch({ 
            orgId, tournamentId, teamA, teamB, teamALogo, teamBLogo, format, 
            settings: settings || {} 
        });
        res.status(201).json(result);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET /api/matches/:id — retrieve a match state
router.get('/:id', async (req, res) => {
    try {
        const match = await MatchService.getMatch(req.params.id);
        if (!match) return res.status(404).json({ error: 'Match not found' });
        res.json(match);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch match status' });
    }
});

module.exports = router;
