/**
 * ⚡ APPLICATION LAYER — AUTH ROUTES
 * =============================================================================
 * Handles user registration, login, token refresh, and logout.
 * Pure orchestration — all business logic lives in AuthService.
 * =============================================================================
 */

'use strict';

const express = require('express');
const AuthService = require('../domain/auth/AuthService');
const { requireAuth } = require('../middleware/auth');
const { log } = require('../infra/auditLog');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { email, password, username, displayName, country, serverRegion, dob, ageConsent } = req.body;
        const result = await AuthService.register({ email, password, username, displayName, country, serverRegion, dob, ageConsent });
        await log({ actor_id: result.user.id, action: 'auth.register', target_id: result.user.id });
        res.status(201).json(result);
    } catch (err) {
        res.status(err.statusCode || 500).json({
            error: err.message,
            ...(err.validation ? { validation: err.validation } : {})
        });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await AuthService.login({ email, password });
        await log({ actor_id: result.user.id, action: 'auth.login' });
        res.json(result);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        const result = await AuthService.refreshToken(refreshToken);
        res.json(result);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
    try {
        const { refreshToken } = req.body;
        await AuthService.logout(refreshToken);
        await log({ actor_id: req.user.id, action: 'auth.logout' });
        res.json({ success: true });
    } catch {
        res.json({ success: true }); // Logout should never fail visibly
    }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, username, display_name, country, server_region, avatar_url, bio, role, created_at')
            .eq('id', req.user.id)
            .single();

        if (error || !user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

module.exports = router;
