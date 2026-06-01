// backend/src/controllers/rankController.js

const prisma = require('../db');

/**
 * Vérifie si un utilisateur a des permissions de gérant pour une entreprise
 * @param {number} userId - ID de l'utilisateur
 * @param {number} companyId - ID de l'entreprise
 * @returns {boolean} - True si l'utilisateur est gérant
 */
const isCompanyManager = async (userId, companyId) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            roles: { include: { permissions: true } },
            permissions: true,
        },
    });

    if (!user) return false;

    // Collecter toutes les permissions
    const userPermissions = new Set();
    user.roles.forEach(role => role.permissions.forEach(p => userPermissions.add(p.action)));
    user.permissions.forEach(p => userPermissions.add(p.action));

    // Vérifier la permission de gérant avec wildcard
    const managerPermission = `COMPANY.${companyId}.*`;
    return userPermissions.has(managerPermission);
};

/**
 * Récupère tous les rangs pour une entreprise spécifique.
 */
const getRanksForCompany = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const ranks = await prisma.rank.findMany({
            where: { companyId },
            orderBy: { position: 'asc' },
            include: { permissionTemplates: true },
        });
        reply.send(ranks);
    } catch (error) {
        reply.code(500).send({ message: 'Erreur lors de la récupération des rangs', error: error.message });
    }
};

/**
 * Crée un nouveau rang pour une entreprise.
 */
const createRank = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const { name, position, commissionRate, permissionTemplateIds } = request.body;
        const newRank = await prisma.rank.create({
            data: {
                name,
                position,
                commissionRate,
                companyId,
                permissionTemplates: {
                    connect: permissionTemplateIds.map(id => ({ id })),
                },
            },
        });
        reply.code(201).send(newRank);
    } catch (error) {
        if (error.code === 'P2002') {
            reply.code(409).send({ message: 'Un rang avec ce nom ou cette position existe déjà pour cette entreprise.' });
        } else {
            reply.code(500).send({ message: 'Erreur lors de la création du rang', error: error.message });
        }
    }
};

/**
 * Met à jour un rang spécifique après vérification de la hiérarchie.
 */
const updateRank = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const rankId = parseInt(request.params.rankId, 10);
        const { name, position, commissionRate, permissionTemplateIds } = request.body;
        const actorUserId = request.user.userId;

        // --- VÉRIFICATION DE SÉCURITÉ HIÉRARCHIQUE MODIFIÉE ---

        // Vérifier d'abord si l'utilisateur est gérant de l'entreprise
        const isManager = await isCompanyManager(actorUserId, companyId);

        if (isManager) {
            // Si c'est un gérant, il peut tout faire, on passe directement à la mise à jour
            const updatedRank = await prisma.rank.update({
                where: { id: rankId },
                data: {
                    name,
                    position,
                    commissionRate,
                    permissionTemplates: { set: permissionTemplateIds.map(id => ({ id })) },
                },
            });
            return reply.send(updatedRank);
        }

        // Si ce n'est pas un gérant, on applique les règles hiérarchiques standard
        const actorEmployee = await prisma.employee.findUnique({ where: { userId: actorUserId }});
        if (!actorEmployee) {
            return reply.code(403).send({ message: 'Accès interdit : Profil employé non trouvé.'});
        }

        const actorContract = await prisma.companyEmployee.findUnique({
            where: { companyId_employeeId: { companyId, employeeId: actorEmployee.id } },
            include: { rank: true },
        });
        if (!actorContract) {
            return reply.code(403).send({ message: 'Accès interdit : Vous n\'êtes pas employé de cette entreprise.'});
        }

        // On récupère le rang cible
        const targetRank = await prisma.rank.findUnique({ where: { id: rankId }});
        if (!targetRank) {
            return reply.code(404).send({ message: 'Rang cible non trouvé.'});
        }

        // La règle de sécurité : on ne peut pas modifier un rang de position égale ou supérieure
        if (actorContract.rank.position <= targetRank.position) {
            return reply.code(403).send({ message: 'Accès interdit: Vous ne pouvez pas modifier un rang de position égale ou supérieure à la vôtre.' });
        }
        // --- FIN DE LA VÉRIFICATION ---

        const updatedRank = await prisma.rank.update({
            where: { id: rankId },
            data: {
                name,
                position,
                commissionRate,
                permissionTemplates: { set: permissionTemplateIds.map(id => ({ id })) },
            },
        });
        reply.send(updatedRank);
    } catch (error) {
        reply.code(500).send({ message: 'Erreur lors de la mise à jour du rang', error: error.message });
    }
};

/**
 * Supprime un rang après vérification de la hiérarchie.
 */
const deleteRank = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const rankId = parseInt(request.params.rankId, 10);
        const actorUserId = request.user.userId;

        // --- VÉRIFICATION DE SÉCURITÉ HIÉRARCHIQUE MODIFIÉE ---

        // Vérifier d'abord si l'utilisateur est gérant de l'entreprise
        const isManager = await isCompanyManager(actorUserId, companyId);

        if (isManager) {
            // Si c'est un gérant, il peut tout supprimer, on passe directement à la suppression
            await prisma.rank.delete({ where: { id: rankId } });
            return reply.code(204).send();
        }

        // Si ce n'est pas un gérant, on applique les règles hiérarchiques standard
        const actorEmployee = await prisma.employee.findUnique({ where: { userId: actorUserId }});
        if (!actorEmployee) {
            return reply.code(403).send({ message: 'Accès interdit : Profil employé non trouvé.'});
        }

        const actorContract = await prisma.companyEmployee.findUnique({
            where: { companyId_employeeId: { companyId, employeeId: actorEmployee.id } },
            include: { rank: true },
        });
        if (!actorContract) {
            return reply.code(403).send({ message: 'Accès interdit : Vous n\'êtes pas employé de cette entreprise.'});
        }

        const targetRank = await prisma.rank.findUnique({ where: { id: rankId }});
        if (!targetRank) {
            return reply.code(404).send({ message: 'Rang cible non trouvé.'});
        }

        if (actorContract.rank.position <= targetRank.position) {
            return reply.code(403).send({ message: 'Accès interdit: Vous ne pouvez pas supprimer un rang de position égale ou supérieure à la vôtre.' });
        }
        // --- FIN DE LA VÉRIFICATION ---

        await prisma.rank.delete({ where: { id: rankId } });
        reply.code(204).send();
    } catch (error) {
        if (error.code === 'P2003') {
            reply.code(409).send({ message: 'Impossible de supprimer ce rang car il est encore assigné à un ou plusieurs employés.' });
        } else {
            reply.code(500).send({ message: 'Erreur lors de la suppression du rang', error: error.message });
        }
    }
};

module.exports = {
    getRanksForCompany,
    createRank,
    updateRank,
    deleteRank,
};