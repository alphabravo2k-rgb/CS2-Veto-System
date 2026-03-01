// File: db.js
/**
 * ⚡ COMP-OS — DATABASE ACCESS LAYER
 * =============================================================================
 * FILE          : db.js
 * RESPONSIBILITY: SQLite Persistence for Veto Matches
 * LAYER         : Backend Persistence
 * RISK LEVEL    : CRITICAL
 * =============================================================================
 *
 * RELEASE METADATA
 * -----------------------------------------------------------------------------
 * VERSION       : v2.0.0 (SECURE-PERSISTENCE)
 * STATUS        : ENFORCED
 *
 * FEATURES:
 * - Ephemeral Keys: Access keys are scrubbed upon match completion.
 * - Bounded Memory: Server boot only loads active (unfinished) matches.
 * - High-Performance: WAL Mode enabled + Date/Status indexing.
 * - Payload Caps: Enforces size limits on Base64 image uploads.
 * =============================================================================
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_FILE = path.join(__dirname, 'match_history.db');

let db = null;

// 🛡️ SECURITY FIX: SSRF Validation for Webhooks at the DB level
function isValidWebhook(url) {
    if (!url || typeof url !== 'string') return false;
    return url.startsWith('https://discord.com/api/webhooks/') || url.startsWith('https://discordapp.com/api/webhooks/');
}

// 🛡️ MAINTAINABILITY FIX: Centralized deserializer prevents triple-duplication
function rowToMatch(row, includeKeys = false) {
    const match = {
        id: row.id,
        date: row.date,
        teamA: row.teamA,
        teamB: row.teamB,
        teamALogo: row.teamALogo,
        teamBLogo: row.teamBLogo,
        format: row.format,
        sequence: JSON.parse(row.sequence),
        step: row.step,
        maps: JSON.parse(row.maps),
        logs: JSON.parse(row.logs),
        finished: row.finished === 1,
        lastPickedMap: row.lastPickedMap,
        playedMaps: JSON.parse(row.playedMaps),
        useTimer: row.useTimer === 1,
        ready: JSON.parse(row.ready),
        timerEndsAt: row.timerEndsAt,
        timerDuration: row.timerDuration || 60,
        useCoinFlip: row.useCoinFlip === 1,
        coinFlip: row.coinFlip ? JSON.parse(row.coinFlip) : null,
        tempWebhookUrl: row.tempWebhookUrl
    };

    if (includeKeys && row.keys_data) {
        try { match.keys = JSON.parse(row.keys_data); } catch (e) { match.keys = null; }
    }
    return match;
}

// Initialize database and create table if needed
function initDatabase() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(DB_FILE, (err) => {
            if (err) {
                console.error('[DB] Error opening database:', err);
                return reject(err);
            }
            console.log('[DB] Connected to SQLite database');

            // 🛡️ SCALABILITY FIX: Enable WAL mode for concurrent reads/writes
            db.run('PRAGMA journal_mode = WAL');
            db.run('PRAGMA synchronous = NORMAL');
            db.run('PRAGMA foreign_keys = ON');

            // Create table if it doesn't exist
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
                if (err) {
                    console.error('[DB] Error creating table:', err);
                    return reject(err);
                } 
                
                // 🛡️ SCALABILITY FIX: Add performance indexes for faster querying
                db.run('CREATE INDEX IF NOT EXISTS idx_finished ON match_history(finished)');
                db.run('CREATE INDEX IF NOT EXISTS idx_date ON match_history(date DESC)', (indexErr) => {
                    if (indexErr) console.error('[DB] Error creating indexes:', indexErr);
                    else console.log('[DB] Table and indexes verified successfully');
                    resolve();
                });
            });
        });
    });
}

// Save or update a match in database
function saveMatch(match) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Database not initialized'));

        const {
            id, date, teamA, teamB, teamALogo, teamBLogo, format,
            sequence, step, maps, logs, finished, lastPickedMap, playedMaps,
            useTimer, ready, timerEndsAt, timerDuration, useCoinFlip, coinFlip, keys, tempWebhookUrl
        } = match;

        // 🛡️ SECURITY FIX: Ephemeral Keys. Once a match is finished, permanently delete the keys from the database.
        const keysToStore = finished ? null : JSON.stringify(keys);

        // 🛡️ SECURITY FIX: Enforce max size for base64 logos (~3MB string length limit)
        const safeLogoA = (teamALogo && teamALogo.length < 3500000) ? teamALogo : null;
        const safeLogoB = (teamBLogo && teamBLogo.length < 3500000) ? teamBLogo : null;

        // 🛡️ SECURITY FIX: SSRF validation checkpoint
        const safeWebhook = isValidWebhook(tempWebhookUrl) ? tempWebhookUrl : null;

        // 🛡️ MAINTAINABILITY FIX: Upgraded to true UPSERT to prevent rowid destruction
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

// Load ACTIVE matches from database (For server startup)
function loadAllMatches() {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Database not initialized'));

        // 🛡️ SCALABILITY FIX: Bounded startup load. Only load unfinished matches into memory!
        db.all('SELECT * FROM match_history WHERE finished = 0 ORDER BY date DESC LIMIT 100', [], (err, rows) => {
            if (err) {
                console.error('[DB] Error loading matches:', err);
                return reject(err);
            }
            resolve(rows.map(row => rowToMatch(row, true))); // Include keys so active matches can be joined
        });
    });
}

// Get paginated matches (for public history)
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
                        matches: rows.map(row => rowToMatch(row, false)), // 🛡️ SECURITY FIX: Strip keys from public API
                        totalMatches,
                        totalPages: Math.ceil(totalMatches / limit),
                        currentPage: page
                    });
                }
            );
        });
    });
}

// Get all matches (for admin dashboard)
function getAllMatches() {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Database not initialized'));

        db.all('SELECT * FROM match_history ORDER BY date DESC', [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows.map(row => rowToMatch(row, false))); // 🛡️ SECURITY FIX: Admin panel doesn't need historical keys
        });
    });
}

// Delete a match
function deleteMatch(matchId) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Database not initialized'));

        db.run('DELETE FROM match_history WHERE id = ?', [matchId], (err) => {
            if (err) reject(err);
            else resolve(true);
        });
    });
}

// Close database connection
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

module.exports = {
    initDatabase,
    saveMatch,
    loadAllMatches,
    getPaginatedMatches,
    getAllMatches,
    deleteMatch,
    closeDatabase
};
