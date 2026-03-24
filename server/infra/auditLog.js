const supabase = require('./supabase');

/**
 * ⚡ INFRA LAYER — AUDIT LOG
 * =============================================================================
 * Responsibility: Platform-wide accountability trail using Supabase.
 * =============================================================================
 */

/**
 * Write an audit event. Fire-and-forget — never throws.
 */
async function log({ actor_id, action, target_id = null, meta = {} }) {
    try {
        if (!supabase) {
            console.warn('[AUDIT] Skipping log due to missing Supabase client:', action);
            return;
        }

        // Fire and forget
        supabase.from('audit_logs').insert({
            actor_id,
            action,
            target_id,
            meta
        }).then(({ error }) => {
            if (error) console.error('[AUDIT] Failed to write audit log:', error.message, { action, actor_id });
        });
    } catch (err) {
        // Safe catch for unexpected sync errors
        console.error('[AUDIT] Unexpected audit error:', err.message);
    }
}

module.exports = { log };
