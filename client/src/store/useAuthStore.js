/**
 * ⚡ COMP-OS — AUTH STORE (SERVERLESS PIVOT)
 * =============================================================================
 * Responsibility: Supabase Native Authentication & Session Management
 * LAYER         : Client Data Layer (Zustand)
 * VERSION       : v5.0.0 (Serverless Native)
 * =============================================================================
 */

import { create } from 'zustand';
import { supabase } from '../utils/supabase.js';

const useAuthStore = create((set, get) => ({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    loading: true,

    /** Restore session & track state changes */
    initialize: async () => {
        // 1. Check existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            set({ 
                user: session.user, 
                accessToken: session.access_token, 
                isAuthenticated: true 
            });
        }

        // 2. Subscribe to auth changes
        supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                set({ 
                    user: session.user, 
                    accessToken: session.access_token, 
                    isAuthenticated: true, 
                    loading: false 
                });
            } else {
                set({ 
                    user: null, 
                    accessToken: null, 
                    isAuthenticated: false, 
                    loading: false 
                });
            }
        });

        set({ loading: false });
    },

    login: async ({ email, password }) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;
        set({ user: data.user, accessToken: data.session?.access_token, isAuthenticated: true });
        return data.user;
    },

    register: async ({ email, password, username, dob }) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username,
                    dob,
                    display_name: username, // Sync for custom profile trigger
                },
            },
        });

        if (error) throw error;
        set({ user: data.user, accessToken: data.session?.access_token, isAuthenticated: !!data.session });
        return data.user;
    },

    logout: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) console.error('[AUTH] Sign out error:', error.message);
        set({ user: null, accessToken: null, isAuthenticated: false });
    },

    /** Compatibility helper for auth-gated API calls */
    authFetch: async (url, options = {}) => {
        // Since we are moving to Supabase, most fetches will use the supabase client.
        // This remains for legacy support or calling custom Edge Functions manually.
        const { data: { session } } = await supabase.auth.getSession();
        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${session?.access_token}`,
        };
        return fetch(url, { ...options, headers });
    },
}));

export default useAuthStore;
