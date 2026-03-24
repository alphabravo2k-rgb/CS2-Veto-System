const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

let realClient = null;

if (supabaseUrl && supabaseServiceKey) {
    try {
        realClient = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });
        console.log('[SUPABASE] Infrastructure initialized successfully.');
    } catch (err) {
        console.error('[SUPABASE] Initialization error:', err.message);
    }
}

/**
 * 🛡️ SAFETY PROXY
 * If Supabase is missing, we return a proxy that prevents crashes
 * and logs clear warnings when the app tries to touch the DB.
 */
const supabase = new Proxy({}, {
    get(target, prop) {
        if (realClient) return realClient[prop];
        
        // Return a dummy 'from' that doesn't crash
        if (prop === 'from') {
            return (tableName) => {
                console.error(`🚨 [SUPABASE] Attempted to access table "${tableName}" but client is not initialized.`);
                return {
                    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'Supabase not initialized' } }), maybeSingle: () => Promise.resolve({ data: null, error: { message: 'Supabase not initialized' } }) }) }),
                    insert: () => Promise.resolve({ error: { message: 'Supabase not initialized' } }),
                    update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'Supabase not initialized' } }) }) }) }),
                    upsert: () => Promise.resolve({ error: { message: 'Supabase not initialized' } }),
                    delete: () => ({ eq: () => Promise.resolve({ error: { message: 'Supabase not initialized' } }) })
                };
            };
        }
        
        return () => {
            console.error(`🚨 [SUPABASE] Attempted to call "${prop}" but client is not initialized.`);
            return Promise.resolve({ data: null, error: { message: 'Supabase not initialized' } });
        };
    }
});

module.exports = supabase;
