'use strict';

const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const GATEWAY_CHANNEL = 'gateway:events';

/**
 * Publisher Redis (backend métier)
 */
const redisPublisher = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    keyPrefix: process.env.ENV === 'dev' ? 'dev:' : 'prod:',
});

/**
 * Subscriber Redis (gateway WS)
 * ⚠️ ioredis impose une connexion dédiée
 */
const redisSubscriber = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    keyPrefix: process.env.ENV === 'dev' ? 'dev:' : 'prod:',
});

/**
 * API UNIQUE pour émettre un event gateway
 * → appelée depuis les API shards
 */
function emitGatewayEvent({ scope, targets, event, payload }) {
    if (!scope) throw new Error('[GatewayEmitter] scope is required');
    if (!event) throw new Error('[GatewayEmitter] event is required');

    const message = {
        scope,
        targets: targets ?? null,
        event,
        payload,
        ts: Date.now(),
    };

    redisPublisher.publish(GATEWAY_CHANNEL, JSON.stringify(message));
}

module.exports = {
    emitGatewayEvent,
    redisSubscriber,
    GATEWAY_CHANNEL,
};
