/**
 * ⚡ DOMAIN LAYER — MATCH SERVICE
 * =============================================================================
 * Responsibility: Secure state transitions and persistence for veto sessions.
 * Features: Multi-tenant match creation and archival.
 * =============================================================================
 */

'use strict';

const crypto = require('crypto');
const supabase = require('../../infra/supabase');

/**
 * Creates a new match and its initial veto session state.
 */
async function createMatch({ orgId, tournamentId, teamA, teamB, teamALogo, teamBLogo, format, settings }) {
    if (!orgId || !teamA || !teamB) {
        const err = new Error('Organization and both team names are required');
        err.statusCode = 400;
        throw err;
    }

    const matchId = crypto.randomUUID();
    const adminKey = crypto.randomBytes(16).toString('hex');
    const teamAKey = crypto.randomBytes(16).toString('hex');
    const teamBKey = crypto.randomBytes(16).toString('hex');

    const { data: match, error } = await supabase
        .from('match_history')
        .insert({
            id: matchId,
            org_id: orgId,
            tournament_id: tournamentId || 'default',
            teamA,
            teamB,
            teamALogo,
            teamBLogo,
            format,
            use_timer: settings.useTimer || false,
            timer_duration: settings.timerDuration || 60,
            use_coin_flip: settings.useCoinFlip || false,
            admin_key: adminKey,
            team_a_key: teamAKey,
            team_b_key: teamBKey,
            finished: false,
            status: 'scheduled',
            date: new Date().toISOString()
        })
        .select()
        .single();

    if (error) throw new Error(`Match creation failed: ${error.message}`);
    
    return {
        matchId: match.id,
        keys: { admin: adminKey, A: teamAKey, B: teamBKey }
    };
}

/**
 * Retrieves a match by ID.
 */
async function getMatch(matchId) {
    const { data, error } = await supabase
        .from('match_history')
        .select('*')
        .eq('id', matchId)
        .maybeSingle();

    if (error) throw error;
    return data;
}

/**
 * Finalizes a match after veto completion.
 */
async function finalizeMatch(matchId, { winner, deciderMap, logs }) {
    const { error } = await supabase
        .from('match_history')
        .update({
            finished: true,
            status: 'completed',
            winner,
            decider_map: deciderMap,
            logs
        })
        .eq('id', matchId);

    if (error) throw new Error(`Match finalization failed: ${error.message}`);
    return true;
}

module.exports = {
    createMatch,
    getMatch,
    finalizeMatch
};
