/**
 * ⚡ COMP-OS — SETTINGS PERSISTENCE
 * =============================================================================
 * FILE          : settings.js
 * RESPONSIBILITY: Stores global server configurations in SQLite
 * LAYER         : Backend Persistence
 * RISK LEVEL    : LOW
 * =============================================================================
 */

const { isValidDiscordWebhook } = require('./discord-webhook');

let db = null;

// 🛡️ SECURITY FIX: Enumerate valid keys to prevent arbitrary config injection
const VALID_KEYS = new Set([
    'admin_webhook'
]);

function initSettingsTable(database) {
    // 🛡️ ARCHITECTURE FIX: Guard against double-initialization
    if (db) return Promise.resolve();
    
    db = database; 

    return new Promise((resolve, reject) => {
        if (!db) {
            return reject(new Error('[SETTINGS] Database connection is null'));
        }

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

/**
 * 🧠 INTERNAL ENGINE: Generic Safe Getter (STRICTLY PRIVATE)
 */
function getSetting(key) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Database not initialized'));
        
        // 🛡️ SECURITY FIX: Do not log the raw key to prevent log injection
        if (!VALID_KEYS.has(key)) return reject(new Error(`[SETTINGS] Security Block: Unknown key requested`));

        db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
            if (err) {
                console.error(`[SETTINGS] Error getting setting:`, err);
                reject(err);
            } else {
                resolve(row ? row.value : null);
            }
        });
    });
}

/**
 * 🧠 INTERNAL ENGINE: Generic Safe Setter (STRICTLY PRIVATE)
 */
function setSetting(key, value) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Database not initialized'));
        
        if (!VALID_KEYS.has(key)) return reject(new Error(`[SETTINGS] Security Block: Unknown key injection attempted`));

        const query = `
            INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')
        `;

        db.run(query, [key, value], (err) => {
            if (err) {
                console.error(`[SETTINGS] Error setting value:`, err);
                reject(err);
            } else {
                console.log(`[SETTINGS] Key updated successfully`);
                resolve();
            }
        });
    });
}

// ============================================================================
// 🌐 PUBLIC API WRAPPERS
// ============================================================================

function getAdminWebhook() {
    return getSetting('admin_webhook');
}

function setAdminWebhook(url) {
    // 🛡️ SECURITY FIX: Enforce absolute maximum length to prevent DB bloat/DoS
    if (url && url.length > 500) {
        return Promise.reject(new Error('Webhook URL exceeds maximum allowed length'));
    }

    if (url && !isValidDiscordWebhook(url)) {
        return Promise.reject(new Error('Invalid Discord webhook URL'));
    }

    // Store empty string if url is falsy to allow clearing the webhook safely
    return setSetting('admin_webhook', url || '');
}

// Module Sealed. Internal engines are no longer exported.
module.exports = {
    initSettingsTable,
    getAdminWebhook,
    setAdminWebhook
};
