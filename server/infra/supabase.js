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
 * 🛡️ RECURSIVE SAFETY PROXY
 * If Supabase is missing, we return a recursive proxy that prevents crashes
 * on deeply nested objects (like .auth.admin.createUser) and logs clear
 * warnings when the app tries to touch the DB.
 */
const createSafetyProxy = (path = 'supabase') => {
    // Function target allows the proxy to be callable (e.g. supabase.from())
    const proxyTarget = () => {};
    
    return new Proxy(proxyTarget, {
        get(target, prop) {
            if (realClient && path === 'supabase') return realClient[prop];
            return createSafetyProxy(`${path}.${String(prop)}`);
        },
        apply(target, thisArg, args) {
            console.error(`🚨 [SUPABASE] Attempted to call "${path}()" but client is not initialized. Check your environment variables (SUPABASE_URL, SUPABASE_SERVICE_KEY).`);
            return {
                // Return a dummy promise that resolves to an error object to prevent await crashes
                then: (resolve) => resolve({ data: null, error: { message: `Supabase not initialized: ${path}` } }),
                // Mock common chainable methods
                select: () => createSafetyProxy(`${path}.select`),
                eq: () => createSafetyProxy(`${path}.eq`),
                single: () => createSafetyProxy(`${path}.single`),
                maybeSingle: () => createSafetyProxy(`${path}.maybeSingle`),
                insert: () => createSafetyProxy(`${path}.insert`),
                update: () => createSafetyProxy(`${path}.update`),
                upsert: () => createSafetyProxy(`${path}.upsert`),
                delete: () => createSafetyProxy(`${path}.delete`),
            };
        }
    });
};

const supabase = createSafetyProxy();

module.exports = supabase;
