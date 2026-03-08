/**
 * ⚡ COMP-OS — DATABASE ACCESS LAYER
 * =============================================================================
 * FILE          : db.js
 * RESPONSIBILITY: Multi-Tenant SQLite Persistence & Relational Integrity
 * LAYER         : Backend Persistence
 * RISK LEVEL    : SECURED
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
        return fallback;
    }
}

function rowToMatch(row, includeKeys = false) {
    const match = {
        id: row.id,
        tournament_id: row.tournament_id || 'default', 
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
            if (err) return reject(err);

            db.serialize(() => {
                db.run('PRAGMA foreign_keys = ON');
                db.run('PRAGMA journal_mode = WAL');
                db.run('PRAGMA synchronous = NORMAL');
                
                // 🛡️ SECURITY: Verify tables exist
                db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='match_history'", [], (err, row) => {
                    if (!row) console.error('[DB] ⚠️ WARNING: Tables missing. Run migrate-db.js!');
                });
                
                resolve();
            });
        });
    });
}

// ============================================================================
// MULTI-TENANT QUERIES
// ============================================================================

function createOrganization(id, name, logoUrl = null, discordSupportLink = null) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO organizations (id, name, logoUrl, discordSupportLink) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, logoUrl=excluded.logoUrl, discordSupportLink=excluded.discordSupportLink',
            [id, name, logoUrl, discordSupportLink],
            (err) => err ? reject(err) : resolve()
        );
    });
}

function createTournament(id, org_id, name, defaultFormat = 'bo3') {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO tournaments (id, org_id, name, defaultFormat) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, defaultFormat=excluded.defaultFormat',
            [id, org_id, name, defaultFormat],
            (err) => err ? reject(err) : resolve()
        );
    });
}

// ============================================================================
// MATCH PERSISTENCE
// ============================================================================

function saveMatch(match) {
    return new Promise((resolve, reject) => {
        const { id, tournament_id, date, teamA, teamB, teamALogo, teamBLogo, format, sequence, step, maps, logs, finished, lastPickedMap, playedMaps, useTimer, ready, timerEndsAt, timerDuration, useCoinFlip, coinFlip, keys, tempWebhookUrl } = match;

        const keysToStore = (finished || !keys) ? null : JSON.stringify(keys);
        const safeWebhook = isValidDiscordWebhook(tempWebhookUrl) ? tempWebhookUrl : null;
        const tId = tournament_id || 'default';

        const query = `
            INSERT INTO match_history (id, tournament_id, date, teamA, teamB, teamALogo, teamBLogo, format, sequence, step, maps, logs, finished, lastPickedMap, playedMaps, useTimer, ready, timerEndsAt, timerDuration, useCoinFlip, coinFlip, keys_data, tempWebhookUrl) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET 
            tournament_id=excluded.tournament_id, date=excluded.date, teamA=excluded.teamA, teamB=excluded.teamB, teamALogo=excluded.teamALogo, teamBLogo=excluded.teamBLogo, format=excluded.format, sequence=excluded.sequence, step=excluded.step, maps=excluded.maps, logs=excluded.logs, finished=excluded.finished, lastPickedMap=excluded.lastPickedMap, playedMaps=excluded.playedMaps, useTimer=excluded.useTimer, ready=excluded.ready, timerEndsAt=excluded.timerEndsAt, timerDuration=excluded.timerDuration, useCoinFlip=excluded.useCoinFlip, coinFlip=excluded.coinFlip, keys_data=excluded.keys_data, tempWebhookUrl=excluded.tempWebhookUrl
        `;

        db.run(query, [id, tId, date, teamA.slice(0, 50), teamB.slice(0, 50), teamALogo, teamBLogo, format, JSON.stringify(sequence), step, JSON.stringify(maps), JSON.stringify(logs), finished ? 1 : 0, lastPickedMap || null, JSON.stringify(playedMaps), useTimer ? 1 : 0, JSON.stringify(ready), timerEndsAt || null, timerDuration || 60, useCoinFlip ? 1 : 0, coinFlip ? JSON.stringify(coinFlip) : null, keysToStore, safeWebhook], (err) => err ? reject(err) : resolve());
    });
}

// 🛡️ FIX: Renamed to loadActiveMatches for clarity
function loadActiveMatches() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM match_history WHERE finished = 0 ORDER BY date DESC', [], (err, rows) => {
            err ? reject(err) : resolve(rows.map(row => rowToMatch(row, true)));
        });
    });
}

function getPaginatedMatches(page = 1, limit = 10, tournamentId = null) {
    return new Promise((resolve, reject) => {
        const offset = (page - 1) * limit;
        const queryBase = 'FROM match_history WHERE finished = 1';
        const filter = tournamentId ? ' AND tournament_id = ?' : '';
        const params = tournamentId ? [tournamentId, limit, offset] : [limit, offset];

        db.get(`SELECT COUNT(*) as total ${queryBase}${filter}`, tournamentId ? [tournamentId] : [], (err, countRow) => {
            if (err) return reject(err);
            db.all(`SELECT * ${queryBase}${filter} ORDER BY date DESC LIMIT ? OFFSET ?`, params, (err, rows) => {
                err ? reject(err) : resolve({ matches: rows.map(r => rowToMatch(r)), totalMatches: countRow.total });
            });
        });
    });
}

function deleteMatch(matchId) {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM match_history WHERE id = ?', [matchId], function(err) {
            err ? reject(err) : resolve(this.changes > 0);
        });
    });
}

module.exports = { initDatabase, saveMatch, loadActiveMatches, getPaginatedMatches, deleteMatch, createOrganization, createTournament };
