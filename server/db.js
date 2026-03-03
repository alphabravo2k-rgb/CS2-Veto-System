/**
 * ⚡ COMP-OS — DATABASE ACCESS LAYER
 * =============================================================================
 * FILE          : db.js
 * RESPONSIBILITY: SQLite Persistence for Veto Matches
 * LAYER         : Backend Persistence
 * RISK LEVEL    : CRITICAL
 * =============================================================================
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
// 🛡️ ARCHITECTURE FIX: Import the canonical validator from the Trust Chain
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
                // 🛡️ CORRECTNESS FIX: Actually read the result of the integrity check
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
                
                // 🛡️ ARCHITECTURE FIX: Add error callbacks to prevent silent failures
                db.run('PRAGMA synchronous = NORMAL', (err) => { if (err) console.error('[DB] Failed setting sync mode', err) });
                db.run('PRAGMA foreign_keys = ON', (err) => { if (err) console.error('[DB] Failed setting foreign keys', err) });

                db.run(`
                    CREATE TABLE IF NOT EXISTS match_history (
                        id TEXT PRIMARY KEY,
                        date TEXT NOT NULL,
                        teamA TEXT NOT NULL,
                        teamB TEXT NOT NULL,
                        teamALogo TEXT,
                        teamBLogo TEXT,
                        format TEXT NOT NULL,
                        sequence TEXT NOT NULL,
                        step INTEGER NOT NULL DEFAULT 0,
                        maps TEXT NOT NULL,
                        logs TEXT NOT NULL,
                        finished INTEGER NOT NULL DEFAULT 0,
                        lastPickedMap TEXT,
                        playedMaps TEXT NOT NULL,
                        useTimer INTEGER NOT NULL DEFAULT 0,
                        ready TEXT NOT NULL,
                        timerEndsAt INTEGER,
                        timerDuration INTEGER NOT NULL DEFAULT 60,
                        useCoinFlip INTEGER NOT NULL DEFAULT 0,
                        coinFlip TEXT,
                        keys_data TEXT,
                        tempWebhookUrl TEXT
                    )
                `, (err) => {
                    if (err) return reject(err);

                    db.run('CREATE INDEX IF NOT EXISTS idx_finished ON match_history(finished)');
                    db.run('CREATE INDEX IF NOT EXISTS idx_date ON match_history(date DESC)', (indexErr) => {
                        if (indexErr) console.error('[DB] Error creating indexes:', indexErr);
                        else console.log('[DB] Table and indexes verified successfully');
                        resolve();
                    });
                });
            });
        });
    });
}

function saveMatch(match) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Database not initialized'));

        const {
            id, date, teamA, teamB, teamALogo, teamBLogo, format,
            sequence, step, maps, logs, finished, lastPickedMap, playedMaps,
            useTimer, ready, timerEndsAt, timerDuration, useCoinFlip, coinFlip, keys, tempWebhookUrl
        } = match;

        const keysToStore = finished ? null : JSON.stringify(keys);

        const getSafeLogo = (logo) => (logo && Buffer.byteLength(logo, 'utf8') < 3500000) ? logo : null;
        const safeLogoA = getSafeLogo(teamALogo);
        const safeLogoB = getSafeLogo(teamBLogo);

        // 🛡️ SECURITY FIX: Used the canonical validator
        const safeWebhook = isValidDiscordWebhook(tempWebhookUrl) ? tempWebhookUrl : null;

        const query = `
            INSERT INTO match_history (
                id, date, teamA, teamB, teamALogo, teamBLogo, format,
                sequence, step, maps, logs, finished, lastPickedMap, playedMaps,
                useTimer, ready, timerEndsAt, timerDuration, useCoinFlip, coinFlip, keys_data, tempWebhookUrl
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                date=excluded.date, teamA=excluded.teamA, teamB=excluded.teamB,
                teamALogo=excluded.teamALogo, teamBLogo=excluded.teamBLogo, format=excluded.format,
                sequence=excluded.sequence, step=excluded.step, maps=excluded.maps, logs=excluded.logs,
                finished=excluded.finished, lastPickedMap=excluded.lastPickedMap, playedMaps=excluded.playedMaps,
                useTimer=excluded.useTimer, ready=excluded.ready, timerEndsAt=excluded.timerEndsAt,
                timerDuration=excluded.timerDuration, useCoinFlip=excluded.useCoinFlip,
                coinFlip=excluded.coinFlip, keys_data=excluded.keys_data, tempWebhookUrl=excluded.tempWebhookUrl
        `;

        db.run(query, [
            id, date, teamA, teamB, safeLogoA, safeLogoB, format,
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
            if (err) {
                console.error('[DB] Error loading matches:', err);
                return reject(err);
            }
            resolve(rows.map(row => rowToMatch(row, true))); 
        });
    });
}

function getPaginatedMatches(page = 1, limit = 10) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Database not initialized'));
        const offset = (page - 1) * limit;

        db.get('SELECT COUNT(*) as total FROM match_history WHERE finished = 1', [], (err, countRow) => {
            if (err) return reject(err);

            const totalMatches = countRow.total;

            db.all(
                'SELECT * FROM match_history WHERE finished = 1 ORDER BY date DESC LIMIT ? OFFSET ?',
                [limit, offset],
                (err, rows) => {
                    if (err) return reject(err);
                    
                    resolve({
                        matches: rows.map(row => rowToMatch(row, false)),
                        totalMatches,
                        totalPages: Math.ceil(totalMatches / limit),
                        currentPage: page
                    });
                }
            );
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
    getRawInstance
};
