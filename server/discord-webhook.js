// File: discord-webhook.js
/**
 * ⚡ COMP-OS — DISCORD INTEGRATION KERNEL
 * =============================================================================
 * FILE          : discord-webhook.js
 * RESPONSIBILITY: Secure outbound notifications to Discord API
 * LAYER         : Backend / External Integrations
 * RISK LEVEL    : MEDIUM
 * =============================================================================
 *
 * RELEASE METADATA
 * -----------------------------------------------------------------------------
 * VERSION       : v2.1.0 (LIVE-ACTION-READY)
 * STATUS        : ENFORCED
 *
 * FEATURES:
 * - Event Routing: Supports granular play-by-play logs in Discord.
 * - Outbound Resilience: 5000ms hard timeout to prevent thread hanging.
 * - Payload Caps: Enforces Discord's strict 1024 character limit on embeds.
 * - Memory Safety: Rejects upstream responses larger than 10KB.
 * =============================================================================
 */

const https = require('https');
const { URL } = require('url');

/**
 * Send a Discord webhook notification
 * @param {string} webhookUrl - Discord webhook URL
 * @param {object} match - Match data
 * @param {string} eventType - Event type (ban/pick/side/ready/coin_flip/match_created/match_complete)
 * @param {object} data - Additional event data
 */
async function sendDiscordNotification(webhookUrl, match, eventType, data = {}) {
    if (!webhookUrl || !isValidDiscordWebhook(webhookUrl)) {
        return; // Silently abort invalid hooks
    }

    let embed;

    try {
        // 🛡️ API CONTRACT FULFILLED: Dynamically route the exact event type to its specific formatter
        if (eventType === 'match_complete') {
            embed = formatMatchCompleteMessage(match);
        } else if (eventType === 'match_created') {
            embed = formatMatchCreatedMessage(match);
        } else if (['ban', 'pick', 'side', 'coin_flip'].includes(eventType)) {
            embed = formatLiveActionMessage(match, eventType, data);
        } else {
            return; // Ignore unhandled events like 'ready' to prevent spam
        }

        await sendWebhookRequest(webhookUrl, { embeds: [embed] });
        console.log(`[WEBHOOK] ${eventType.toUpperCase()} notification sent successfully.`);
    } catch (error) {
        console.error('[WEBHOOK] Error sending notification:', error.message);
    }
}

/**
 * Test webhook connectivity
 */
async function testWebhook(webhookUrl) {
    if (!isValidDiscordWebhook(webhookUrl)) {
        throw new Error('Invalid Discord webhook URL format');
    }

    const embed = {
        title: '✅ Webhook Test Successful',
        description: 'Your Discord webhook is properly configured and working!',
        color: 0x00ff00, // Green
        timestamp: new Date().toISOString(),
        footer: { text: 'CS2 Map Veto Bot' }
    };

    await sendWebhookRequest(webhookUrl, { embeds: [embed] });
}

/**
 * Validate Discord webhook URL format (SSRF Defense Layer 1)
 */
function isValidDiscordWebhook(url) {
    if (!url || typeof url !== 'string') return false;

    try {
        const parsed = new URL(url);
        // Strict hostname validation to prevent Server-Side Request Forgery
        return (parsed.hostname === 'discord.com' || parsed.hostname === 'discordapp.com') &&
            parsed.pathname.startsWith('/api/webhooks/');
    } catch {
        return false;
    }
}

/**
 * Send HTTPS request to Discord webhook
 */
function sendWebhookRequest(webhookUrl, payload) {
    return new Promise((resolve, reject) => {
        const url = new URL(webhookUrl);
        const data = JSON.stringify(payload);

        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
                // 🛡️ SCALABILITY & OOM FIX: Hard cap response to 10KB to prevent memory exhaustion attacks
                if (responseData.length > 10000) {
                    req.destroy(new Error('Response body too large'));
                }
            });

            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve();
                } else {
                    reject(new Error(`Webhook request failed with status ${res.statusCode}: ${responseData}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        // 🛡️ RELIABILITY FIX: Prevent indefinite hangs if Discord API is unresponsive
        req.setTimeout(5000, () => {
            req.destroy(new Error('Webhook request timeout'));
        });

        req.write(data);
        req.end();
    });
}

// --- FORMATTERS ---

function formatMatchCompleteMessage(match) {
    // 🛡️ CRITICAL FIX: Discord has a hard 1024 character limit for field values.
    // Truncate logs if they get too long to prevent silent 400 Bad Request drops.
    let vetoLogs = match.logs.join('\n') || 'No veto actions recorded';
    if (vetoLogs.length > 950) {
        vetoLogs = vetoLogs.substring(0, 950) + '\n... (truncated)';
    }

    return {
        title: '🏁 CS2 Map Veto Complete',
        description: `**${match.teamA}** vs **${match.teamB}**`,
        color: 0x00d4ff, // Neon Blue
        fields: [
            { name: 'Format', value: match.format.toUpperCase(), inline: true },
            { name: 'Match ID', value: match.id, inline: true },
            { name: '📋 Veto Summary', value: `\`\`\`\n${vetoLogs}\n\`\`\``, inline: false }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'CS2 Map Veto Bot' }
    };
}

function formatMatchCreatedMessage(match) {
    return {
        title: '🎮 New Veto Room Created',
        description: `**${match.teamA}** vs **${match.teamB}**`,
        color: 0x888888, // Gray
        fields: [
            { name: 'Format', value: match.format.toUpperCase(), inline: true },
            { name: 'Timer', value: match.useTimer ? `${match.timerDuration}s` : 'Disabled', inline: true }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'CS2 Map Veto Bot' }
    };
}

function formatLiveActionMessage(match, eventType, data) {
    let title, description, color;

    switch (eventType) {
        case 'ban':
            title = '🚫 Map Banned';
            description = `**${data.team}** banned **${data.mapName}**`;
            color = 0xff4444; // Red
            break;
        case 'pick':
            title = '✅ Map Picked';
            description = `**${data.team}** picked **${data.mapName}**`;
            color = 0x00ff00; // Green
            break;
        case 'side':
            title = '🛡️ Side Selected';
            description = `**${data.team}** chose **${data.side}** side on **${data.mapName}**`;
            color = 0x4facfe; // Light Blue
            break;
        case 'coin_flip':
            title = '🪙 Coin Toss';
            description = `Result: **${data.result.toUpperCase()}**\nWinner: **${data.winner}**`;
            color = 0xffd700; // Gold
            break;
    }

    return {
        title,
        description,
        color,
        timestamp: new Date().toISOString(),
        footer: { text: `Match: ${match.teamA} vs ${match.teamB}` }
    };
}

module.exports = {
    sendDiscordNotification,
    testWebhook,
    isValidDiscordWebhook
};
