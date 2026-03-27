/**
 * Zustand auth store — manages JWT access token, user identity, and refresh logic.
 * Access token lives in memory only (no localStorage). Refresh token in localStorage.
 */

import { create } from 'zustand';

const API = import.meta.env.VITE_SOCKET_URL ? import.meta.env.VITE_SOCKET_URL.replace(/\/$/, '') : (window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin);

const useAuthStore = create((set, get) => ({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: true,

    /** Restore session on app load */
    initialize: async () => {
        const savedToken = localStorage.getItem('refreshToken');
        if (!savedToken) {
            set({ isLoading: false });
            return;
        }
        try {
            await get().refreshToken();
        } catch {
            localStorage.removeItem('refreshToken');
            set({ user: null, accessToken: null, isAuthenticated: false });
        }
        set({ isLoading: false });
    },

    login: async ({ email, password }) => {
        const res = await fetch(`${API}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');

        localStorage.setItem('refreshToken', data.refreshToken);
        set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true });
        return data.user;
    },

    register: async (payload) => {
        const res = await fetch(`${API}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');

        localStorage.setItem('refreshToken', data.refreshToken);
        set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true });
        return data.user;
    },

    logout: async () => {
        const token = localStorage.getItem('refreshToken');
        const { accessToken } = get();
        try {
            await fetch(`${API}/api/auth/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ refreshToken: token }),
            });
        } catch { /* ignore */ }
        localStorage.removeItem('refreshToken');
        set({ user: null, accessToken: null, isAuthenticated: false });
    },

    refreshToken: async () => {
        const token = localStorage.getItem('refreshToken');
        if (!token) throw new Error('No refresh token');

        const res = await fetch(`${API}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: token }),
        });
        const data = await res.json();
        if (!res.ok) {
            localStorage.removeItem('refreshToken');
            set({ user: null, accessToken: null, isAuthenticated: false });
            throw new Error(data.error || 'Session expired');
        }
        localStorage.setItem('refreshToken', data.refreshToken);
        set({ accessToken: data.accessToken, isAuthenticated: true });
        // Fetch user profile
        const profileRes = await fetch(`${API}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${data.accessToken}` }
        });
        if (profileRes.ok) {
            const user = await profileRes.json();
            set({ user });
        }
    },

    /** Helper for authenticated API calls with automatic token refresh */
    authFetch: async (url, options = {}) => {
        const { accessToken, refreshToken: doRefresh } = get();
        const fullUrl = url.startsWith('http') ? url : `${API}${url}`;
        const res = await fetch(fullUrl, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
                'Authorization': `Bearer ${accessToken}`,
            },
        });
        if (res.status === 401) {
            try {
                await doRefresh();
                const newToken = get().accessToken;
                return fetch(fullUrl, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers,
                        'Authorization': `Bearer ${newToken}`,
                    },
                });
            } catch {
                get().logout();
                throw new Error('Session expired — please log in again');
            }
        }
        return res;
    },
}));

export default useAuthStore;
