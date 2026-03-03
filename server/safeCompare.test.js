const { safeCompare } = require('./server');

describe('Security: Constant-Time safeCompare', () => {
    test('Returns true for identical strings', () => {
        expect(safeCompare('super_secret_admin_key_123', 'super_secret_admin_key_123')).toBe(true);
    });

    test('Returns false for completely different strings', () => {
        expect(safeCompare('super_secret_admin_key_123', 'hacker_guessed_key_999')).toBe(false);
    });

    test('Returns false for strings of different lengths (Early exit)', () => {
        // Prevents basic length-based timing leaks
        expect(safeCompare('secret', 'secret1')).toBe(false);
    });

    test('Returns false for identical prefix but different suffix', () => {
        // This is where standard `===` fails timing attacks
        expect(safeCompare('admin_token_A', 'admin_token_B')).toBe(false);
    });

    test('Returns false if first argument is null', () => {
        expect(safeCompare(null, 'secret')).toBe(false);
    });

    test('Returns false if second argument is null', () => {
        expect(safeCompare('secret', null)).toBe(false);
    });

    test('Returns false if arguments are undefined', () => {
        expect(safeCompare(undefined, undefined)).toBe(false);
    });

    test('Returns false if arguments are numbers', () => {
        // Enforces string-only comparison to prevent type coercion attacks
        expect(safeCompare(12345, 12345)).toBe(false);
    });

    test('Returns false if arguments are objects (Prototype Poisoning Defense)', () => {
        expect(safeCompare({ key: 'secret' }, { key: 'secret' })).toBe(false);
    });

    test('Returns false for empty strings (Zero-length Buffer Defense)', () => {
        // crypto.timingSafeEqual returns true for two 0-byte buffers. This must be caught!
        expect(safeCompare('', '')).toBe(false);
        expect(safeCompare('', 'secret')).toBe(false);
    });
});s
