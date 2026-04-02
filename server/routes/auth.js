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
const SteamAuthService = require('../domain/auth/SteamAuthService');
const { requireAuth } = require('../middleware/auth');
const { log } = require('../infra/auditLog');
const supabase = require('../infra/supabase');

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

// ── STEAM OPENID ROUTES ──

// GET /api/auth/steam
// Redirects to Steam for authentication
router.get('/steam', requireAuth, (req, res) => {
    try {
        const returnUrl = `${process.env.APP_URL || 'http://localhost:5000'}/api/auth/steam/return?userId=${req.user.id}`;
        const redirectUrl = SteamAuthService.getRedirectUrl(returnUrl);
        res.redirect(redirectUrl);
    } catch (err) {
        res.status(500).json({ error: 'Failed to initiate Steam login' });
    }
});

// GET /api/auth/steam/return
// Steam redirects back here after authentication
router.get('/steam/return', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) throw new Error('Missing user target for Steam link');

        const returnUrl = `${process.env.APP_URL || 'http://localhost:5000'}/api/auth/steam/return?userId=${userId}`;
        const steamId64 = await SteamAuthService.verify(req.query, returnUrl);
        
        await SteamAuthService.syncProfile(userId, steamId64);
        await log({ actor_id: userId, action: 'auth.steam_link', target_id: steamId64 });

        // Redirect back to frontend profile
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile?steam_linked=true`);
    } catch (err) {
        console.error('[Steam Return Error]', err.message);
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile?error=steam_link_failed`);
    }
});

module.exports = router;
