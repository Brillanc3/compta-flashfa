'use strict';

const crypto = require('crypto');
const sharp  = require('sharp');
const { prisma } = require('../../../shards/database');
const { redis }  = require('../../../shards/redisClient');
const { nextV2 } = require('../lib/snowflake');
const { putObject, publicUrl } = require('../lib/storage');
const metrics = require('../monitoring/metrics');

const MAX_SIZE_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME_PREFIXES = [
    'image/', 'video/', 'audio/',
    'application/pdf',
    'text/plain',
    'application/zip',
    'application/octet-stream',
];

function sanitizeFilename(name) {
    return String(name)
        .replace(/[^\w.\-]/g, '_')
        .replace(/\.{2,}/g, '.')
        .replace(/^[._-]+/, '')
        .slice(0, 120) || 'file';
}

function isMimeAllowed(contentType) {
    return ALLOWED_MIME_PREFIXES.some(p => contentType.startsWith(p));
}

function err(msg, status, code) {
    const e = new Error(msg);
    e.statusCode = status;
    e.code = code;
    return e;
}

async function enforceRateLimit(userId) {
    const key   = `v2:rl:presign:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);
    if (count > 20) throw err('Too many upload requests', 429, 20029);
}

/**
 * Upload files to MinIO. Images are converted to WebP before upload (original discarded).
 * Returns array of persisted attachment records.
 *
 * @param {Array<{buffer: Buffer, mimetype: string, filename: string}>} files
 * @param {{userId: number, companyId: number}} ctx
 */
async function uploadAttachments(files, { userId, companyId } = {}) {
    if (!userId)    throw err('Missing userId',    400, 50035);
    if (!companyId) throw err('Missing companyId', 400, 50035);
    if (!files?.length) throw err('No files provided', 400, 50035);

    await enforceRateLimit(userId);
    metrics.incPresign();

    const results = [];

    for (const { buffer, mimetype, filename } of files) {
        if (buffer.length > MAX_SIZE_BYTES) {
            throw err(`File "${filename}" exceeds 25 MB limit`, 413, 40005);
        }
        if (!isMimeAllowed(mimetype)) {
            throw err(`MIME type "${mimetype}" is not allowed`, 415, 50035);
        }

        let finalBuffer = buffer;
        let finalMime   = mimetype;
        let cleanName   = sanitizeFilename(filename);

        if (mimetype.startsWith('image/') && mimetype !== 'image/webp') {
            finalBuffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();
            finalMime   = 'image/webp';
            cleanName   = cleanName.replace(/\.[^.]+$/, '') + '.webp';
        }

        const id   = nextV2();
        const uuid = crypto.randomUUID();
        const key  = `companies/${Number(companyId)}/users/${Number(userId)}/${uuid}-${cleanName}`;
        const pub  = publicUrl(key);

        await putObject(key, finalBuffer, finalMime);

        await prisma.v2Attachment.create({
            data: {
                id,
                filename:    cleanName,
                contentType: finalMime,
                size:        finalBuffer.length,
                url:         pub,
                key,
                userId:      Number(userId),
                companyId:   Number(companyId),
                scanStatus:  'confirmed',
            },
        });

        results.push({
            id:          String(id),
            url:         pub,
            filename:    cleanName,
            contentType: finalMime,
            size:        finalBuffer.length,
        });
    }

    return { attachments: results };
}

module.exports = { uploadAttachments };
