import React from 'react';
import { render } from '@testing-library/react';
import App from './App';

describe('Security: Client URL Token Scrubbing', () => {
    beforeEach(() => {
        // Clear storage before each test
        sessionStorage.clear();
    });

    test('URL key is removed from address bar and stored securely in session', () => {
        // 1. Setup a fake compromised URL simulating a user clicking an invite link
        window.history.pushState({}, '', '/?room=match123&key=secret_admin_token');
        
        // 2. Render the app (this triggers your getParams() logic)
        render(<App />);

        // 3. Verify the URL was successfully scrubbed (Competitive Integrity Guard)
        expect(window.location.search).toBe('?room=match123');
        expect(window.location.search).not.toContain('key=');

        // 4. Verify Session Storage safely caught the key
        expect(sessionStorage.getItem('lot_key_match123')).toBe('secret_admin_token');
    });
});
