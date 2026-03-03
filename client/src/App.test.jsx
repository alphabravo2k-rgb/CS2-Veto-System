import React from 'react';
import { render } from '@testing-library/react';

// 🛡️ Mock socket.io before App imports it at module level
jest.mock('socket.io-client', () => {
    const socket = {
        emit: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        connect: jest.fn(),
        disconnect: jest.fn(),
    };
    return jest.fn(() => socket);
});

// 🛡️ Mock fetch to prevent useEffect API calls from throwing
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
    });
});
