/**
 * ⚡ COMP-OS — DATABASE MIGRATION ENGINE
 * =============================================================================
 * FILE          : migrate-db.js
 * RESPONSIBILITY: Safely apply versioned schema updates to SQLite.
 * LAYER         : Backend / Data Operations
 * RISK LEVEL    : SECURE (Fully Atomic)
 * =============================================================================
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_FILE = path.join(__dirname, 'match_history.db');

console.log('[MIGRATION] Starting schema verification...');

// 🛡️ ARCHITECTURE FIX: Promise wrappers to prevent db.serialize callback hell & ensure strict atomicity
const runQuery = (db, query, params = []) => new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const getQuery = (db, query, params = []) => new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

const migrations = [
    {
        // 🛡️ BUG FIX: Added base schema creation so fresh installs don't fail
        id: '000_create_base_schema',
        run: async (db) => {
            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS match_history (
                    id TEXT PRIMARY KEY,
                    date TEXT,
                    teamA TEXT,
                    teamB TEXT,
                    teamALogo TEXT,
                    teamBLogo TEXT,
                    format TEXT,
                    sequence TEXT,
                    step INTEGER,
                    maps TEXT,
                    logs TEXT,
                    finished INTEGER,
                    lastPickedMap TEXT,
                    playedMaps TEXT,
                    useTimer INTEGER,
                    ready TEXT,
                    timerEndsAt TEXT,
                    timerDuration INTEGER,
                    useCoinFlip INTEGER,
                    coinFlip TEXT,
                    keys_data TEXT
                )
            `);
            console.log(' ↳ [000] ✅ Base match_history schema verified.');
        }
    },
    {
        id: '001_add_tempWebhookUrl',
        run: async (db) => {
            const rows = await getQuery(db, "PRAGMA table_info(match_history)");
            const exists = rows.some(r => r.name === 'tempWebhookUrl');
            if (exists) {
                console.log(' ↳ [001] ⏭️ Column "tempWebhookUrl" already exists.');
                return;
            }
            await runQuery(db, `ALTER TABLE match_history ADD COLUMN tempWebhookUrl TEXT`);
            console.log(' ↳ [001] ✅ tempWebhookUrl column added successfully.');
        }
    },
    {
        // 🛡️ ARCHITECTURE FIX: Completely atomic transaction using async/await
        id: '002_create_multi_tenant_schema',
        run: async (db) => {
            try {
                await runQuery(db, 'BEGIN TRANSACTION;');

                // 1. Create Organizations
                await runQuery(db, `
                    CREATE TABLE IF NOT EXISTS organizations (
                        id TEXT PRIMARY KEY, 
                        name TEXT NOT NULL,
                        logoUrl TEXT,
                        discordSupportLink TEXT,
                        created_at TEXT NOT NULL DEFAULT (datetime('now'))
                    )
                `);

                // 2. Create Tournaments
                await runQuery(db, `
                    CREATE TABLE IF NOT EXISTS tournaments (
                        id TEXT PRIMARY KEY,
                        org_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        defaultFormat TEXT DEFAULT 'bo1',
                        created_at TEXT NOT NULL DEFAULT (datetime('now')),
                        FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE
                    )
                `);

                // 3. Alter existing match_history
                const rows = await getQuery(db, "PRAGMA table_info(match_history)");
                const hasTournamentId = rows.some(r => r.name === 'tournament_id');
                
                if (!hasTournamentId) {
                    await runQuery(db, `ALTER TABLE match_history ADD COLUMN tournament_id TEXT REFERENCES tournaments(id) ON DELETE CASCADE`);
                }

                // 4. Insert Default "Global" Org and Tournament
                await runQuery(db, `INSERT OR IGNORE INTO organizations (id, name) VALUES ('global', 'Global')`);
                await runQuery(db, `INSERT OR IGNORE INTO tournaments (id, org_id, name) VALUES ('default', 'global', 'Default Tournament')`);
                
                // 5. Link old matches
                await runQuery(db, `UPDATE match_history SET tournament_id = 'default' WHERE tournament_id IS NULL`);

                await runQuery(db, 'COMMIT;');
                console.log(' ↳ [002] ✅ Multi-tenant schema successfully applied.');
            } catch (error) {
                await runQuery(db, 'ROLLBACK;');
                console.error(' ↳ [002] ❌ Transaction Failed! Rolled back successfully.');
                throw error; // Bubble up to stop execution
            }
        }
    }
];

const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) { 
        console.error('[MIGRATION] ❌ Failed to open DB:', err); 
        process.exit(1); 
    }
    
    db.serialize(() => {
        db.run('PRAGMA journal_mode = WAL');
        db.run('PRAGMA synchronous = NORMAL');
        
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
            process.exit(intendedCode === 0 ? 0 : 1); 
        }
        process.exit(intendedCode);
    });
}
