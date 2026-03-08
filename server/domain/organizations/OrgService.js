/**
 * ⚡ DOMAIN LAYER — ORGANIZATION SERVICE
 * =============================================================================
 * PROBLEM (Architecture Flaw): Organization creation required direct POST calls
 * to /api/orgs with the global ADMIN_SECRET. There was no self-service path for
 * a new organization to onboard. Branding was non-existent.
 *
 * FIX: Any authenticated user can create an org. Branding is stored in
 * org_branding table. Org admins can update their own branding.
 * =============================================================================
 */

'use strict';

const crypto = require('crypto');
const db = require('../../infra/database');

const SLUG_RE = /^[a-z0-9-]{3,40}$/;

function validateSlug(slug) {
    return SLUG_RE.test(slug);
}

async function createOrg({ userId, name, slug, primaryColor, secondaryColor, logoUrl }) {
    if (!name || name.trim().length < 2) throw Object.assign(new Error('Organization name must be at least 2 characters'), { statusCode: 400 });
    if (!slug || !validateSlug(slug)) throw Object.assign(new Error('Slug must be 3-40 lowercase letters, numbers, or hyphens'), { statusCode: 400 });

    const id = slug.trim();
    const displayName = name.trim().slice(0, 100);

    const existing = await db.get('SELECT id FROM organizations WHERE id = ?', [id]);
    if (existing) throw Object.assign(new Error('Organization slug already taken'), { statusCode: 409 });

    await db.run(
        `INSERT INTO organizations (id, name, created_at) VALUES (?, ?, datetime('now'))`,
        [id, displayName]
    );

    // Insert branding record
    await db.run(
        `INSERT INTO org_branding (org_id, display_name, primary_color, secondary_color, logo_url)
         VALUES (?, ?, ?, ?, ?)`,
        [id, displayName,
         primaryColor || '#00d4ff',
         secondaryColor || '#0a0f1e',
         logoUrl || null]
    );

    // Make the creator an org admin
    await db.run(
        `INSERT INTO org_members (org_id, user_id, role, joined_at) VALUES (?, ?, 'admin', datetime('now'))`,
        [id, userId]
    );

    return getOrgWithBranding(id);
}

async function getOrgWithBranding(orgId) {
    const org = await db.get('SELECT * FROM organizations WHERE id = ?', [orgId]);
    if (!org) return null;
    const branding = await db.get('SELECT * FROM org_branding WHERE org_id = ?', [orgId]);
    return { ...org, branding: branding || null };
}

async function updateBranding(orgId, { displayName, primaryColor, secondaryColor, logoUrl, bannerUrl }) {
    await db.run(
        `INSERT INTO org_branding (org_id, display_name, primary_color, secondary_color, logo_url, banner_url)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(org_id) DO UPDATE SET
           display_name = excluded.display_name,
           primary_color = excluded.primary_color,
           secondary_color = excluded.secondary_color,
           logo_url = excluded.logo_url,
           banner_url = excluded.banner_url`,
        [orgId,
         displayName?.trim().slice(0, 100) || null,
         primaryColor || '#00d4ff',
         secondaryColor || '#0a0f1e',
         logoUrl || null,
         bannerUrl || null]
    );
    return getOrgWithBranding(orgId);
}

async function addMember(orgId, { inviteEmail, role = 'member', actorId }) {
    const user = await db.get('SELECT id FROM users WHERE email = ?', [inviteEmail?.toLowerCase()]);
    if (!user) throw Object.assign(new Error('No user found with that email'), { statusCode: 404 });

    await db.run(
        `INSERT INTO org_members (org_id, user_id, role, joined_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(org_id, user_id) DO UPDATE SET role = excluded.role`,
        [orgId, user.id, role === 'admin' ? 'admin' : 'member']
    );
    return { success: true };
}

async function getMembers(orgId) {
    return db.all(
        `SELECT u.id, u.username, u.display_name, u.avatar_url, om.role, om.joined_at
         FROM org_members om
         JOIN users u ON u.id = om.user_id
         WHERE om.org_id = ?
         ORDER BY om.joined_at ASC`,
        [orgId]
    );
}

async function getUserOrgs(userId) {
    return db.all(
        `SELECT o.*, om.role, ob.primary_color, ob.logo_url
         FROM organizations o
         JOIN org_members om ON om.org_id = o.id
         LEFT JOIN org_branding ob ON ob.org_id = o.id
         WHERE om.user_id = ?
         ORDER BY o.name ASC`,
        [userId]
    );
}

module.exports = { createOrg, getOrgWithBranding, updateBranding, addMember, getMembers, getUserOrgs };
