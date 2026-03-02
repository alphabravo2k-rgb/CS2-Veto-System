/**
 * ⚡ COMP-OS — SETTINGS PERSISTENCE
 * =============================================================================
 * FILE          : settings.js
 * RESPONSIBILITY: Stores global server configurations in SQLite
 * LAYER         : Backend Persistence
 * RISK LEVEL    : LOW
 * =============================================================================
 *
 * RELEASE METADATA
 * -----------------------------------------------------------------------------
 * VERSION       : v2.2.0 (SEALED-ENCAPSULATION)
 * STATUS        : ENFORCED
 *
 * FEATURES:
 * - Dependency Injection: Uses the primary DB handle to prevent SQLite locking.
 * - Deep Defense: SSRF Webhook validation enforced before DB commit.
 * - Auditing: added `updated_at` timestamps for tracing configuration changes.
 * - Strict Enumeration: Hardcoded Set of allowed keys prevents DB injection bloat.
 * - Sealed Module: Internal generic setters are hidden to prevent validation bypass.
 * =============================================================================
 */

const { isValidDiscordWebhook } = require('./discord-webhook');

let db = null;

// 🛡️ SECURITY FIX: Enumerate valid keys to prevent arbitrary config injection
// If you ever need to add a new global setting, simply add its key name to this Set.
const VALID_KEYS = new Set([
    'admin_webhook'
]);

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

/**
 * 🧠 INTERNAL ENGINE: Generic Safe Getter (STRICTLY PRIVATE)
 */
function getSetting(key) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Database not initialized'));
        if (!VALID_KEYS.has(key)) return reject(new Error(`[SETTINGS] Security Block: Unknown key requested - ${key}`));

        db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
            if (err) {
                console.error(`[SETTINGS] Error getting ${key}:`, err);
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
        if (!VALID_KEYS.has(key)) return reject(new Error(`[SETTINGS] Security Block: Unknown key injection attempted - ${key}`));

        // 🛡️ MAINTAINABILITY FIX: True UPSERT with timestamp updating
        const query = `
            INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')
        `;

        db.run(query, [key, value], (err) => {
            if (err) {
                console.error(`[SETTINGS] Error setting ${key}:`, err);
                reject(err);
            } else {
                console.log(`[SETTINGS] ${key} updated successfully`);
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
    // 🛡️ SECURITY FIX: SSRF Validation enforced at the lowest storage layer
    if (url && !isValidDiscordWebhook(url)) {
        return Promise.reject(new Error('Invalid Discord webhook URL'));
    }

    // Store empty string if url is falsy to allow clearing the webhook safely
    return setSetting('admin_webhook', url || '');
}

// 🛡️ SECURITY FIX: Module Sealed. Internal engines are no longer exported.
module.exports = {
    initSettingsTable,
    getAdminWebhook,
    setAdminWebhook
};
