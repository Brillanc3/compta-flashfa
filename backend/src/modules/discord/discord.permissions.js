// backend/src/modules/discord/discord.permissions.js
'use strict';

const PERMISSIONS = {
    DISCORD_VIEW:   'DISCORD.VIEW',
    DISCORD_MANAGE: 'DISCORD.MANAGE',
};

const HIERARCHY = {
    [PERMISSIONS.DISCORD_MANAGE]: [PERMISSIONS.DISCORD_VIEW],
};

const DESCRIPTIONS = {
    [PERMISSIONS.DISCORD_VIEW]:   'Voir l\'intégration Discord',
    [PERMISSIONS.DISCORD_MANAGE]: 'Gérer l\'intégration Discord',
};

module.exports = { PERMISSIONS, HIERARCHY, DESCRIPTIONS };
