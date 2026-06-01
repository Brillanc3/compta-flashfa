const prisma = require('../db');

/**
 * Get all bills for the authenticated user, across all companies.
 * A bill is considered to belong to the user if its `recipientCharacterId` matches the user's `characterId`,
 * OR if the associated `Client` has a `characterId` matching the user's `characterId`.
 */
async function getMyBills(req, reply) {
    try {
        let { userId, characterId } = req.user;

        // Fallback: if characterId is missing from token (existing sessions), fetch it from DB
        if (userId && !characterId) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { characterId: true }
            });
            characterId = user?.characterId;
        }

        if (!characterId) {
            return reply.send({
                data: [],
                pagination: {
                    totalCount: 0,
                    totalPages: 1,
                    currentPage: 1,
                    limit: 15
                }
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const skip = (page - 1) * limit;

        const {
            companyId,
            startDate,
            endDate,
            status,
            billId,
            reason
        } = req.query;

        // Build where clause
        const whereClause = {
            OR: [
                { recipientCharacterId: characterId },
                { client: { characterId: characterId } }
            ]
        };

        if (companyId) {
            const cid = parseInt(companyId);
            if (Number.isFinite(cid)) {
                whereClause.companyId = cid;
            }
        }

        if (status) {
            whereClause.status = status;
        }

        if (billId) {
            const externalBillId = parseInt(billId);
            if (Number.isFinite(externalBillId)) {
                whereClause.externalBillId = externalBillId;
            }
        }

        if (reason) {
            whereClause.reason = { contains: reason };
        }

        if (startDate || endDate) {
            whereClause.date = {};
            if (startDate) {
                whereClause.date.gte = new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                whereClause.date.lte = end;
            }
        }

        const [totalCount, bills] = await prisma.$transaction([
            prisma.bill.count({ where: whereClause }),
            prisma.bill.findMany({
                where: whereClause,
                include: {
                    company: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                },
                orderBy: { date: 'desc' },
                skip,
                take: limit
            })
        ]);

        return reply.send({
            data: bills,
            pagination: {
                totalCount,
                totalPages: Math.ceil(totalCount / limit) || 1,
                currentPage: page,
                limit
            }
        });

    } catch (error) {
        console.error('[getMyBills] Error:', error);
        return reply.code(500).send({ error: 'Failed to fetch user bills' });
    }
}

module.exports = {
    getMyBills
};
