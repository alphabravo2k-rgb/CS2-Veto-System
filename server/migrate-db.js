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

                await runQuery(db, `
                    CREATE TABLE IF NOT EXISTS organizations (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        logoUrl TEXT,
                        discordSupportLink TEXT,
                        created_at TEXT NOT NULL DEFAULT (datetime('now'))
                    )
                `);

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

                const rows = await getQuery(db, "PRAGMA table_info(match_history)");
                const hasTournamentId = rows.some(r => r.name === 'tournament_id');
                if (!hasTournamentId) {
                    await runQuery(db, `ALTER TABLE match_history ADD COLUMN tournament_id TEXT REFERENCES tournaments(id) ON DELETE CASCADE`);
                }

                await runQuery(db, `INSERT OR IGNORE INTO organizations (id, name) VALUES ('global', 'Global')`);
                await runQuery(db, `INSERT OR IGNORE INTO tournaments (id, org_id, name) VALUES ('default', 'global', 'Default Tournament')`);
                await runQuery(db, `UPDATE match_history SET tournament_id = 'default' WHERE tournament_id IS NULL`);

                await runQuery(db, 'COMMIT;');
                console.log(' ↳ [002] ✅ Multi-tenant schema successfully applied.');
            } catch (error) {
                await runQuery(db, 'ROLLBACK;');
                console.error(' ↳ [002] ❌ Transaction Failed! Rolled back successfully.');
                throw error;
            }
        }
    },
    {
        // ── NEW: Full platform identity — users, auth tokens, player accounts,
        //         org branding, org members, teams, audit logs, map pools ──────
        id: '003_platform_identity_schema',
        run: async (db) => {
            try {
                await runQuery(db, 'BEGIN TRANSACTION;');

                // Users — primary identity store
                await runQuery(db, `CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    username TEXT UNIQUE NOT NULL,
                    display_name TEXT,
                    username_changed_at TEXT,
                    role TEXT NOT NULL DEFAULT 'user',
                    country TEXT,
                    server_region TEXT,
                    dob TEXT,
                    age_verified INTEGER NOT NULL DEFAULT 0,
                    avatar_url TEXT,
                    bio TEXT,
                    suspended INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )`);
                await runQuery(db, `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
                await runQuery(db, `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);

                // JWT refresh token store (rotating)
                await runQuery(db, `CREATE TABLE IF NOT EXISTS refresh_tokens (
                    token TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )`);
                await runQuery(db, `CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id)`);

                // External platform accounts (Steam, Riot, Epic, FACEIT)
                await runQuery(db, `CREATE TABLE IF NOT EXISTS player_accounts (
                    user_id TEXT NOT NULL,
                    platform TEXT NOT NULL,
                    platform_id TEXT NOT NULL,
                    platform_username TEXT,
                    PRIMARY KEY (user_id, platform),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )`);

                // Org membership with roles
                await runQuery(db, `CREATE TABLE IF NOT EXISTS org_members (
                    org_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'member',
                    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
                    PRIMARY KEY (org_id, user_id),
                    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )`);

                // White-label branding per org
                await runQuery(db, `CREATE TABLE IF NOT EXISTS org_branding (
                    org_id TEXT PRIMARY KEY,
                    display_name TEXT,
                    primary_color TEXT NOT NULL DEFAULT '#00d4ff',
                    secondary_color TEXT NOT NULL DEFAULT '#0a0f1e',
                    logo_url TEXT,
                    banner_url TEXT,
                    custom_domain TEXT,
                    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
                )`);
                await runQuery(db, `INSERT OR IGNORE INTO org_branding (org_id, display_name) VALUES ('global', 'Global')`);

                // Per-tournament map pools (replaces global maps.json)
                await runQuery(db, `CREATE TABLE IF NOT EXISTS tournament_map_pools (
                    tournament_id TEXT NOT NULL,
                    map_name TEXT NOT NULL,
                    map_image_url TEXT,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (tournament_id, map_name),
                    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
                )`);

                // Seed default tournament with CS2 active duty maps
                const cs2Maps = ['Dust2','Inferno','Mirage','Overpass','Nuke','Anubis','Ancient'];
                for (let i = 0; i < cs2Maps.length; i++) {
                    await runQuery(db,
                        `INSERT OR IGNORE INTO tournament_map_pools (tournament_id, map_name, sort_order) VALUES ('default', ?, ?)`,
                        [cs2Maps[i], i]
                    );
                }

                // Teams (org-scoped)
                await runQuery(db, `CREATE TABLE IF NOT EXISTS teams (
                    id TEXT PRIMARY KEY,
                    org_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    logo_url TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
                )`);

                // Team roster
                await runQuery(db, `CREATE TABLE IF NOT EXISTS team_players (
                    team_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    role TEXT DEFAULT 'player',
                    PRIMARY KEY (team_id, user_id),
                    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )`);

                // Immutable audit log
                await runQuery(db, `CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    actor_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    target_id TEXT,
                    meta TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )`);
                await runQuery(db, `CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)`);

                await runQuery(db, 'COMMIT;');
                console.log(' ↳ [003] ✅ Platform identity, branding, teams, audit schema applied.');
            } catch (error) {
                await runQuery(db, 'ROLLBACK;');
                console.error(' ↳ [003] ❌ Transaction failed. Rolled back.');
                throw error;
            }
        }
    },
    {
        // ── NEW: Match status, game module columns, and performance indexes ──
        id: '004_match_status_and_indexes',
        run: async (db) => {
            try {
                await runQuery(db, 'BEGIN TRANSACTION;');

                // Add columns to match_history
                const matchCols = (await getQuery(db, "PRAGMA table_info(match_history)")).map(c => c.name);
                if (!matchCols.includes('game_module'))
                    await runQuery(db, `ALTER TABLE match_history ADD COLUMN game_module TEXT DEFAULT 'cs2'`);
                if (!matchCols.includes('status'))
                    await runQuery(db, `ALTER TABLE match_history ADD COLUMN status TEXT DEFAULT 'veto_in_progress'`);
                if (!matchCols.includes('scheduled_time'))
                    await runQuery(db, `ALTER TABLE match_history ADD COLUMN scheduled_time TEXT`);

                // Back-fill existing rows
                await runQuery(db, `UPDATE match_history SET game_module = 'cs2' WHERE game_module IS NULL`);
                await runQuery(db, `UPDATE match_history SET status = CASE WHEN finished = 1 THEN 'completed' ELSE 'veto_in_progress' END WHERE status IS NULL`);

                // Add columns to tournaments
                const tCols = (await getQuery(db, "PRAGMA table_info(tournaments)")).map(c => c.name);
                if (!tCols.includes('game_module'))
                    await runQuery(db, `ALTER TABLE tournaments ADD COLUMN game_module TEXT DEFAULT 'cs2'`);
                if (!tCols.includes('status'))
                    await runQuery(db, `ALTER TABLE tournaments ADD COLUMN status TEXT DEFAULT 'active'`);

                // Performance indexes for common queries
                await runQuery(db, `CREATE INDEX IF NOT EXISTS idx_match_finished ON match_history(finished)`);
                await runQuery(db, `CREATE INDEX IF NOT EXISTS idx_match_tournament ON match_history(tournament_id)`);
                await runQuery(db, `CREATE INDEX IF NOT EXISTS idx_match_date ON match_history(date)`);
                await runQuery(db, `CREATE INDEX IF NOT EXISTS idx_tournament_org ON tournaments(org_id)`);

                await runQuery(db, 'COMMIT;');
                console.log(' ↳ [004] ✅ Match status, game_module, and indexes applied.');
            } catch (error) {
                await runQuery(db, 'ROLLBACK;');
                console.error(' ↳ [004] ❌ Transaction failed. Rolled back.');
                throw error;
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
