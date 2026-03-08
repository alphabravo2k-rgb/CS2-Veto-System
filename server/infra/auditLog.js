/**
 * ⚡ INFRA LAYER — AUDIT LOG
 * =============================================================================
 * PROBLEM (Architecture Flaw + Security): The original system had no audit
 * trail. Admin actions (reset, delete, undo) had no accountability record.
 * In a multi-tenant platform this is a compliance and dispute-resolution gap.
 *
 * FIX: All privileged actions write a row to audit_logs. Non-blocking
 * (errors are logged but never crash the main request).
 * =============================================================================
 */

const db = require('./database');

/**
 * Write an audit event. Fire-and-forget — never throws.
 * @param {object} opts
 * @param {string} opts.actor_id   - User ID (or 'system' / 'admin')
 * @param {string} opts.action     - e.g. 'match.reset', 'user.suspend'
 * @param {string} [opts.target_id] - Affected resource ID
 * @param {object} [opts.meta]     - Additional JSON context
 */
async function log({ actor_id, action, target_id = null, meta = {} }) {
    try {
        await db.run(
            `INSERT INTO audit_logs (actor_id, action, target_id, meta, created_at)
             VALUES (?, ?, ?, ?, datetime('now'))`,
            [actor_id, action, target_id, JSON.stringify(meta)]
        );
    } catch (err) {
        // Audit failures must never crash the system
        console.error('[AUDIT] Failed to write audit log:', err.message, { action, actor_id });
    }
}

module.exports = { log };
