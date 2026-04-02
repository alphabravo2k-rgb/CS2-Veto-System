/**
 * ⚡ DOMAIN LAYER — ANALYTICS SERVICE
 * =============================================================================
 * Responsibility: Aggregating tournament and organization-wide metrics.
 * =============================================================================
 */

const supabase = require('../../infra/supabase');

class AnalyticsService {
    /**
     * Get aggregate map statistics for an organization or tournament
     */
    static async getMapStats({ orgId, tournamentId }) {
        let query = supabase
            .from('veto_sessions')
            .select('logs, maps, finished')
            .eq('finished', true);

        if (tournamentId) {
            query = query.eq('tournament_id', tournamentId);
        } else if (orgId) {
            query = query.eq('org_id', orgId);
        }

        const { data, error } = await query;
        if (error) throw new Error(`Analytics fetch failed: ${error.message}`);

        const stats = {}; // { mapName: { picked: 0, banned: 0, total: 0 } }

        data.forEach(session => {
            const logs = Array.isArray(session.logs) ? session.logs : [];
            
            logs.forEach(log => {
                if (!log.map) return;
                const map = log.map;
                if (!stats[map]) stats[map] = { picked: 0, banned: 0, total: 0 };

                if (log.action === 'pick') {
                    stats[map].picked++;
                } else if (log.action === 'ban') {
                    stats[map].banned++;
                }
                stats[map].total++;
            });
        });

        return stats;
    }

    /**
     * Get high-level performance metrics
     */
    static async getSummaryMetrics(orgId) {
        const { data: sessions, error } = await supabase
            .from('veto_sessions')
            .select('created_at, finished_at')
            .eq('org_id', orgId)
            .eq('finished', true);

        if (error) throw error;

        const totalMatches = sessions.length;
        let totalDuration = 0;

        sessions.forEach(s => {
            const start = new Date(s.created_at);
            const end = new Date(s.finished_at);
            totalDuration += (end - start);
        });

        const avgDurationMs = totalMatches > 0 ? totalDuration / totalMatches : 0;

        return {
            totalMatches,
            avgDurationMinutes: Math.round(avgDurationMs / 60000)
        };
    }
}

module.exports = AnalyticsService;
