/**
 * ⚡ INFRA LAYER — DATABASE ADAPTER
 * =============================================================================
 * PROBLEM (Architecture Flaw): The original codebase scattered raw sqlite3
 * callback-style calls across db.js, server.js, and migrate-db.js with no
 * consistent interface, making a future PostgreSQL migration impossible without
 * a full rewrite.
 *
 * FIX: Repository-pattern adapter. All DB access goes through this module.
 * Swapping SQLite → PostgreSQL only requires changing this one file.
 * =============================================================================
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'match_history.db');

let _db = null;

function getDb() {
    if (!_db) throw new Error('[DB] Database not initialized. Call initDb() first.');
    return _db;
}

/**
 * Initialize the database connection with WAL mode and foreign keys enforced.
 */
function initDb() {
    return new Promise((resolve, reject) => {
        _db = new sqlite3.Database(DB_FILE, (err) => {
            if (err) return reject(err);
            _db.serialize(() => {
                _db.run('PRAGMA journal_mode = WAL');
                _db.run('PRAGMA synchronous = NORMAL');
                _db.run('PRAGMA foreign_keys = ON', (err) => {
                    if (err) return reject(err);
                    console.log('[DB] Connected and configured (WAL + FK enforced)');
                    resolve();
                });
            });
        });
    });
}

/**
 * Execute a statement that returns no rows (INSERT, UPDATE, DELETE).
 * @returns {Promise<{ lastID, changes }>}
 */
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDb().run(sql, params, function (err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

/**
 * Execute a query expecting a single row.
 * @returns {Promise<object|null>}
 */
function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDb().get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row || null);
        });
    });
}

/**
 * Execute a query returning all matching rows.
 * @returns {Promise<object[]>}
 */
function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDb().all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

/**
 * Execute multiple statements in a serialized block.
 * Use for migrations or multi-step writes.
 */
function serialize(fn) {
    return new Promise((resolve, reject) => {
        getDb().serialize(() => {
            try {
                const result = fn(getDb());
                if (result && typeof result.then === 'function') {
                    result.then(resolve).catch(reject);
                } else {
                    resolve(result);
                }
            } catch (err) {
                reject(err);
            }
        });
    });
}

/** Expose raw instance for legacy compatibility during migration. */
function getRawInstance() {
    return _db;
}

function closeDb() {
    return new Promise((resolve, reject) => {
        if (_db) {
            _db.close((err) => {
                if (err) return reject(err);
                _db = null;
                console.log('[DB] Connection closed');
                resolve();
            });
        } else {
            resolve();
        }
    });
}

module.exports = { initDb, run, get, all, serialize, getRawInstance, closeDb };
