import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase credentials missing! The application cannot initialize. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables (Cloudflare Pages Dashboard).');
}

// 🛡️ Guard against crash if variables are missing
export const supabase = (supabaseUrl && supabaseAnonKey) 
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

