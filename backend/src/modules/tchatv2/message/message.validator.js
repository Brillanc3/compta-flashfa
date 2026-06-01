'use strict';

const snowflakePattern = '^[0-9]+$';

const channelParams = {
    type: 'object',
    required: ['guildId', 'channelId'],
    properties: {
        guildId:   { type: 'string', pattern: snowflakePattern },
        channelId: { type: 'string', pattern: snowflakePattern },
    },
};

const messageParams = {
    type: 'object',
    required: ['guildId', 'channelId', 'messageId'],
    properties: {
        guildId:   { type: 'string', pattern: snowflakePattern },
        channelId: { type: 'string', pattern: snowflakePattern },
        messageId: { type: 'string', pattern: snowflakePattern },
    },
};

const listQuerystring = {
    type: 'object',
    properties: {
        limit:  { type: 'integer', minimum: 1, maximum: 100, default: 50 },
        before: { type: 'string', pattern: snowflakePattern },
        after:  { type: 'string', pattern: snowflakePattern },
        around: { type: 'string', pattern: snowflakePattern },
    },
    additionalProperties: false,
};

const createBody = {
    type: 'object',
    properties: {
        content:            { type: 'string', minLength: 1, maxLength: 2000 },
        nonce:              { type: 'string', maxLength: 64 },
        referencedMessageId: { type: 'string', pattern: snowflakePattern },
        attachmentIds:      { type: 'array', items: { type: 'string', pattern: snowflakePattern }, maxItems: 10 },
        tts:                { type: 'boolean' },
        hasPoll:            { type: 'boolean', enum: [true] },
    },
    anyOf: [
        { required: ['content'] },
        { required: ['attachmentIds'] },
        { required: ['hasPoll'] },
    ],
    additionalProperties: false,
};

const editBody = {
    type: 'object',
    required: ['content'],
    properties: {
        content: { type: 'string', minLength: 1, maxLength: 2000 },
    },
    additionalProperties: false,
};

const bulkDeleteBody = {
    type: 'object',
    required: ['messages'],
    properties: {
        messages: {
            type: 'array',
            items: { type: 'string', pattern: snowflakePattern },
            minItems: 2,
            maxItems: 100,
        },
    },
    additionalProperties: false,
};

module.exports = { channelParams, messageParams, listQuerystring, createBody, editBody, bulkDeleteBody };
