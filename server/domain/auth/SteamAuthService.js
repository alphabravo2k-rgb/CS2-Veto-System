/**
 * ⚡ DOMAIN LAYER — STEAM OPENID AUTHENTICATION
 * =============================================================================
 * Responsibility: Secure identity verification via Steam OpenID 2.0.
 * =============================================================================
 */

const crypto = require('crypto');
const axios = require('axios');
const supabase = require('../../infra/supabase');

const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';

class SteamAuthService {
    /**
     * Redirects user to Steam for authentication
     */
    static getRedirectUrl(returnUrl) {
        const params = new URLSearchParams({
            'openid.ns': 'http://specs.openid.net/auth/2.0',
            'openid.mode': 'checkid_setup',
            'openid.return_to': returnUrl,
            'openid.realm': new URL(returnUrl).origin,
            'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
            'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
        });
        return `${STEAM_OPENID_URL}?${params.toString()}`;
    }

    /**
     * Verifies the Steam OpenID response
     */
    static async verify(query, returnUrl) {
        const params = new URLSearchParams(query);
        params.set('openid.mode', 'check_authentication');

        const { data } = await axios.post(STEAM_OPENID_URL, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (!data.includes('is_valid:true')) {
            throw new Error('Steam authentication failed or invalid');
        }

        const claimedId = query['openid.claimed_id'];
        const steamId64 = claimedId.split('/').pop();
        return steamId64;
    }

    /**
     * Syncs Steam profile to user account
     */
    static async syncProfile(userId, steamId64) {
        const apiKey = process.env.STEAM_API_KEY;
        let profileData = { steamId: steamId64 };

        if (apiKey) {
            try {
                const { data } = await axios.get(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId64}`);
                const player = data.response.players[0];
                if (player) {
                    profileData = {
                        steamId: steamId64,
                        personaname: player.personaname,
                        avatar: player.avatarfull,
                        loccountrycode: player.loccountrycode
                    };
                }
            } catch (err) {
                console.error('[Steam Sync] API fetch failed:', err.message);
            }
        }

        // Upsert into player_accounts
        const { error } = await supabase
            .from('player_accounts')
            .upsert({
                user_id: userId,
                platform: 'steam',
                platform_id: steamId64,
                platform_username: profileData.personaname || null,
                meta: profileData
            }, { onConflict: 'user_id, platform' });

        if (error) throw new Error(`Profile sync failed: ${error.message}`);

        // Optionally update the main user profile avatar if not set
        await supabase.from('users').update({
            avatar_url: profileData.avatar
        }).eq('id', userId).is('avatar_url', null);

        return profileData;
    }
}

module.exports = SteamAuthService;
