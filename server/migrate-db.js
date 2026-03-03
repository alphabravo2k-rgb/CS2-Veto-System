// File: migrate.js (or server/migrate.js)
/**
 * ⚡ COMP-OS — DATABASE MIGRATION ENGINE
 * =============================================================================
 * FILE          : migrate.js
 * RESPONSIBILITY: Safely apply schema updates to SQLite without data loss.
 * LAYER         : Backend / Data Operations
 * =============================================================================
 * * FEATURES:
 * - Schema Introspection: Checks existing columns before applying alters.
 * - Centralized Exit: Ensures DB connection is closed gracefully.
 * - Safe Async Flow: Waits for explicit connection before executing PRAGMA.
 * =============================================================================
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_FILE = path.join(__dirname, 'match_history.db');

console.log('[MIGRATION] Starting...');

// 🛡️ CONTROL FLOW FIX: Execute migration only after connection is verified
const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) { 
        console.error('[MIGRATION] Failed to open DB:', err); 
        process.exit(1); 
    }
    console.log('[MIGRATION] Connected to SQLite');
    runMigration();
});

function runMigration() {
    // 🛡️ ARCHITECTURE FIX: Introspect schema instead of using error-driven control flow
    db.all("PRAGMA table_info(match_history)", (err, rows) => {
        if (err) { 
            console.error('[MIGRATION] PRAGMA query failed:', err); 
            return closeAndExit(1); 
        }

        const exists = rows.some(r => r.name === 'tempWebhookUrl');
        if (exists) {
            console.log('[MIGRATION] Column "tempWebhookUrl" already exists. Nothing to do.');
            return closeAndExit(0);
        }

        db.run(`ALTER TABLE match_history ADD COLUMN tempWebhookUrl TEXT`, (err) => {
            if (err) { 
                console.error('[MIGRATION] ALTER TABLE failed:', err); 
                return closeAndExit(1); 
            }
            console.log('[MIGRATION] ✅ tempWebhookUrl column added successfully');
            closeAndExit(0);
        });
    });
}

// 🛡️ MAINTAINABILITY FIX: Centralized cleanup prevents memory leaks and locked DB files
function closeAndExit(code) {
    db.close((err) => {
        if (err) {
            console.error('[MIGRATION] Error closing DB:', err);
            // Force exit with error code if close fails, regardless of intended code
            process.exit(1);
        }
        process.exit(code);
    });
}
