// backend/src/modules/discord/discord.routes.js
'use strict';

const controller = require('./discord.controller');
const { PERMISSIONS, HIERARCHY } = require('./discord.permissions');

async function discordRoutes(fastify, options) {
    const { authenticate, checkPermission, checkModuleAccess } = options.authMiddleware;

    fastify.addHook('preHandler', authenticate);

    const moduleGuard = checkModuleAccess('discord');
    const viewOpts   = { preHandler: [moduleGuard, checkPermission(PERMISSIONS.DISCORD_VIEW,   HIERARCHY)] };
    const manageOpts = { preHandler: [moduleGuard, checkPermission(PERMISSIONS.DISCORD_MANAGE, HIERARCHY)] };

    fastify.get('/config',        viewOpts,   controller.getConfig);
    fastify.post('/config',       manageOpts, controller.saveConfig);
    fastify.delete('/config',     manageOpts, controller.deleteConfig);
    fastify.get('/guild-roles',   viewOpts,   controller.getGuildRoles);
    fastify.post('/verify-bot',   manageOpts, controller.verifyBot);
    fastify.post('/sync',         manageOpts, controller.syncAll);
}

module.exports = {
    name: 'discord',
    isDefault: false,
    routes: discordRoutes,
};
