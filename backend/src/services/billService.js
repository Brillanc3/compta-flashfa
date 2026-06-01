// backend/src/services/billService.js
const prisma = require('../db');

/**
 * Récupère une liste paginée de factures pour une entreprise.
 * @param {number} companyId
 * @param {number} page
 * @param {number} pageSize
 */
async function getBillsForCompany(companyId, page, pageSize) {
    const skip = (page - 1) * pageSize;

    const [bills, totalCount] = await prisma.$transaction([
        prisma.bill.findMany({
            where: { companyId },
            include: {
                author: { select: { name: true } },
                client: { select: { name: true } },
            },
            orderBy: { date: 'desc' },
            skip: skip,
            take: pageSize,
        }),
        prisma.bill.count({ where: { companyId } }),
    ]);

    return { bills, totalCount };
}

module.exports = {
    getBillsForCompany,
};