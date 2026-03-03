import React from 'react';
import { render } from '@testing-library/react';
import io from 'socket.io-client';

// 🛡️ Mock socket.io before App imports it at module level
jest.mock('socket.io-client', () => {
    const emit = jest.fn();
    const on = jest.fn();
    const off = jest.fn();
    const connect = jest.fn();
    const disconnect = jest.fn();
    const socket = { emit, on, off, connect, disconnect };
    return jest.fn(() => socket);
});

// 🛡️ Mock fetch to prevent useEffect API calls from throwing.
// NOTE: This executes after imports, which is safe here because fetch 
// is only called inside useEffect (post-render). Do not move inside beforeEach.
global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
);

import App from './App';

describe('Security: Client URL Token Scrubbing', () => {
    beforeEach(() => {
        sessionStorage.clear();
        jest.clearAllMocks();
    });

    test('URL key is removed from address bar and stored securely in session', () => {
        window.history.pushState({}, '', '/?room=match123&key=secret_admin_token');
        render(<App />);
        expect(window.location.search).toBe('?room=match123');
        expect(window.location.search).not.toContain('key=');
        expect(sessionStorage.getItem('lot_key_match123')).toBe('secret_admin_token');
    });

    test('key is NOT present in URL after scrubbing', () => {
        window.history.pushState({}, '', '/?room=abc&key=team_a_key');
        render(<App />);
        const params = new URLSearchParams(window.location.search);
        expect(params.get('key')).toBeNull();
    });

    test('subsequent visit uses sessionStorage key when URL has no key', () => {
        sessionStorage.setItem('lot_key_match123', 'stored_key');
        window.history.pushState({}, '', '/?room=match123');
        
        render(<App />);
        
        expect(sessionStorage.getItem('lot_key_match123')).toBe('stored_key');
        
        // 🛡️ SCALABILITY FIX: Retrieve the socket instance created by App.jsx without calling io() again, keeping the call history clean
        const mockSocket = io.mock.results[0].value;
        
        expect(mockSocket.emit).toHaveBeenCalledWith('join_room', {
            roomId: 'match123',
            key: 'stored_key'
        });
    });
});s
