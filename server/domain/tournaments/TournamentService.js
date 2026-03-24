const supabase = require('../../infra/supabase');
const TrialGate = require('../organizations/TrialGate');

/**
 * ⚡ DOMAIN LAYER — TOURNAMENT SERVICE
 * =============================================================================
 * Responsibility: Tournament lifecycle and map pool management using Supabase.
 * =============================================================================
 */

const DEFAULT_CS2_MAPS = ['Dust2', 'Inferno', 'Mirage', 'Overpass', 'Nuke', 'Anubis', 'Ancient'];

class TournamentService {
    /**
     * Create a new tournament and seed its map pool.
     */
    async createTournament({ orgId, name, defaultFormat = 'bo3', gameModule = 'cs2' }) {
        if (!orgId) throw new Error('Organization ID required');
        
        // 🛡️ GOVERNANCE: Check trial limits before creating tournament
        await TrialGate.checkLimit(orgId);

        const crypto = require('crypto');
        const id = `${orgId}-${crypto.randomBytes(4).toString('hex')}`;
        
        const { data: tournament, error } = await supabase
            .from('tournaments')
            .insert({ 
                id, 
                org_id: orgId, 
                name: name.trim().slice(0, 100), 
                format: defaultFormat, 
                game_module: gameModule 
            })
            .select()
            .single();

        if (error) throw new Error(`Tournament creation failed: ${error.message}`);

        // Seed with default CS2 map pool
        const mapsToInsert = DEFAULT_CS2_MAPS.map((mapName, i) => ({
            tournament_id: id,
            map_name: mapName,
            sort_order: i
        }));

        const { error: mapErr } = await supabase
            .from('tournament_map_pools')
            .insert(mapsToInsert);

        if (mapErr) console.error('[TournamentService] Failed to seed map pool:', mapErr.message);

        return this.getTournament(id);
    }

    /**
     * Fetch a single tournament with its map pool.
     */
    async getTournament(tournamentId) {
        const { data: tournament, error } = await supabase
            .from('tournaments')
            .select('*, tournament_map_pools (*)')
            .eq('id', tournamentId)
            .single();

        if (error || !tournament) return null;
        
        // Rename key for consistency
        const { tournament_map_pools, ...t } = tournament;
        return { ...t, mapPool: tournament_map_pools };
    }

    /**
     * Get all tournaments for an organization.
     */
    async getTournamentsByOrg(orgId) {
        const { data, error } = await supabase
            .from('tournaments')
            .select('*')
            .eq('org_id', orgId)
            .order('created_at', { ascending: false });

        if (error) return [];
        return data;
    }

    /**
     * Update tournament basic info.
     */
    async updateTournament(tournamentId, { name, defaultFormat, status }) {
        const { data, error } = await supabase
            .from('tournaments')
            .update({ 
                name: name?.trim().slice(0, 100), 
                format: defaultFormat, 
                status 
            })
            .eq('id', tournamentId)
            .select()
            .single();

        if (error) throw new Error(`Update failed: ${error.message}`);
        return this.getTournament(tournamentId);
    }

    /**
     * Get only the map pool for a tournament.
     */
    async getMapPool(tournamentId) {
        const { data, error } = await supabase
            .from('tournament_map_pools')
            .select('map_name, map_image_url')
            .eq('tournament_id', tournamentId)
            .order('sort_order', { ascending: true });

        if (error || !data || data.length === 0) {
            return DEFAULT_CS2_MAPS.map(name => ({ map_name: name, map_image_url: null }));
        }
        return data;
    }

    /**
     * Overwrite the map pool for a tournament.
     */
    async updateMapPool(tournamentId, maps) {
        if (!Array.isArray(maps) || maps.length === 0) throw new Error('Maps required');

        // Delete existing
        await supabase.from('tournament_map_pools').delete().eq('tournament_id', tournamentId);

        // Insert new
        const rows = maps.map((m, i) => ({
            tournament_id: tournamentId,
            map_name: m.name.trim().slice(0, 50),
            map_image_url: m.imageUrl || null,
            sort_order: i
        }));

        const { error } = await supabase.from('tournament_map_pools').insert(rows);
        if (error) throw new Error(`Map pool update failed: ${error.message}`);

        return this.getMapPool(tournamentId);
    }
}

module.exports = new TournamentService();
