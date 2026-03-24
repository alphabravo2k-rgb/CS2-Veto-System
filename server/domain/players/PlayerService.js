const supabase = require('../../infra/supabase');

/**
 * ⚡ DOMAIN LAYER — PLAYER SERVICE
 * =============================================================================
 * Responsibility: Handles player profiles, gaming identity (Steam/Discord), 
 * and username cooldown logic using Supabase.
 * =============================================================================
 */

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const USERNAME_RE   = /^[a-zA-Z0-9_-]{3,30}$/;

class PlayerService {
    /**
     * Fetch a public profile by UUID or username.
     */
    async getPublicProfile(identifier) {
        const query = identifier.includes('-') // Simple check for UUID
            ? supabase.from('users').select('id, username, display_name, country, server_region, avatar_url, bio, created_at').eq('id', identifier)
            : supabase.from('users').select('id, username, display_name, country, server_region, avatar_url, bio, created_at').eq('username', identifier);

        const { data: user, error } = await query.eq('suspended', false).single();
        if (error) return null;

        // Fetch linked accounts
        const { data: accounts } = await supabase
            .from('player_accounts')
            .select('platform, platform_username')
            .eq('user_id', user.id);

        return { ...user, linkedAccounts: accounts || [] };
    }

    /**
     * Fetch private profile details for the owner.
     */
    async getPrivateProfile(userId) {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) return null;

        const { data: accounts } = await supabase
            .from('player_accounts')
            .select('platform, platform_id, platform_username')
            .eq('user_id', userId);

        // Compute username change availability
        let usernameLockedUntil = null;
        if (user.username_changed_at) {
            const lockedUntil = new Date(user.username_changed_at).getTime() + SIX_MONTHS_MS;
            if (lockedUntil > Date.now()) {
                usernameLockedUntil = new Date(lockedUntil).toISOString();
            }
        }

        return { ...user, linkedAccounts: accounts || [], usernameLockedUntil };
    }

    /**
     * Update a player's profile with validation and coercion.
     */
    async updateProfile(userId, updates) {
        const { username, displayName, country, serverRegion, avatarUrl, bio } = updates;
        const current = await this.getPrivateProfile(userId);
        if (!current) throw new Error('User not found');

        let finalUpdates = {};

        if (username && username !== current.username) {
            // Cooldown check
            if (current.usernameLockedUntil) {
                throw new Error(`Username cannot be changed until ${current.usernameLockedUntil}`);
            }

            if (!USERNAME_RE.test(username)) {
                throw new Error('Invalid username format');
            }

            // Uniqueness check
            const { data: conflict } = await supabase
                .from('users')
                .select('id')
                .eq('username', username)
                .neq('id', userId)
                .maybeSingle();

            if (conflict) throw new Error('Username already taken');

            finalUpdates.username = username.trim();
            finalUpdates.username_changed_at = new Date().toISOString();
        }

        if (displayName !== undefined) finalUpdates.display_name = displayName.trim().slice(0, 80);
        if (country !== undefined) finalUpdates.country = country || null;
        if (serverRegion !== undefined) finalUpdates.server_region = serverRegion || null;
        if (avatarUrl !== undefined) finalUpdates.avatar_url = avatarUrl || null;
        if (bio !== undefined) finalUpdates.bio = bio.trim().slice(0, 500) || null;

        const { data, error } = await supabase
            .from('users')
            .update(finalUpdates)
            .eq('id', userId)
            .select()
            .single();

        if (error) throw new Error(`[PlayerService] Update failed: ${error.message}`);
        return this.getPrivateProfile(userId);
    }

    /**
     * Link an external gaming account.
     */
    async linkAccount(userId, { platform, platformId, platformUsername }) {
        const validPlatforms = new Set(['steam', 'riot', 'epic', 'faceit']);
        if (!validPlatforms.has(platform)) throw new Error('Invalid platform');
        if (!platformId) throw new Error('Platform ID required');

        const { error } = await supabase
            .from('player_accounts')
            .upsert({ 
                user_id: userId, 
                platform, 
                platform_id: String(platformId).trim().slice(0, 100), 
                platform_username: platformUsername?.trim().slice(0, 50) || null 
            }, { onConflict: 'user_id, platform' });

        if (error) throw new Error(`[PlayerService] Link failed: ${error.message}`);
        return { success: true };
    }
}

module.exports = new PlayerService();
