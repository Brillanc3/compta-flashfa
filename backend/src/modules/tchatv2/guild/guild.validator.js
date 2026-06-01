'use strict';

const createGuildBody = {
    type: 'object',
    required: ['name'],
    properties: {
        name:        { type: 'string', minLength: 2, maxLength: 100 },
        description: { type: 'string', maxLength: 120 },
        iconHash:    { type: 'string', maxLength: 128 },
        companyId:   { type: 'integer', minimum: 1 },
    },
    additionalProperties: false,
};

const updateGuildBody = {
    type: 'object',
    properties: {
        name:             { type: 'string', minLength: 2, maxLength: 100 },
        description:      { type: 'string', maxLength: 120, nullable: true },
        iconHash:         { type: 'string', maxLength: 128, nullable: true },
        bannerHash:       { type: 'string', maxLength: 128, nullable: true },
        afkTimeout:       { type: 'integer', minimum: 60 },
        verificationLevel:{ type: 'integer', minimum: 0, maximum: 4 },
    },
    additionalProperties: false,
};

const guildIdParams = {
    type: 'object',
    required: ['guildId'],
    properties: {
        guildId: { type: 'string', pattern: '^[0-9]+$' },
    },
};

module.exports = { createGuildBody, updateGuildBody, guildIdParams };
