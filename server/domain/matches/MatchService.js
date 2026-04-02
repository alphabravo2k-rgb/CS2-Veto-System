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

    const { data: match, error } = await supabase
        .from('veto_sessions')
        .insert({
            id: matchId,
            org_id: orgId,
            tournament_id: tournamentId || 'default',
            team_a: teamA,
            team_b: teamB,
            team_a_logo: teamALogo,
            team_b_logo: teamBLogo,
            format,
            use_timer: settings.useTimer || false,
            timer_duration: settings.timerDuration || 60,
            use_coin_flip: settings.useCoinFlip || false,
            finished: false,
            status: 'scheduled'
        })
        .select()
        .single();

    if (error) throw new Error(`Match creation failed: ${error.message}`);
    
    return {
        matchId: match.id
    };
}

/**
 * Retrieves a match by ID.
 */
async function getMatch(matchId) {
    const { data, error } = await supabase
        .from('veto_sessions')
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
        .from('veto_sessions')
        .update({
            finished: true,
            status: 'completed',
            finished_at: new Date().toISOString(),
            logs // Logs include maps and events in JSONB
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
