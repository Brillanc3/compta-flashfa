// backend/src/services/expenseReportService.js

const prisma = require('../db');
const { createNotification } = require('./notificationService');
const { sub, isAfter, parseISO } = require('date-fns');


/**
 * Crée une nouvelle note de frais.
 * @param {object} data - Données de la note de frais.
 * @param {number} data.amount - Montant de la dépense.
 * @param {string} data.comment - Commentaire/description.
 * @param {string} data.date - Date de la dépense (format ISO).
 * @param {number} data.authorId - ID de l'employé qui soumet.
 * @param {number} data.companyId - ID de l'entreprise.
 */
async function createExpenseReport({ amount, comment, date, authorId, companyId }) {
    const expenseDate = parseISO(date);
    const now = new Date();

    // 1. Validation de la date
    if (isAfter(expenseDate, now)) {
        throw new Error("La date de la note de frais не peut pas être dans le futur.");
    }

    // --- Validation par rapport à la date d'arrivée de l'employé ---
    const employeeRecord = await prisma.companyEmployee.findUnique({
        where: { companyId_userId: { companyId, userId: authorId } }
    });
    if (!employeeRecord) {
        throw new Error("L'employé n'a pas été trouvé dans cette entreprise.");
    }

    const firstRankRecord = await prisma.rankHistory.findFirst({
        where: { companyEmployeeId: employeeRecord.id },
        orderBy: { assignedAt: 'asc' },
    });

    if (firstRankRecord && isAfter(firstRankRecord.assignedAt, expenseDate)) {
        throw new Error("La date de la note de frais ne peut pas être antérieure à la date d'arrivée de l'employé.");
    }

    // 2. Création de la note de frais
    const newExpenseReport = await prisma.expenseReport.create({
        data: {
            amount,
            comment,
            date: expenseDate,
            authorId,
            companyId,
        },
        include: {
            author: { select: { name: true } }
        }
    });

    // 3. Envoi de la notification aux ayants droit
    const managers = await findUsersWithPermission(companyId, 'COMPANY.{id}.NOTE_DE_FRAIS.MANAGE');

    const recipients = [];
    for (const manager of managers) {
        const prefs = manager.notificationPreferences || {};
        // On envoie la notif si les préférences n'existent pas ou sont activées
        if (prefs.disableExpenseReportNotifications !== true) {
            recipients.push(manager.id);
        }
    }

    if (recipients.length > 0) {
        await createNotification({
            recipientUserIds: recipients,
            content: {
                title: "Nouvelle note de frais",
                body: `${newExpenseReport.author.name} a soumis une note de frais de ${amount}€.`
            },
            behavior: 'TEMPORARY',
            type: 'SYSTEM',
            companyId,
        });
    }

    return newExpenseReport;
}

/**
 * Met à jour le statut d'une note de frais.
 * @param {object} data
 * @param {number} data.reportId - ID de la note de frais.
 * @param {'REIMBURSED' | 'REJECTED'} data.status - Nouveau statut.
 * @param {number} data.reviewerId - ID du manager qui effectue l'action.
 * @param {number} data.companyId - ID de l'entreprise pour la notification.
 */
async function updateExpenseReportStatus({ reportId, status, reviewerId, companyId }) {
    const updatedReport = await prisma.expenseReport.update({
        where: { id: reportId },
        data: {
            status,
            reviewerId,
        },
        include: {
            author: { select: { name: true } }
        }
    });

    // Envoi de la notification à l'employé
    const statusText = status === 'REIMBURSED' ? 'remboursée' : 'refusée';
    await createNotification({
        recipientUserIds: [updatedReport.authorId],
        content: {
            title: "Votre note de frais a été traitée",
            body: `Votre note de frais de ${updatedReport.amount}€ a été ${statusText}.`
        },
        behavior: 'PERMANENT',
        type: 'SYSTEM',
        companyId,
    });

    return updatedReport;
}

/**
 * Récupère les notes de frais en fonction des permissions de l'utilisateur.
 * @param {number} companyId
 * @param {object} user - L'objet utilisateur authentifié.
 */
async function findExpenseReports({ companyId, user }) {
    const viewPermission = `COMPANY.${companyId}.NOTE_DE_FRAIS.VIEW`;
    const managePermission = `COMPANY.${companyId}.NOTE_DE_FRAIS.MANAGE`;
    const userPermissions = new Set(user.permissions);

    const canViewAll = userPermissions.has(viewPermission) || userPermissions.has(managePermission);

    if (canViewAll) {
        // L'utilisateur est un manager/ayant droit, il voit tout
        return prisma.expenseReport.findMany({
            where: { companyId },
            include: { author: { select: { id: true, name: true } } },
            orderBy: { date: 'desc' }
        });
    } else {
        // L'utilisateur est un employé standard, il ne voit que les siennes
        return prisma.expenseReport.findMany({
            where: { companyId, authorId: user.userId },
            orderBy: { date: 'desc' }
        });
    }
}

/**
 * Utilitaire pour trouver les utilisateurs avec une permission spécifique dans une entreprise.
 * @param {number} companyId
 * @param {string} permissionAction
 */
async function findUsersWithPermission(companyId, permissionAction) {
    // Cette fonction est un exemple. Votre logique pour trouver les utilisateurs
    // avec une permission peut être plus complexe (via les rôles, etc.).
    const employees = await prisma.companyEmployee.findMany({
        where: { companyId },
        include: {
            user: {
                include: {
                    permissions: true,
                    roles: { include: { permissions: true } }
                }
            }
        }
    });

    const usersWithPermission = [];
    const actionWithId = permissionAction.replace('{id}', companyId);

    for (const emp of employees) {
        const user = emp.user;
        const directPermissions = new Set(user.permissions.map(p => p.action));
        const rolePermissions = new Set(user.roles.flatMap(r => r.permissions.map(p => p.action)));

        if (directPermissions.has(actionWithId) || rolePermissions.has(actionWithId)) {
            usersWithPermission.push(user);
        }
    }

    return usersWithPermission;
}

/**
 * Calcule les statistiques des notes de frais pour une entreprise.
 * @param {number} companyId - ID de l'entreprise.
 * @returns {Promise<object>} Un objet avec les totaux pour chaque statut.
 */
async function getExpenseReportStats(companyId) {
    const [pending, reimbursed, rejected] = await Promise.all([
        prisma.expenseReport.count({
            where: { companyId, status: 'PENDING' },
        }),
        prisma.expenseReport.count({
            where: { companyId, status: 'REIMBURSED' },
        }),
        prisma.expenseReport.count({
            where: { companyId, status: 'REJECTED' },
        }),
    ]);

    return { pending, reimbursed, rejected };
}



module.exports = {
    createExpenseReport,
    updateExpenseReportStatus,
    findExpenseReports,
    getExpenseReportStats
};