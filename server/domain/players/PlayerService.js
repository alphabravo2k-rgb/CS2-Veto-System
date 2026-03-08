/**
 * ⚡ DOMAIN LAYER — PLAYER SERVICE
 * =============================================================================
 * PROBLEM (Missing System): The original system had no player identity
 * concept at all. Gaming identities, Steam IDs, and server preferences
 * would be completely lost between sessions.
 *
 * FIX: Player profile service with username cooldown enforcement and
 * external account linking.
 * =============================================================================
 */

'use strict';

const db = require('../../infra/database');

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const USERNAME_RE   = /^[a-zA-Z0-9_-]{3,30}$/;

async function getPublicProfile(userId) {
    const user = await db.get(
        `SELECT id, username, display_name, country, server_region, avatar_url, bio, created_at
         FROM users WHERE id = ? AND suspended = 0`,
        [userId]
    );
    if (!user) return null;

    const accounts = await db.all(
        'SELECT platform, platform_username FROM player_accounts WHERE user_id = ?',
        [userId]
    );

    return { ...user, linkedAccounts: accounts };
}

async function getPrivateProfile(userId) {
    const user = await db.get(
        `SELECT id, email, username, display_name, country, server_region, avatar_url, bio,
                dob, age_verified, username_changed_at, role, created_at
         FROM users WHERE id = ?`,
        [userId]
    );
    if (!user) return null;

    const accounts = await db.all(
        'SELECT platform, platform_id, platform_username FROM player_accounts WHERE user_id = ?',
        [userId]
    );

    // Compute username change availability
    let usernameLockedUntil = null;
    if (user.username_changed_at) {
        const lockedUntil = new Date(user.username_changed_at).getTime() + SIX_MONTHS_MS;
        if (lockedUntil > Date.now()) {
            usernameLockedUntil = new Date(lockedUntil).toISOString();
        }
    }

    return { ...user, linkedAccounts: accounts, usernameLockedUntil };
}

async function updateProfile(userId, { username, displayName, country, serverRegion, avatarUrl, bio }) {
    const user = await db.get('SELECT username, username_changed_at FROM users WHERE id = ?', [userId]);
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

    let finalUsername = user.username;

    if (username && username !== user.username) {
        // Enforce 6-month username change cooldown
        if (user.username_changed_at) {
            const lockedUntil = new Date(user.username_changed_at).getTime() + SIX_MONTHS_MS;
            if (Date.now() < lockedUntil) {
                const available = new Date(lockedUntil).toISOString();
                throw Object.assign(
                    new Error(`Username cannot be changed until ${available}`),
                    { statusCode: 429, lockedUntil: available }
                );
            }
        }

        if (!USERNAME_RE.test(username)) {
            throw Object.assign(new Error('Invalid username format'), { statusCode: 400 });
        }

        const conflict = await db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?', [username, userId]);
        if (conflict) throw Object.assign(new Error('Username already taken'), { statusCode: 409 });

        finalUsername = username.trim();
    }

    await db.run(
        `UPDATE users SET
           username = ?,
           display_name = ?,
           country = ?,
           server_region = ?,
           avatar_url = ?,
           bio = ?,
           username_changed_at = CASE WHEN username != ? THEN datetime('now') ELSE username_changed_at END
         WHERE id = ?`,
        [
            finalUsername,
            displayName?.trim().slice(0, 80) || user.display_name || finalUsername,
            country || null,
            serverRegion || null,
            avatarUrl || null,
            bio?.trim().slice(0, 500) || null,
            finalUsername,
            userId,
        ]
    );

    return getPrivateProfile(userId);
}

async function linkAccount(userId, { platform, platformId, platformUsername }) {
    const validPlatforms = new Set(['steam', 'riot', 'epic', 'faceit']);
    if (!validPlatforms.has(platform)) throw Object.assign(new Error('Invalid platform'), { statusCode: 400 });
    if (!platformId) throw Object.assign(new Error('Platform ID required'), { statusCode: 400 });

    await db.run(
        `INSERT INTO player_accounts (user_id, platform, platform_id, platform_username)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, platform) DO UPDATE SET
           platform_id = excluded.platform_id,
           platform_username = excluded.platform_username`,
        [userId, platform, String(platformId).trim().slice(0, 100), platformUsername?.trim().slice(0, 50) || null]
    );

    return { success: true };
}

module.exports = { getPublicProfile, getPrivateProfile, updateProfile, linkAccount };
