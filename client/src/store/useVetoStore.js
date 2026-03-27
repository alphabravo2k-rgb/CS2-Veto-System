/**
 * ⚡ COMP-OS — GLOBAL VETO STORE
 * =============================================================================
 * FILE          : useVetoStore.js
 * RESPONSIBILITY: Decoupled WebSocket engine and Global State Management
 * LAYER         : Client Data Layer (Zustand)
 * RISK LEVEL    : SECURE (Auditor Hardened)
 * =============================================================================
 */

import { create } from 'zustand';
import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ? import.meta.env.VITE_SOCKET_URL.replace(/\/$/, '') : (window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin);

const useVetoStore = create((set, get) => ({
    _socket: null, 
    gameState: null,
    myRole: null,
    serverError: null,
    roomUserCount: 0,
    isConnected: false,

    connectToRoom: (matchId, key) => {
        const existingSocket = get()._socket;
        if (existingSocket) {
            existingSocket.removeAllListeners();
            existingSocket.disconnect();
        }

        const socket = io(SOCKET_URL, { autoConnect: true });

        socket.on('connect', () => {
            set({ isConnected: true });
            socket.emit('join_room', { roomId: matchId, key });
        });

        socket.on('disconnect', () => {
            set({ isConnected: false });
        });

        socket.on('update_state', (data) => set({ gameState: data }));
        socket.on('role_assigned', (role) => set({ myRole: role }));
        socket.on('room_user_count', ({ count }) => set({ roomUserCount: count }));
        
        socket.on('error', (msg) => {
            set({ serverError: msg });
            setTimeout(() => set({ serverError: null }), 4000);
        });

        set({ _socket: socket });
    },

    disconnectRoom: () => {
        const socket = get()._socket;
        if (socket) {
            socket.removeAllListeners();
            socket.disconnect();
        }
        set({ _socket: null, isConnected: false, gameState: null, myRole: null, roomUserCount: 0 });
    },

    // 🛡️ ARCHITECTURE FIX: Temporary/Reused socket specifically for Match Creation
    createMatch: (payload, onSuccess) => {
        let socket = get()._socket;
        let ownSocket = false;

        if (!socket || !get().isConnected) {
            socket = io(SOCKET_URL, { autoConnect: true });
            ownSocket = true;
        }

        // 🛡️ RELIABILITY FIX: Prevent infinite loading if server drops the request
        let creationTimeout;

        const handleError = (msg) => {
            clearTimeout(creationTimeout);
            set({ serverError: msg });
            setTimeout(() => set({ serverError: null }), 4000);
            
            if (ownSocket) {
                socket.removeAllListeners();
                socket.disconnect();
            }
        };

        const handleCreated = (response) => {
            clearTimeout(creationTimeout);
            if (onSuccess) onSuccess(response);
            set({ serverError: null });
            
            if (ownSocket) {
                socket.removeAllListeners();
                socket.disconnect();
            }
        };

        creationTimeout = setTimeout(() => {
            handleError('Match creation timed out. Server may be unreachable.');
        }, 10000);

        if (ownSocket) {
            socket.once('connect', () => {
                socket.emit('create_match', payload);
            });
        } else {
            socket.emit('create_match', payload);
        }

        socket.once('match_created', handleCreated);
        socket.once('error', handleError);
    },

    sendAction: (matchId, actionData, key) => {
        get()._socket?.emit('action', { roomId: matchId, data: actionData, key });
    },
    
    sendReady: (matchId, key) => {
        get()._socket?.emit('team_ready', { roomId: matchId, key });
    },

    sendCoinCall: (matchId, call, key) => {
        get()._socket?.emit('coin_call', { roomId: matchId, call, key });
    },

    sendCoinDecide: (matchId, decision, key) => {
        get()._socket?.emit('coin_decision', { roomId: matchId, decision, key });
    }
}));

export default useVetoStore;
