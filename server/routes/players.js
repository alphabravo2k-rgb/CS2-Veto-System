/**
 * ⚡ APPLICATION LAYER — PLAYER ROUTES
 */

'use strict';

const express = require('express');
const PlayerService = require('../domain/players/PlayerService');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/players/me — private profile
router.get('/me', requireAuth, async (req, res) => {
    try {
        const profile = await PlayerService.getPrivateProfile(req.user.id);
        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        res.json(profile);
    } catch {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// PATCH /api/players/me — update profile
router.patch('/me', requireAuth, async (req, res) => {
    try {
        const { username, displayName, country, serverRegion, avatarUrl, bio } = req.body;
        const updated = await PlayerService.updateProfile(req.user.id, { username, displayName, country, serverRegion, avatarUrl, bio });
        res.json(updated);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message, ...(err.lockedUntil ? { lockedUntil: err.lockedUntil } : {}) });
    }
});

// GET /api/players/:userId — public profile
router.get('/:userId', async (req, res) => {
    try {
        const profile = await PlayerService.getPublicProfile(req.params.userId);
        if (!profile) return res.status(404).json({ error: 'Player not found' });
        res.json(profile);
    } catch {
        res.status(500).json({ error: 'Failed to fetch player' });
    }
});

// POST /api/players/me/accounts — link external account (Steam, Riot, etc.)
router.post('/me/accounts', requireAuth, async (req, res) => {
    try {
        const { platform, platformId, platformUsername } = req.body;
        const result = await PlayerService.linkAccount(req.user.id, { platform, platformId, platformUsername });
        res.json(result);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

module.exports = router;
