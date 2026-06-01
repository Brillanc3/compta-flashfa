'use strict';

const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const prefix = process.env.ENV === 'dev' ? 'dev:bull' : 'bull';

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const embedQueue = new Queue('tchatv2-embeds', { connection, prefix });

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;

function extractUrls(content) {
    const matches = content.match(URL_REGEX) || [];
    // Déduplique, limite à 5 URLs par message
    return [...new Set(matches)].slice(0, 5);
}

async function enqueueEmbeds(content, messageId) {
    const urls = extractUrls(content || '');
    for (const url of urls) {
        await embedQueue.add('generate-embed', { url, messageId: String(messageId) }, {
            attempts: 2,
            backoff: { type: 'fixed', delay: 3000 },
            removeOnComplete: 500,
            removeOnFail: 200,
        });
    }
    return urls.length;
}

module.exports = { enqueueEmbeds, embedQueue, extractUrls };
