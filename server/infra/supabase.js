const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// 🔍 STARTUP DIAGNOSTICS
console.log('[DEBUG] SUPABASE_URL detected:', !!supabaseUrl);
console.log('[DEBUG] SUPABASE_SERVICE_KEY detected:', !!supabaseServiceKey);
if (supabaseServiceKey?.startsWith('eyJ')) {
    console.log('[DEBUG] SUPABASE_SERVICE_KEY format: Valid JWT.');
} else if (supabaseServiceKey) {
    console.warn('[DEBUG] WARNING: SUPABASE_SERVICE_KEY does not look like a standard Supabase JWT.');
}

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
 * 🔒 WRAP AUTH
 * Ensures that if a client is initialized with an 'anon' key, 
 * accessing .auth.admin doesn't crash the entire process.
 */
function wrapAuth(authClient) {
    if (authClient && authClient.admin) return authClient;
    
    return new Proxy(authClient || {}, {
        get(target, prop) {
            if (prop === 'admin') {
                console.error("🚨 [SUPABASE] CRITICAL: Attempted to access 'auth.admin' but it is missing. This usually means you are using the 'anon' key instead of the 'service_role' key.");
                return createSafetyProxy('supabase.auth.admin');
            }
            return target[prop];
        }
    });
}

/**
 * 🛡️ RECURSIVE SAFETY PROXY
 * If Supabase is missing or partially initialized, we return a recursive 
 * proxy that prevents crashes on deeply nested objects and logs warnings.
 */
function createSafetyProxy(path = 'supabase') {
    const proxyTarget = () => {};
    
    return new Proxy(proxyTarget, {
        get(target, prop) {
            if (realClient && path === 'supabase') {
                const val = realClient[prop];
                if (val !== undefined) {
                    if (prop === 'auth') return wrapAuth(val);
                    return val;
                }
            }
            return createSafetyProxy(`${path}.${String(prop)}`);
        },
        apply(target, thisArg, args) {
            console.error(`🚨 [SUPABASE] Attempted to call "${path}()" but client is incorrectly initialized. Check SUPABASE_URL and SUPABASE_SERVICE_KEY.`);
            return {
                then: (resolve) => resolve({ data: null, error: { message: `Supabase not initialized: ${path}` } }),
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
}

const supabase = createSafetyProxy();

module.exports = supabase;
