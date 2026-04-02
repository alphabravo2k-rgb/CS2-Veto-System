/**
 * ⚡ DOMAIN LAYER — MATCH GENERATION SERVICE
 * =============================================================================
 * Responsibility: Bulk creation of veto sessions for tournaments.
 * Features: CSV/List processing, auto-key generation, and reporting.
 * =============================================================================
 */

const MatchService = require('../matches/MatchService');
const supabase = require('../../infra/supabase');

class MatchGenerationService {
    /**
     * Generates a batch of matches for a tournament.
     * @param {string} tournamentId 
     * @param {Array} matchPairs - [{ teamA, teamB }]
     * @param {Object} settings - { format, useTimer, timerDuration, useCoinFlip }
     */
    static async generateBatch(orgId, tournamentId, matchPairs, settings = {}) {
        if (!tournamentId || !Array.isArray(matchPairs)) {
            throw new Error('Tournament ID and match pairs list are required');
        }

        const reports = [];
        const errors = [];

        // Fetch tournament default settings if not provided
        const { data: tournament } = await supabase
            .from('tournaments')
            .select('format, game_module')
            .eq('id', tournamentId)
            .single();

        const format = settings.format || tournament?.format || 'bo1';

        for (const pair of matchPairs) {
            try {
                if (!pair.teamA || !pair.teamB) {
                    errors.push({ pair, error: 'Incomplete team names' });
                    continue;
                }

                const result = await MatchService.createMatch({
                    orgId,
                    tournamentId,
                    teamA: pair.teamA.trim(),
                    teamB: pair.teamB.trim(),
                    format,
                    settings: {
                        useTimer: settings.useTimer ?? true,
                        timerDuration: settings.timerDuration ?? 60,
                        useCoinFlip: settings.useCoinFlip ?? true
                    }
                });

                reports.push({
                    teamA: pair.teamA,
                    teamB: pair.teamB,
                    matchId: result.matchId,
                    keys: result.keys
                });
            } catch (err) {
                errors.push({ pair, error: err.message });
            }
        }

        return {
            total: matchPairs.length,
            successCount: reports.length,
            errorCount: errors.length,
            matches: reports,
            errors
        };
    }
}

module.exports = MatchGenerationService;
