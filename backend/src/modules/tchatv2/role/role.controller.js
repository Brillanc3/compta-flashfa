'use strict';

const repo = require('./role.repository');
const { createRole, updateRole, deleteRole, reorderRoles } = require('./role.service');
const audit = require('../moderation/audit.service');
const { AuditLogActionType } = require('../tchatv2.constants');

async function list(req, reply) {
    const roles = await repo.findByGuild(req.params.guildId);
    return reply.send(roles);
}

async function create(req, reply) {
    try {
        const role = await createRole(req.params.guildId, req.user.id, req.body);
        audit.log({ guildId: req.params.guildId, actorId: req.user.id, targetId: role.id, actionType: AuditLogActionType.ROLE_CREATE });
        return reply.code(201).send(role);
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

async function update(req, reply) {
    try {
        const role = await updateRole(req.params.guildId, req.params.roleId, req.user.id, req.body);
        audit.log({ guildId: req.params.guildId, actorId: req.user.id, targetId: req.params.roleId, actionType: AuditLogActionType.ROLE_UPDATE, changes: req.body });
        return reply.send(role);
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

async function destroy(req, reply) {
    try {
        await deleteRole(req.params.guildId, req.params.roleId, req.user.id);
        audit.log({ guildId: req.params.guildId, actorId: req.user.id, targetId: req.params.roleId, actionType: AuditLogActionType.ROLE_DELETE });
        return reply.code(204).send();
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

async function reorder(req, reply) {
    try {
        await reorderRoles(req.params.guildId, req.body);
        return reply.code(204).send();
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

module.exports = { list, create, update, destroy, reorder };
