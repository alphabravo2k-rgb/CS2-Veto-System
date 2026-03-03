const { isValidWebhook } = require('./server');

describe('Security: SSRF Guard (isValidWebhook)', () => {
    test('ACCEPTS valid discord.com webhook', () => {
        expect(isValidWebhook('https://discord.com/api/webhooks/123/token')).toBe(true);
    });

    test('ACCEPTS valid legacy discordapp.com webhook', () => {
        expect(isValidWebhook('https://discordapp.com/api/webhooks/123/token')).toBe(true);
    });

    test('REJECTS HTTP (not HTTPS) discord URL', () => {
        // Enforces TLS encryption for external payloads
        expect(isValidWebhook('http://discord.com/api/webhooks/123/token')).toBe(false);
    });

    test('REJECTS non-discord HTTPS URL', () => {
        expect(isValidWebhook('https://hooks.slack.com/services/123')).toBe(false);
    });

    test('REJECTS internal IP (AWS Metadata Attack)', () => {
        // Prevents the server from pinging its own internal cloud metadata
        expect(isValidWebhook('https://169.254.169.254/latest/meta-data/')).toBe(false);
    });

    test('REJECTS localhost URL', () => {
        expect(isValidWebhook('http://localhost:3000/webhook')).toBe(false);
    });

    test('REJECTS URL with discord.com in path only (Domain Spoofing)', () => {
        // Hackers will try to bypass simple .includes() checks with this
        expect(isValidWebhook('https://evil.com/?r=https://discord.com/api/webhooks/')).toBe(false);
    });

    test('REJECTS discord.com subdomain spoofing', () => {
        // discord.com.evil.com starts with 'discord.com' but the path slash saves it
        expect(isValidWebhook('https://discord.com.evil.com/api/webhooks/123/token')).toBe(false);
    });

    test('REJECTS null, undefined, and numbers', () => {
        expect(isValidWebhook(null)).toBe(false);
        expect(isValidWebhook(undefined)).toBe(false);
        expect(isValidWebhook(12345)).toBe(false);
    });

    test('REJECTS objects (Prototype Poisoning Defense)', () => {
        expect(isValidWebhook({ url: 'https://discord.com/api/webhooks/123' })).toBe(false);
    });

    test('REJECTS empty string', () => {
        expect(isValidWebhook('')).toBe(false);
    });
});
