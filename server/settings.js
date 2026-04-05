/**
 * ⚡ VETO.GG — SETTINGS PERSISTENCE (SUPABASE NATIVE)
 * =============================================================================
 * Responsibility: Stores global server configurations in Supabase.
 * =============================================================================
 */

'use strict';

const { isValidDiscordWebhook } = require('./discord-webhook');
const supabase = require('./infra/supabase');

// 🛡️ SECURITY FIX: Enumerate valid keys
const VALID_KEYS = new Set(['admin_webhook', 'maintenance_mode']);

async function getAdminWebhook() {
    try {
        const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'admin_webhook')
            .maybeSingle();
            
        if (error) throw error;
        return data ? data.value : null;
    } catch (err) {
        console.error('[SETTINGS] Error getting admin_webhook:', err.message);
        return null;
    }
}

async function setAdminWebhook(url) {
    if (url && url.length > 500) {
        throw new Error('Webhook URL exceeds maximum allowed length');
    }

    if (url && !isValidDiscordWebhook(url)) {
        throw new Error('Invalid Discord webhook URL');
    }

    const { error } = await supabase
        .from('settings')
        .upsert({ 
            key: 'admin_webhook', 
            value: url || '', 
            updated_at: new Date().toISOString() 
        }, { onConflict: 'key' });

    if (error) {
        console.error('[SETTINGS] Error setting admin_webhook:', error.message);
        throw new Error('Failed to update settings');
    }
}

// Placeholder for future initialization if needed, but Supabase handles schema via migrations
async function initSettingsTable() {
    return Promise.resolve();
}

module.exports = {
    initSettingsTable,
    getAdminWebhook,
    setAdminWebhook
};
