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

const { verifyAccessToken } = require('../domain/auth/AuthService');
const supabase = require('../infra/supabase');
const TenantResolver = require('../domain/organizations/TenantResolver');

/**
 * Attach the authenticated user to req.user.
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
 * Require platform admin role.
 */
function requirePlatformAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'platform_admin') {
        return res.status(403).json({ error: 'Platform admin access required' });
    }
    next();
}

/**
 * Require org admin role. Resolves slugs to UUIDs.
 */
async function requireOrgAdmin(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.role === 'platform_admin') return next();

    let orgId = req.params.orgId;
    if (!orgId) return res.status(400).json({ error: 'Organization identifier required' });

    // 1. Resolve slug if needed
    if (!orgId.includes('-')) {
        const resolved = await TenantResolver.resolveSlug(orgId);
        if (resolved) orgId = resolved.id;
    }

    // 2. Check membership
    const { data: member, error } = await supabase
        .from('org_members')
        .select('role')
        .eq('org_id', orgId)
        .eq('user_id', req.user.id)
        .single();

    if (error || !member || member.role !== 'admin') {
        return res.status(403).json({ error: 'Organization admin access required' });
    }

    // Attach resolved orgId for downstream use
    req.orgId = orgId;
    next();
}

/**
 * Optional authentication.
 */
async function optionalAuth(req, res, next) {
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
