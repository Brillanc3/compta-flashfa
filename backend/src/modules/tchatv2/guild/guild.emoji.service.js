'use strict';

const crypto = require('crypto');
const sharp  = require('sharp');
const repo   = require('./guild.emoji.repository');
const { nextV2 } = require('../lib/snowflake');
const { putObject, deleteObject, publicUrl } = require('../lib/storage');

const MAX_EMOJIS    = 15;
const MAX_SIZE_BYTES = 256 * 1024;
const ALLOWED_MIME   = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

function err(msg, status) {
    return Object.assign(new Error(msg), { status });
}

async function listEmojis(guildId) {
    const emojis = await repo.list(guildId);
    return emojis.map(e => ({
        id:       String(e.id),
        name:     e.name,
        url:      publicUrl(e.imageKey),
        imageKey: e.imageKey,
    }));
}

async function createEmoji(guildId, { buffer, mimetype, name }) {
    if (!ALLOWED_MIME.includes(mimetype)) throw err('MIME not allowed (PNG/JPEG/GIF/WEBP)', 415);
    if (buffer.length > MAX_SIZE_BYTES)   throw err('Emoji exceeds 256 KB', 413);

    const trimmedName = name?.trim();
    if (!trimmedName) throw err('name required', 400);

    const uuid = crypto.randomUUID();
    const ext  = mimetype === 'image/gif' ? 'gif' : 'webp';
    const key  = `v2/guilds/${guildId}/emojis/${uuid}.${ext}`;

    let finalBuffer = buffer;
    if (mimetype !== 'image/gif') {
        finalBuffer = await sharp(buffer).webp({ quality: 90 }).toBuffer();
    }

    await putObject(key, finalBuffer, ext === 'gif' ? 'image/gif' : 'image/webp');

    let emoji;
    try {
        emoji = await repo.createWithLimit({
            id:      nextV2(),
            guildId: BigInt(guildId),
            name:    trimmedName.slice(0, 64),
            imageKey: key,
        }, MAX_EMOJIS);
    } catch (e) {
        // best-effort cleanup — don't throw storage error over the original
        try { await deleteObject(key); } catch {}
        throw e;
    }

    return { id: String(emoji.id), name: emoji.name, url: publicUrl(key), imageKey: key };
}

async function deleteEmoji(guildId, emojiId) {
    const result = await repo.remove(emojiId, guildId);
    if (result.count === 0) throw err('Unknown emoji', 404);
}

module.exports = { listEmojis, createEmoji, deleteEmoji };
