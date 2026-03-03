const { isValidDiscordWebhook } = require('./discord-webhook');

describe('Security: SSRF Webhook Guards', () => {
    test('ACCEPTS valid discord.com webhook', () => {
        expect(isValidDiscordWebhook('https://discord.com/api/webhooks/123456789/abcdefg')).toBe(true);
    });

    test('ACCEPTS valid legacy discordapp.com webhook', () => {
        expect(isValidDiscordWebhook('https://discordapp.com/api/webhooks/123456789/abcdefg')).toBe(true);
    });

    test('REJECTS internal IP addresses (AWS Metadata Attack)', () => {
        expect(isValidDiscordWebhook('https://169.254.169.254/latest/meta-data/')).toBe(false);
    });

    test('REJECTS localhost payloads', () => {
        expect(isValidDiscordWebhook('http://localhost:3000/webhook')).toBe(false);
        expect(isValidDiscordWebhook('http://127.0.0.1:3000/webhook')).toBe(false);
    });

    test('REJECTS malicious external domains', () => {
        expect(isValidDiscordWebhook('https://evil.com/api/webhooks/123/token')).toBe(false);
    });

    test('REJECTS valid domain but missing webhook path', () => {
        expect(isValidDiscordWebhook('https://discord.com/api/other/123/token')).toBe(false);
    });

    test('REJECTS non-string payloads (Object Coercion Defense)', () => {
        expect(isValidDiscordWebhook(null)).toBe(false);
        expect(isValidDiscordWebhook(undefined)).toBe(false);
        expect(isValidDiscordWebhook({ url: 'https://discord.com/api/webhooks/' })).toBe(false);
    });

    test('REJECTS empty string', () => {
        expect(isValidDiscordWebhook('')).toBe(false);
    });
});
