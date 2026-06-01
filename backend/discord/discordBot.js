// /discord/discordBot.js
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { redis } = require('../src/shards/redisClient');

const {
    DISCORD_TOKEN,
    DISCORD_STATUS_CHANNEL_ID,
    DISCORD_REPORT_CHANNEL_ID,
} = process.env;

if (!DISCORD_TOKEN) {
    console.warn('[DiscordBot] ⚠️ DISCORD_TOKEN manquant — bot désactivé.');
}

function statusEmoji(s) {
    switch ((s || '').toLowerCase()) {
        case 'ok': return '🟢';
        case 'booting': return '🟡';
        case 'unknown': return '⚪';
        default: return '🔘';
    }
}

/**
 * Construit les embeds "Shard Status".
 * @param {{ status: 'ok', totalShards: number, shards: Record<string,{status,port,uptime,lastActivity,latencyMs}> }} snapshot
 */
function buildStatusEmbeds(snapshot) {
    const shards = Object.entries(snapshot.shards || {}).sort(([a], [b]) => a.localeCompare(b));

    const header = new EmbedBuilder()
        .setTitle('Shard Status')
        .setDescription(`**Total:** ${snapshot.totalShards} • **Dernière mise à jour:** <t:${Math.floor(Date.now()/1000)}:R>`)
        .setColor(0x2b6cb0);

    const embeds = [header];

    // Discord limite à 25 champs par embed → on segmente si besoin
    const chunkSize = 25;
    for (let i = 0; i < shards.length; i += chunkSize) {
        const chunk = shards.slice(i, i + chunkSize);
        const e = new EmbedBuilder().setColor(0x2b6cb0);
        for (const [name, info] of chunk) {
            const lastMs = info.lastActivity && !isNaN(Date.parse(info.lastActivity))
                ? Math.floor(new Date(info.lastActivity).getTime() / 1000)
                : null;

            e.addFields({
                name: `${statusEmoji(info.status)} ${name}`,
                value: [
                    `• **Uptime:** ${info.uptime}`,
                    `• **Latency:** ${info.latencyMs} ms`,
                    `• **Last:** ${lastMs ? `<t:${lastMs}:R>` : '?'}`
                ].join('\n'),
                inline: true,
            });
        }
        embeds.push(e);
    }

    return embeds;
}

/**
 * Boot le bot, puis met à jour/édite le message toutes les minutes.
 * @param {() => Promise<any>} getStatusFn - callback master qui renvoie l'obj de /healthz (détaillé).
 */
function startDiscordBot({ getStatusFn, onReady }) {
    if (!DISCORD_TOKEN || !DISCORD_STATUS_CHANNEL_ID) return null;

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent // pas strictement requis mais utile si besoin plus tard
        ],
    });

    let statusMessageId = null;
    const redisKey = `discord:status:message:${DISCORD_STATUS_CHANNEL_ID}`;

    async function updateStatusMessage() {
        try {
            const snapshot = await getStatusFn(); // fourni par master (/healthz interne)
            const channel = await client.channels.fetch(DISCORD_STATUS_CHANNEL_ID);
            if (!channel) return;

            const embeds = buildStatusEmbeds(snapshot);

            if (!statusMessageId) {
                statusMessageId = await redis.get(redisKey);
            }

            if (statusMessageId) {
                // edit si possible
                try {
                    const msg = await channel.messages.fetch(statusMessageId);
                    await msg.edit({ content: '📊 **Shard Status** (auto-refresh / 60s)', embeds });
                    return;
                } catch {
                    // si l’edit échoue (purge, permissions, etc.), on reposte
                }
            }

            const sent = await channel.send({ content: '📊 **Shard Status** (auto-refresh / 60s)', embeds });
            statusMessageId = sent.id;
            await redis.set(redisKey, statusMessageId);
        } catch (e) {
            console.error('[DiscordBot] updateStatusMessage error:', e?.message || e);
        }
    }

    client.once('ready', async () => {
        console.log(`[DiscordBot] ✅ Connecté en tant que ${client.user.tag}`);
        try { await updateStatusMessage(); } catch {}
        setInterval(updateStatusMessage, 60_000);
        onReady && onReady({ updateStatusMessage });
    });

    client.login(DISCORD_TOKEN).catch(err => {
        console.error('[DiscordBot] ❌ login error:', err?.message || err);
    });

    // expose un helper de report
    async function sendReport({ title = 'Report', category = 'INFO', fields = [], description, color = 0xdb2777 }) {
        const channelId = DISCORD_REPORT_CHANNEL_ID || DISCORD_STATUS_CHANNEL_ID;
        const channel = await client.channels.fetch(channelId);
        if (!channel) throw new Error('Report channel introuvable');

        const embed = new EmbedBuilder()
            .setTitle(`[${category}] ${title}`)
            .setColor(color)
            .setTimestamp(new Date());

        if (description) embed.setDescription(description);
        if (Array.isArray(fields) && fields.length) {
            embed.addFields(fields.map(f => ({
                name: f.name?.toString().slice(0, 256) || 'Field',
                value: f.value?.toString().slice(0, 1024) || '-',
                inline: !!f.inline
            })));
        }

        const sent = await channel.send({ embeds: [embed] });
        return { messageId: sent.id, channelId };
    }

    return {
        sendReport,
        updateStatusMessage,
        client,
    };
}

module.exports = { startDiscordBot };
