/**
 * ⚡ DOMAIN LAYER — TOURNAMENT SERVICE
 * =============================================================================
 * PROBLEM (Architecture Flaw): The map pool was a single global array
 * (`activeMaps`) stored in maps.json and loaded into server memory. ALL
 * tournaments across ALL organizations shared this one pool.
 * Org A could not have a different map list than Org B.
 *
 * FIX: Per-tournament map pools stored in `tournament_map_pools` table.
 * Each tournament owns its own maps. The global maps.json is only a fallback
 * for tournaments that have not configured a custom pool.
 * =============================================================================
 */

'use strict';

const db = require('../../infra/database');

const DEFAULT_CS2_MAPS = ['Dust2', 'Inferno', 'Mirage', 'Overpass', 'Nuke', 'Anubis', 'Ancient'];

async function createTournament({ orgId, name, defaultFormat = 'bo3', gameModule = 'cs2' }) {
    if (!orgId) throw Object.assign(new Error('Organization ID required'), { statusCode: 400 });
    if (!name || name.trim().length < 2) throw Object.assign(new Error('Tournament name required'), { statusCode: 400 });

    const crypto = require('crypto');
    const id = `${orgId}-${crypto.randomBytes(4).toString('hex')}`;
    const safeName = name.trim().slice(0, 100);

    await db.run(
        `INSERT INTO tournaments (id, org_id, name, defaultFormat, game_module, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))`,
        [id, orgId, safeName, defaultFormat, gameModule]
    );

    // Seed with default CS2 map pool
    for (let i = 0; i < DEFAULT_CS2_MAPS.length; i++) {
        await db.run(
            `INSERT OR IGNORE INTO tournament_map_pools (tournament_id, map_name, sort_order) VALUES (?, ?, ?)`,
            [id, DEFAULT_CS2_MAPS[i], i]
        );
    }

    return getTournament(id);
}

async function getTournament(tournamentId) {
    const t = await db.get('SELECT * FROM tournaments WHERE id = ?', [tournamentId]);
    if (!t) return null;
    const maps = await getMapPool(tournamentId);
    return { ...t, mapPool: maps };
}

async function getTournamentsByOrg(orgId) {
    const tournaments = await db.all(
        'SELECT * FROM tournaments WHERE org_id = ? ORDER BY created_at DESC',
        [orgId]
    );
    return tournaments;
}

async function updateTournament(tournamentId, { name, defaultFormat, status }) {
    await db.run(
        `UPDATE tournaments SET
           name = COALESCE(?, name),
           defaultFormat = COALESCE(?, defaultFormat),
           status = COALESCE(?, status)
         WHERE id = ?`,
        [name?.trim().slice(0, 100) || null, defaultFormat || null, status || null, tournamentId]
    );
    return getTournament(tournamentId);
}

async function getMapPool(tournamentId) {
    const rows = await db.all(
        'SELECT map_name, map_image_url FROM tournament_map_pools WHERE tournament_id = ? ORDER BY sort_order ASC',
        [tournamentId]
    );
    if (rows.length === 0) {
        // Fall back to default pool — no custom maps configured
        return DEFAULT_CS2_MAPS.map((name, i) => ({ map_name: name, map_image_url: null }));
    }
    return rows;
}

async function updateMapPool(tournamentId, maps) {
    if (!Array.isArray(maps) || maps.length === 0) {
        throw Object.assign(new Error('Maps must be a non-empty array'), { statusCode: 400 });
    }
    // Clear existing and replace
    await db.run('DELETE FROM tournament_map_pools WHERE tournament_id = ?', [tournamentId]);
    for (let i = 0; i < maps.length; i++) {
        const m = maps[i];
        if (!m.name || typeof m.name !== 'string') continue;
        await db.run(
            `INSERT INTO tournament_map_pools (tournament_id, map_name, map_image_url, sort_order) VALUES (?, ?, ?, ?)`,
            [tournamentId, m.name.trim().slice(0, 50), m.imageUrl || null, i]
        );
    }
    return getMapPool(tournamentId);
}

module.exports = { createTournament, getTournament, getTournamentsByOrg, updateTournament, getMapPool, updateMapPool };
