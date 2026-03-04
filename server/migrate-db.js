/**
 * ⚡ COMP-OS — DATABASE MIGRATION ENGINE
 * =============================================================================
 * FILE          : migrate-db.js
 * RESPONSIBILITY: Safely apply versioned schema updates to SQLite.
 * LAYER         : Backend / Data Operations
 * RISK LEVEL    : CRITICAL
 * =============================================================================
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_FILE = path.join(__dirname, 'match_history.db');

console.log('[MIGRATION] Starting schema verification...');

// 🛡️ ARCHITECTURE FIX: Defined a structured array of migrations. 
// Adding future schema changes is as simple as adding a new object to this array.
const migrations = [
    {
        id: '001_add_tempWebhookUrl',
        run: (db) => new Promise((resolve, reject) => {
            db.all("PRAGMA table_info(match_history)", (err, rows) => {
                if (err) return reject(err);
                if (!rows || rows.length === 0) return resolve(); // Table doesn't exist yet, db.js will create it with the column

                const exists = rows.some(r => r.name === 'tempWebhookUrl');
                if (exists) {
                    console.log(' ↳ [001] Column "tempWebhookUrl" already exists.');
                    return resolve();
                }

                db.run(`ALTER TABLE match_history ADD COLUMN tempWebhookUrl TEXT`, (err) => {
                    if (err) return reject(err);
                    console.log(' ↳ [001] ✅ tempWebhookUrl column added successfully.');
                    resolve();
                });
            });
        })
    }
];

const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) { 
        console.error('[MIGRATION] ❌ Failed to open DB:', err); 
        process.exit(1); 
    }
    
    // 🛡️ RELIABILITY FIX: Enable WAL mode for safe migrations
    db.serialize(() => {
        db.run('PRAGMA journal_mode = WAL');
        db.run('PRAGMA synchronous = NORMAL');
        
        // 🛡️ ARCHITECTURE FIX: Create tracking table for schema versioning
        db.run(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        `, (err) => {
            if (err) {
                console.error('[MIGRATION] ❌ Failed to create migrations tracking table:', err);
                return closeAndExit(1);
            }
            executeMigrationsSequentially();
        });
    });
});

async function executeMigrationsSequentially() {
    try {
        for (const migration of migrations) {
            const isApplied = await checkMigrationApplied(migration.id);
            if (isApplied) {
                console.log(`[MIGRATION] ⏭️ Skipped ${migration.id} (already applied)`);
                continue;
            }

            console.log(`[MIGRATION] ⏳ Running ${migration.id}...`);
            await migration.run(db);
            await recordMigration(migration.id);
        }
        
        console.log('[MIGRATION] 🎉 All schema migrations complete.');
        closeAndExit(0);
        
    } catch (error) {
        console.error('[MIGRATION] ❌ FATAL MIGRATION ERROR:', error);
        closeAndExit(1);
    }
}

function checkMigrationApplied(id) {
    return new Promise((resolve, reject) => {
        db.get('SELECT id FROM schema_migrations WHERE id = ?', [id], (err, row) => {
            if (err) return reject(err);
            resolve(!!row);
        });
    });
}

function recordMigration(id) {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO schema_migrations (id) VALUES (?)', [id], (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

function closeAndExit(intendedCode) {
    db.close((err) => {
        if (err) {
            console.error('[MIGRATION] ⚠️ Error closing DB:', err);
            // 🛡️ CORRECTNESS FIX: Prioritize intended exit code, but log the close failure
            process.exit(intendedCode === 0 ? 0 : 1); 
        }
        process.exit(intendedCode);
    });
}s
