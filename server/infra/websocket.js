'use strict';

const supabase = require('./supabase');
const discordWebhook = require('../discord-webhook');

/**
 * ⚡ INFRASTRUCTURE LAYER — VETO WATCHDOG
 * =============================================================================
 * RESPONSIBILITY: Background timer management and analytics recording.
 * ARCHITECTURE  : Listens to Supabase Realtime 'postgres_changes' on the server.
 * This resolves the Dual Realtime conflict by making the Node server a 
 * "watchdog" that acts only when the database state changes.
 * =============================================================================
 */

const activeTimers = new Map(); // matchId -> setTimeout handle

/**
 * Initialize the Watchdog.
 */
async function initWebSocket() {
    console.log('[WATCHDOG] Initializing Veto Watchdog Engine...');

    // 1. Restore state for active matches to handle server restarts
    const { data: activeMatches, error: fetchErr } = await supabase
        .from('veto_sessions')
        .select('*')
        .eq('finished', false);

    if (fetchErr) {
        console.error('[WATCHDOG] Failed to fetch active matches:', fetchErr.message);
    } else if (activeMatches) {
        console.log(`[WATCHDOG] Restoring ${activeMatches.length} active matches...`);
        for (const match of activeMatches) {
            syncMatchState(match);
        }
    }

    // 2. Subscribe to Realtime Updates
    supabase.channel('veto_watchdog')
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'veto_sessions' }, 
            (payload) => {
                if (payload.eventType === 'DELETE') {
                    stopTimer(payload.old.id);
                    return;
                }
                syncMatchState(payload.new);
            }
        )
        .subscribe((status) => {
            console.log(`[WATCHDOG] Supabase Signal: ${status}`);
        });
}

/**
 * Synchronize local timer state with DB record.
 */
function syncMatchState(match) {
    if (match.finished) {
        stopTimer(match.id);
        recordFinalStats(match);
        return;
    }

    if (match.use_timer && match.timer_ends_at) {
        const expiresAt = new Date(match.timer_ends_at).getTime();
        const now = Date.now();
        const remaining = expiresAt - now;

        if (remaining > 0) {
            scheduleTimeout(match.id, remaining);
        } else {
            // Already expired, trigger auto-action immediately
            triggerAutoAction(match.id);
        }
    } else {
        stopTimer(match.id);
    }
}

function scheduleTimeout(matchId, durationMs) {
    stopTimer(matchId);
    const handle = setTimeout(() => {
        triggerAutoAction(matchId);
    }, durationMs);
    activeTimers.set(matchId, handle);
}

function stopTimer(matchId) {
    if (activeTimers.has(matchId)) {
        clearTimeout(activeTimers.get(matchId));
        activeTimers.delete(matchId);
    }
}

/**
 * Trigger an automated action when a timer expires.
 */
async function triggerAutoAction(matchId) {
    console.log(`[WATCHDOG] Timer expired for match ${matchId}. Triggering auto-action...`);
    try {
        const { data, error } = await supabase.functions.invoke('veto-action', {
            body: { 
                matchId, 
                action: 'timeout', 
                key: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY // Watchdog uses service role
            }
        });
        if (error) throw error;
        console.log(`[WATCHDOG] Auto-action successful for ${matchId}`);
    } catch (err) {
        console.error(`[WATCHDOG] Auto-action failed for ${matchId}:`, err.message);
    }
}

/**
 * Record analytics and notify webhooks when a match finishes.
 */
async function recordFinalStats(match) {
    try {
        // 1. Notify Webhooks
        if (match.temp_webhook_url) {
            discordWebhook.send(match.temp_webhook_url, {
                title: "VETO COMPLETE",
                description: `Match between **${match.team_a}** and **${match.team_b}** finalized.`,
                color: 0x00ff88
            });
        }
        // Stats recording is handled in the Edge Function (veto-action) 
        // to maintain single source of truth for DB writes.
    } catch (err) {
        console.error('[WATCHDOG] Finalization failed:', err.message);
    }
}

module.exports = { initWebSocket };
