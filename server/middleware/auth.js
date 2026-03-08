/**
 * ⚡ APPLICATION LAYER — AUTH MIDDLEWARE
 * =============================================================================
 * PROBLEM (Security Vulnerability): The original system had no per-request
 * authentication. Any request to protected admin routes only checked a shared
 * ADMIN_SECRET in the request body — susceptible to brute force, and with no
 * rate limiting on auth checks.
 *
 * FIX: JWT Bearer token middleware with role guards. The token is verified on
 * every protected request. Roles ('user', 'platform_admin') are encoded in the
 * token and verified server-side.
 * =============================================================================
 */

'use strict';

const { verifyAccessToken } = require('../domain/auth/AuthService');
const db = require('../infra/database');

/**
 * Attach the authenticated user to req.user.
 * Returns 401 if token is missing, invalid, or expired.
 */
async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.slice(7);
    try {
        const payload = verifyAccessToken(token);
        req.user = { id: payload.sub, username: payload.username, role: payload.role };
        next();
    } catch (err) {
        const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
        return res.status(401).json({ error: message });
    }
}

/**
 * Require the user to be a platform-level admin.
 * Must be used AFTER requireAuth.
 */
function requirePlatformAdmin(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.role !== 'platform_admin') {
        return res.status(403).json({ error: 'Platform admin access required' });
    }
    next();
}

/**
 * Require the user to be an admin of the specified organization.
 * Reads orgId from req.params.orgId by default.
 * Must be used AFTER requireAuth.
 */
function requireOrgAdmin(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    // Platform admins can always act
    if (req.user.role === 'platform_admin') return next();

    const orgId = req.params.orgId;
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

    db.get(
        'SELECT role FROM org_members WHERE org_id = ? AND user_id = ?',
        [orgId, req.user.id]
    ).then(row => {
        if (!row || row.role !== 'admin') {
            return res.status(403).json({ error: 'Organization admin access required' });
        }
        next();
    }).catch(() => res.status(500).json({ error: 'Authorization check failed' }));
}

/**
 * Optional auth — attaches req.user if a valid token is present,
 * but does NOT reject the request if absent.
 * Used for spectator views or public endpoints that show extra data to logged-in users.
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        return next();
    }
    try {
        const payload = verifyAccessToken(authHeader.slice(7));
        req.user = { id: payload.sub, username: payload.username, role: payload.role };
    } catch {
        req.user = null;
    }
    next();
}

module.exports = { requireAuth, requirePlatformAdmin, requireOrgAdmin, optionalAuth };
