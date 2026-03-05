/**
 * ⚡ COMP-OS — DATABASE ACCESS LAYER
 * =============================================================================
 * FILE          : db.js
 * RESPONSIBILITY: Multi-Tenant SQLite Persistence 
 * LAYER         : Backend Persistence
 * RISK LEVEL    : SECURED (Relational)
 * =============================================================================
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { isValidDiscordWebhook } = require('./discord-webhook'); 

const DB_FILE = path.join(__dirname, 'match_history.db');

let db = null;

function safeJSONParse(data, fallback) {
    if (!data) return fallback;
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error('[DB] ⚠️ JSON Parse Error on row data. Returning safe fallback.');
        return fallback;
    }
}

function rowToMatch(row, includeKeys = false) {
    const match = {
        id: row.id,
        tournament_id: row.tournament_id || 'default', // 🛡️ ARCHITECTURE FIX: Fallback to prevent crashes on legacy data
        date: row.date,
        teamA: row.teamA,
        teamB: row.teamB,
        teamALogo: row.teamALogo,
        teamBLogo: row.teamBLogo,
        format: row.format,
        sequence: safeJSONParse(row.sequence, []),
        step: row.step,
        maps: safeJSONParse(row.maps, []),
        logs: safeJSONParse(row.logs, []),
        finished: row.finished === 1,
        lastPickedMap: row.lastPickedMap,
        playedMaps: safeJSONParse(row.playedMaps, []),
        useTimer: row.useTimer === 1,
        ready: safeJSONParse(row.ready, { A: false, B: false }),
        timerEndsAt: row.timerEndsAt,
        timerDuration: row.timerDuration || 60,
        useCoinFlip: row.useCoinFlip === 1,
        coinFlip: safeJSONParse(row.coinFlip, null),
        tempWebhookUrl: row.tempWebhookUrl
    };

    if (includeKeys && row.keys_data) {
        match.keys = safeJSONParse(row.keys_data, null);
    }
    return match;
}

function initDatabase() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(DB_FILE, (err) => {
            if (err) {
                console.error('[DB] Error opening database:', err);
                return reject(err);
            }
            console.log('[DB] Connected to SQLite database');

            db.serialize(() => {
                db.all('PRAGMA integrity_check', [], (err, rows) => {
                    if (err || !rows || rows[0]?.integrity_check !== 'ok') {
                        console.error('[DB] ❌ CRITICAL: Integrity check FAILED:', rows);
                    } else {
                        console.log('[DB] Database integrity verified.');
                    }
                });
                
                db.run('PRAGMA journal_mode = WAL', (err) => {
                    if (err) console.error('[DB] ⚠️ Failed to enable WAL mode:', err);
                });
                
                db.run('PRAGMA synchronous = NORMAL');
                
                // 🛡️ ARCHITECTURE FIX: Strictly enforce relational constraints
                db.run('PRAGMA foreign_keys = ON', (err) => {
                    if (err) console.error('[DB] Failed setting foreign keys', err);
                    else resolve();
                });
            });
        });
    });
}

// ============================================================================
// MULTI-TENANT ORG & TOURNAMENT QUERIES
// ============================================================================

function createOrganization(id, name, logoUrl = null, discordSupportLink = null) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Database not initialized'));
        db.run(
            'INSERT INTO organizations (id, name, logoUrl, discordSupportLink) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, logoUrl=excluded.logoUrl, discordSupportLink=excluded.discordSupportLink',
            [id, name, logoUrl, discordSupportLink],
            (err) => {
                if (err) return reject(err);
                resolve();
            }
        );
    });
}

function getOrganization(orgId) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Database not initialized'));
        db.get('SELECT * FROM organizations WHERE id = ?', [orgId], (err, row) => {
            if (err) return reject(err);
            resolve(row || null);
        });
    });
}

function createTournament(id, org_id, name, defaultFormat = 'bo3') {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Database not initialized'));
        db.run(
            'INSERT INTO tournaments (id, org_id, name, defaultFormat) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, defaultFormat=excluded.defaultFormat',
            [id, org_id, name, defaultFormat],
            (err) => {
                if (err) return reject(err);
                resolve();
            }
        );
    });
}

function getTournament(tournamentId) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Database not initialized'));
        db.get('SELECT * FROM tournaments WHERE id = ?', [tournamentId], (err, row) => {
            if (err) return reject(err);
            resolve(row || null);
        });
    });
}

function getTournamentsByOrg(orgId) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Database not initialized'));
        db.all('SELECT * FROM tournaments WHERE org_id = ? ORDER BY created_at DESC', [orgId], (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

// ============================================================================
// MATCH QUERIES
// ============================================================================

function saveMatch(match) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Database not initialized'));

        const {
            id, tournament_id, date, teamA, teamB, teamALogo, teamBLogo, format,
            sequence, step, maps, logs, finished, lastPickedMap, playedMaps,
            useTimer, ready, timerEndsAt, timerDuration, useCoinFlip, coinFlip, keys, tempWebhookUrl
        } = match;

        const keysToStore = finished ? null : JSON.stringify(keys);
        const getSafeLogo = (logo) => (logo && Buffer.byteLength(logo, 'utf8') < 3500000) ? logo : null;
        
        const safeLogoA = getSafeLogo(teamALogo);
        const safeLogoB = getSafeLogo(teamBLogo);
        const safeWebhook = isValidDiscordWebhook(tempWebhookUrl) ? tempWebhookUrl : null;

        // 🛡️ ARCHITECTURE FIX: Fallback to 'default' tournament if none is provided
        const tId = tournament_id || 'default';

        const query = `
            INSERT INTO match_history (
                id, tournament_id, date, teamA, teamB, teamALogo, teamBLogo, format,
                sequence, step, maps, logs, finished, lastPickedMap, playedMaps,
                useTimer, ready, timerEndsAt, timerDuration, useCoinFlip, coinFlip, keys_data, tempWebhookUrl
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                tournament_id=excluded.tournament_id, date=excluded.date, teamA=excluded.teamA, teamB=excluded.teamB,
                teamALogo=excluded.teamALogo, teamBLogo=excluded.teamBLogo, format=excluded.format,
                sequence=excluded.sequence, step=excluded.step, maps=excluded.maps, logs=excluded.logs,
                finished=excluded.finished, lastPickedMap=excluded.lastPickedMap, playedMaps=excluded.playedMaps,
                useTimer=excluded.useTimer, ready=excluded.ready, timerEndsAt=excluded.timerEndsAt,
                timerDuration=excluded.timerDuration, useCoinFlip=excluded.useCoinFlip,
                coinFlip=excluded.coinFlip, keys_data=excluded.keys_data, tempWebhookUrl=excluded.tempWebhookUrl
        `;

        db.run(query, [
            id, tId, date, teamA, teamB, safeLogoA, safeLogoB, format,
            JSON.stringify(sequence), step, JSON.stringify(maps), JSON.stringify(logs),
            finished ? 1 : 0, lastPickedMap || null, JSON.stringify(playedMaps),
            useTimer ? 1 : 0, JSON.stringify(ready), timerEndsAt || null,
            timerDuration || 60, useCoinFlip ? 1 : 0,
            coinFlip ? JSON.stringify(coinFlip) : null, keysToStore,
            safeWebhook
        ], (err) => {
            if (err) {
                console.error('[DB] Error saving match:', err);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

function loadAllMatches() {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Database not initialized'));
        db.all('SELECT * FROM match_history WHERE finished = 0 ORDER BY date DESC', [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows.map(row => rowToMatch(row, true))); 
        });
    });
}

function getPaginatedMatches(page = 1, limit = 10, tournamentId = null) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Database not initialized'));
        const offset = (page - 1) * limit;

        let countQuery = 'SELECT COUNT(*) as total FROM match_history WHERE finished = 1';
        let dataQuery = 'SELECT * FROM match_history WHERE finished = 1 ORDER BY date DESC LIMIT ? OFFSET ?';
        let queryParams = [limit, offset];
        let countParams = [];

        // 🛡️ ARCHITECTURE FIX: Support filtering history by specific tournament
        if (tournamentId) {
            countQuery = 'SELECT COUNT(*) as total FROM match_history WHERE finished = 1 AND tournament_id = ?';
            dataQuery = 'SELECT * FROM match_history WHERE finished = 1 AND tournament_id = ? ORDER BY date DESC LIMIT ? OFFSET ?';
            queryParams = [tournamentId, limit, offset];
            countParams = [tournamentId];
        }

        db.get(countQuery, countParams, (err, countRow) => {
            if (err) return reject(err);
            const totalMatches = countRow.total;

            db.all(dataQuery, queryParams, (err, rows) => {
                if (err) return reject(err);
                resolve({
                    matches: rows.map(row => rowToMatch(row, false)),
                    totalMatches,
                    totalPages: Math.ceil(totalMatches / limit),
                    currentPage: page
                });
            });
        });
    });
}

function getAllMatches() {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Database not initialized'));
        db.all('SELECT * FROM match_history ORDER BY date DESC LIMIT 1000', [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows.map(row => rowToMatch(row, false)));
        });
    });
}

function deleteMatch(matchId) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Database not initialized'));
        db.run('DELETE FROM match_history WHERE id = ?', [matchId], function(err) {
            if (err) return reject(err);
            if (this.changes === 0) return resolve(false); 
            resolve(true);
        });
    });
}

function closeDatabase() {
    return new Promise((resolve, reject) => {
        if (db) {
            db.close((err) => {
                if (err) reject(err);
                else {
                    console.log('[DB] Database connection closed');
                    resolve();
                }
            });
        } else {
            resolve();
        }
    });
}

const getRawInstance = () => db;

module.exports = {
    initDatabase,
    saveMatch,
    loadAllMatches,
    getPaginatedMatches,
    getAllMatches,
    deleteMatch,
    closeDatabase,
    getRawInstance,
    // Multi-tenant exports
    createOrganization,
    getOrganization,
    createTournament,
    getTournament,
    getTournamentsByOrg
};
