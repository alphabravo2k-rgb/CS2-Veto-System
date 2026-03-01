// File: settings.js
/**
 * ⚡ COMP-OS — SETTINGS PERSISTENCE
 * =============================================================================
 * FILE          : settings.js
 * RESPONSIBILITY: Stores global server configurations in SQLite
 * LAYER         : Backend Persistence
 * RISK LEVEL    : LOW/MEDIUM
 * =============================================================================
 *
 * RELEASE METADATA
 * -----------------------------------------------------------------------------
 * VERSION       : v2.0.0 (DEPENDENCY-INJECTED)
 * STATUS        : ENFORCED
 *
 * FEATURES:
 * - Dependency Injection: Uses the primary DB handle to prevent SQLite locking.
 * - Deep Defense: SSRF Webhook validation enforced before DB commit.
 * - Auditing: added `updated_at` timestamps for tracing configuration changes.
 * =============================================================================
 */

const { isValidDiscordWebhook } = require('./discord-webhook');

let db = null;

// 🛡️ ARCHITECTURE FIX: Inject the database connection instead of creating a duplicate handle
function initSettingsTable(database) {
    db = database; 

    return new Promise((resolve, reject) => {
        if (!db) {
            return reject(new Error('[SETTINGS] Database connection is null'));
        }

        // 🛡️ MAINTAINABILITY FIX: Added updated_at for audit trails
        db.run(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        `, (err) => {
            if (err) {
                console.error('[SETTINGS] Error creating settings table:', err);
                reject(err);
            } else {
                console.log('[SETTINGS] Settings table verified successfully');
                resolve();
            }
        });
    });
}

// Get admin webhook URL
function getAdminWebhook() {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Database not initialized'));

        db.get('SELECT value FROM settings WHERE key = ?', ['admin_webhook'], (err, row) => {
            if (err) {
                console.error('[SETTINGS] Error getting admin webhook:', err);
                reject(err);
            } else {
                resolve(row ? row.value : null);
            }
        });
    });
}

// Set admin webhook URL
function setAdminWebhook(url) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Database not initialized'));

        // 🛡️ SECURITY FIX: SSRF Validation enforced at the lowest storage layer
        if (url && !isValidDiscordWebhook(url)) {
            return reject(new Error('Invalid Discord webhook URL'));
        }

        // 🛡️ MAINTAINABILITY FIX: True UPSERT with timestamp updating
        const query = `
            INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')
        `;

        db.run(query, ['admin_webhook', url], (err) => {
            if (err) {
                console.error('[SETTINGS] Error setting admin webhook:', err);
                reject(err);
            } else {
                console.log('[SETTINGS] Admin webhook updated successfully');
                resolve();
            }
        });
    });
}

module.exports = {
    initSettingsTable,
    getAdminWebhook,
    setAdminWebhook
};
