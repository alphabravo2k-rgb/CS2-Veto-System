/**
 * ⚡ VETO.GG — GLOBAL VETO STORE (SERVERLESS PIVOT)
 * =============================================================================
 * RESPONSIBILITY: Supabase Realtime & Edge Functions Orchestration
 * LAYER         : Client Data Layer (Zustand)
 * VERSION       : v5.0.0 (Serverless Native)
 * =============================================================================
 */

import { create } from 'zustand';
import { supabase } from '../utils/supabase.js';

const normalizeState = (db) => {
    if (!db) return null;
    return {
        ...db,
        teamA: db.team_a,
        teamB: db.team_b,
        teamALogo: db.team_a_logo,
        teamBLogo: db.team_b_logo,
        useTimer: db.use_timer,
        timerDuration: db.timer_duration,
        useCoinFlip: db.use_coin_flip,
        coinFlip: db.coin_flip,
        lastPickedMap: db.last_picked_map,
        playedMaps: db.played_maps,
        timerEndsAt: db.timer_ends_at,
    };
};

const useVetoStore = create((set, get) => ({
    _channel: null, 
    gameState: null,
    myRole: null,
    serverError: null,
    roomUserCount: 0,
    isConnected: false,
    isDisconnected: false,

    connectToRoom: async (matchId, key) => {
        // 1. Cleanup existing channel
        const existingChannel = get()._channel;
        if (existingChannel) {
            existingChannel.unsubscribe();
        }

        // 2. Initial State Fetch (Important for fast first-render)
        const { data: initialData, error: fetchError } = await supabase
            .from('veto_sessions')
            .select('*')
            .eq('id', matchId)
            .single();

        if (fetchError) {
            set({ serverError: 'Match not found or signal lost.' });
            return;
        }

        const normalizedInitial = normalizeState(initialData);
        set({ gameState: normalizedInitial, isConnected: true });

        // 2.1 Fetch Branding
        if (initialData.org_id) {
            const { data: orgData } = await supabase
                .from('organizations')
                .select('branding')
                .eq('id', initialData.org_id)
                .single();
            if (orgData) set({ branding: orgData.branding });
        }

        // 3. Authorization (Local check for role)
        const keys = initialData.keys_data || {};
        let role = 'viewer';
        if (key === keys.admin) role = 'admin';
        else if (key === keys.A) role = 'A';
        else if (key === keys.B) role = 'B';
        set({ myRole: role });

        // 4. Set up Realtime Subscription
        const channel = supabase.channel(`match:${matchId}`, {
            config: {
                presence: { key: role || 'viewer' }
            }
        })
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                let activeCount = 0;
                for (const id in state) {
                    activeCount += state[id].length;
                }
                set({ roomUserCount: activeCount });
            })
            .on(
                'postgres_changes', 
                { event: 'UPDATE', schema: 'public', table: 'veto_sessions', filter: `id=eq.${matchId}` },
                (payload) => {
                    set({ gameState: normalizeState(payload.new) });
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    channel.track({ online_at: new Date().toISOString() });
                    set({ isConnected: true, isDisconnected: false });
                }
                if (status === 'CLOSED' || status === 'TIMED_OUT') {
                    set({ isConnected: false, isDisconnected: true });
                }
                if (status === 'CHANNEL_ERROR') {
                    console.error('[REALTIME] Channel error. Retrying in 2s...');
                    setTimeout(() => get().connectToRoom(matchId, key), 2000);
                }
            });

        set({ _channel: channel });
    },

    disconnectRoom: () => {
        const channel = get()._channel;
        if (channel) channel.unsubscribe();
        set({ _channel: null, isConnected: false, gameState: null, myRole: null, roomUserCount: 0 });
    },

    /** Call Supabase Edge Function to Create Match */
    createMatch: async (payload, onSuccess) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const { data, error } = await supabase.functions.invoke('create-match', {
                body: payload,
                headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
            });

            if (error) throw error;
            if (onSuccess) onSuccess(data);
        } catch (err) {
            set({ serverError: err.message });
            setTimeout(() => set({ serverError: null }), 4000);
        }
    },

    /** Send Veto Action via Edge Function (The "Brain") */
    sendAction: async (matchId, actionString, actionData, key) => {
        const { data: { session } } = await supabase.auth.getSession();
        const { error } = await supabase.functions.invoke('veto-action', {
            body: { matchId, action: actionString, data: actionData, key },
            headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
        });
        if (error) set({ serverError: error.message });
    },

    /** Specific Action Wrappers */
    sendReady: async (matchId, key) => {
        const { data: { session } } = await supabase.auth.getSession();
        const { error } = await supabase.functions.invoke('veto-action', {
            body: { matchId, action: 'ready', key },
            headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
        });
        if (error) set({ serverError: error.message });
    },

    sendCoinCall: async (matchId, call, key) => {
        const { data: { session } } = await supabase.auth.getSession();
        const { error } = await supabase.functions.invoke('veto-action', {
            body: { matchId, action: 'coin_call', data: { call }, key },
            headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
        });
        if (error) set({ serverError: error.message });
    },

    sendCoinDecide: async (matchId, decision, key) => {
        const { data: { session } } = await supabase.auth.getSession();
        const { error } = await supabase.functions.invoke('veto-action', {
            body: { matchId, action: 'coin_decision', data: { decision }, key },
            headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
        });
        if (error) set({ serverError: error.message });
    },

    reportResult: async (matchId, scoreA, scoreB, winnerId, key) => {
        const { data: { session } } = await supabase.auth.getSession();
        const { error } = await supabase.functions.invoke('report-result', {
            body: { matchId, scoreA, scoreB, winnerId, key },
            headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
        });
        if (error) set({ serverError: error.message });
        return !error;
    }
}));

export default useVetoStore;
