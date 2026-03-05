/**
 * ⚡ COMP-OS — GLOBAL VETO STORE
 * =============================================================================
 * FILE          : useVetoStore.js
 * RESPONSIBILITY: Decoupled WebSocket engine and Global State Management
 * LAYER         : Client Data Layer (Zustand)
 * =============================================================================
 */

import { create } from 'zustand';
import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin);
const socket = io(SOCKET_URL, { autoConnect: false });

const useVetoStore = create((set, get) => ({
    gameState: null,
    myRole: null,
    serverError: null,
    roomUserCount: 0,
    isConnected: false,

    connectToRoom: (matchId, key) => {
        if (!get().isConnected) {
            socket.connect();
            set({ isConnected: true });
        }
        
        // Remove old listeners to prevent duplication on re-renders
        socket.off('update_state');
        socket.off('role_assigned');
        socket.off('room_user_count');
        socket.off('error');

        socket.emit('join_room', { roomId: matchId, key });

        socket.on('update_state', (data) => set({ gameState: data }));
        socket.on('role_assigned', (role) => set({ myRole: role }));
        socket.on('room_user_count', ({ count }) => set({ roomUserCount: count }));
        socket.on('error', (msg) => {
            set({ serverError: msg });
            setTimeout(() => set({ serverError: null }), 4000);
        });
    },

    disconnectRoom: () => {
        socket.disconnect();
        set({ isConnected: false, gameState: null, myRole: null });
    },

    sendAction: (matchId, actionData, key) => {
        socket.emit('action', { roomId: matchId, data: actionData, key });
    },
    
    sendReady: (matchId, key) => {
        socket.emit('team_ready', { roomId: matchId, key });
    },

    sendCoinCall: (matchId, call, key) => {
        socket.emit('coin_call', { roomId: matchId, call, key });
    },

    sendCoinDecide: (matchId, decision, key) => {
        socket.emit('coin_decision', { roomId: matchId, decision, key });
    }
}));

export default useVetoStore;
