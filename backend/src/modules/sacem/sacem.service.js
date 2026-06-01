// /backend/src/modules/sacem/sacem.service.js
'use strict';

const prisma = require('../../db');

/**
 * Parsing des dates spécifiques : "23h15m32 25/02/2026"
 */
function parseCustomDate(str) {
    if (!str) return null;
    const m = str.match(/(\d+)h(\d+)m(\d+)\s+(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) {
        // Date(year, monthIndex, day, hours, minutes, seconds)
        return new Date(
            parseInt(m[6]),
            parseInt(m[5]) - 1,
            parseInt(m[4]),
            parseInt(m[1]),
            parseInt(m[2]),
            parseInt(m[3])
        );
    }
    return null;
}

/**
 * Parser de texte SACEM
 */
function parseSacemImport(text) {
    let dateCollection = new Date(); // Fallback
    const headerMatch = text.match(/Date:\s*(\d+h\d+m\d+\s+\d{2}\/\d{2}\/\d{4})/i);
    if (headerMatch) {
        dateCollection = parseCustomDate(headerMatch[1]) || dateCollection;
    }

    const blocks = text.split(/Id du Message\s*:/i).slice(1);
    const entries = [];

    for (const blockContent of blocks) {
        const fullBlock = 'Id du Message : ' + blockContent; // reconstruction pour les regex si besoin
        const lines = blockContent.split('\n').map(l => l.trim()).filter(Boolean);
        
        const messageIdMatch = blockContent.match(/^\s*(\d+)/);
        if (!messageIdMatch) continue;
        const messageId = messageIdMatch[1];

        const postedMatch = blockContent.match(/Posté le\s*:\s*(\d+h\d+m\d+\s+\d{2}\/\d{2}\/\d{4})/i);
        const postedAt = postedMatch ? parseCustomDate(postedMatch[1]) : null;

        const reactionMatch = blockContent.match(/Paie par réaction\s*:\s*\$(\d+)x(\d+)/i);
        const reactionsCount = reactionMatch ? parseInt(reactionMatch[2], 10) : 0;

        const paieMatch = blockContent.match(/Paie\s*\$(\d+)/i);
        const amount = paieMatch ? parseFloat(paieMatch[1]) : 0;

        if (messageId) {
            entries.push({
                messageId,
                postedAt,
                reactionsCount,
                amount,
                receivedAt: dateCollection
            });
        }
    }
    return entries;
}

/* ============================================================================
 * CRUD & Business Logic
 * ==========================================================================*/

async function previewSacemImport({ companyId, text }) {
    const parsedEntries = parseSacemImport(text);
    if (parsedEntries.length === 0) {
        throw new Error("Aucune donnée valide trouvée dans le texte.");
    }

    const preview = [];

    for (const entry of parsedEntries) {
        const existingPost = await prisma.sacemPost.findUnique({
            where: { messageId: entry.messageId },
            include: {
                participations: {
                    include: { employee: { include: { user: { select: { name: true } } } } }
                }
            }
        });

        preview.push({
            ...entry,
            isNew: !existingPost,
            existingPost: existingPost ? {
                id: existingPost.id,
                title: existingPost.title,
                category: existingPost.category,
                participations: existingPost.participations.map(p => ({
                    employeeId: p.employeeId,
                    employeeName: p.employee.user.name,
                    percentage: p.percentage
                }))
            } : null
        });
    }

    return preview;
}

async function importSacemData({ companyId, entries }) {
    if (!Array.isArray(entries) || entries.length === 0) {
        throw new Error("Aucune donnée à importer.");
    }

    const results = {
        created: 0,
        updated: 0,
        paymentsAdded: 0
    };

    await prisma.$transaction(async (tx) => {
        for (const entry of entries) {
            let post;
            
            // 1. Trouver ou créer le post
            if (entry.postId) {
                // Si on a un ID, on l'utilise
                post = await tx.sacemPost.findUnique({ where: { id: entry.postId } });
                results.updated++;
            } else {
                // Sinon on cherche par messageId ou on crée
                post = await tx.sacemPost.findUnique({ where: { messageId: entry.messageId } });
                
                if (!post) {
                    post = await tx.sacemPost.create({
                        data: {
                            companyId,
                            messageId: entry.messageId,
                            postedAt: new Date(entry.postedAt || entry.receivedAt),
                            title: entry.title || `Post ${entry.messageId.slice(-4)}`,
                            category: entry.category || null,
                        }
                    });
                    
                    // Si on a des participations passées lors de la création
                    if (Array.isArray(entry.participations) && entry.participations.length > 0) {
                        await tx.sacemParticipation.createMany({
                            data: entry.participations.map(p => ({
                                postId: post.id,
                                employeeId: parseInt(p.employeeId),
                                percentage: parseFloat(p.percentage)
                            }))
                        });
                    }
                    results.created++;
                } else {
                    results.updated++;
                }
            }

            // 2. Ajouter le paiement
            await tx.sacemPayment.create({
                data: {
                    postId: post.id,
                    amount: entry.amount,
                    receivedAt: new Date(entry.receivedAt),
                    reactionsCount: entry.reactionsCount || 0
                }
            });
            results.paymentsAdded++;
        }
    });

    return results;
}

async function listPosts({ companyId, page = 1, limit = 50, category, search }) {
    const skip = (page - 1) * limit;
    const where = { companyId };

    if (category) where.category = category;
    if (search) {
        where.OR = [
            { title: { contains: search } },
            { messageId: { contains: search } },
        ];
    }

    const [total, items] = await Promise.all([
        prisma.sacemPost.count({ where }),
        prisma.sacemPost.findMany({
            where,
            skip,
            take: limit,
            orderBy: { postedAt: 'desc' },
            include: {
                _count: { select: { payments: true, participations: true } },
                participations: {
                    include: { employee: { include: { user: { select: { name: true } } } } }
                }
            }
        })
    ]);

    // Calculer le total des paiements par post pour l'aperçu
    const enrichedItems = await Promise.all(items.map(async (item) => {
        const sum = await prisma.sacemPayment.aggregate({
            where: { postId: item.id },
            _sum: { amount: true }
        });
        return {
            ...item,
            totalEarnings: Number(sum._sum.amount || 0)
        };
    }));

    return { total, items: enrichedItems, page, limit };
}

async function getPostDetails(companyId, postId) {
    const post = await prisma.sacemPost.findFirst({
        where: { id: parseInt(postId), companyId },
        include: {
            payments: { orderBy: { receivedAt: 'desc' } },
            participations: {
                include: { employee: { include: { user: { select: { name: true } } } } }
            }
        }
    });

    if (!post) throw new Error("Post introuvable.");
    return post;
}

async function updatePost(companyId, postId, data) {
    const { title, category, participations } = data;

    return prisma.$transaction(async (tx) => {
        const post = await tx.sacemPost.findFirst({
            where: { id: parseInt(postId), companyId }
        });
        if (!post) throw new Error("Post introuvable.");

        // Update post basic info
        await tx.sacemPost.update({
            where: { id: post.id },
            data: { title, category }
        });

        // Update participations if provided
        if (Array.isArray(participations)) {
            // On supprime les anciennes et on met les nouvelles
            await tx.sacemParticipation.deleteMany({ where: { postId: post.id } });
            if (participations.length > 0) {
                await tx.sacemParticipation.createMany({
                    data: participations.map(p => ({
                        postId: post.id,
                        employeeId: parseInt(p.employeeId),
                        percentage: parseFloat(p.percentage)
                    }))
                });
            }
        }

        return tx.sacemPost.findUnique({
            where: { id: post.id },
            include: { participations: true }
        });
    });
}

/**
 * Calculateur de salaire pour le SACEM (Pourcentage)
 */
async function calculateSacemPercentageSalary(employee, dateRange) {
    const { from, to } = dateRange;
    const raw = employee.rank?.remunerationConfig;
    const rankCfg = raw ? (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw) : {};
    const sacemPercentageRate = parseFloat(rankCfg.sacemPercentage || 0);

    if (sacemPercentageRate <= 0) {
        return { key: 'sacemPercentage', value: 0, templateVariables: { postsCount: 0, percent: 0 } };
    }

    // On filtre sur post.postedAt (date de publication) et non payment.receivedAt
    // pour ne compter que les posts publiés dans la semaine sélectionnée.
    const participations = await prisma.sacemParticipation.findMany({
        where: {
            employeeId: employee.id,
            post: { postedAt: { gte: from, lte: to } }
        },
        include: {
            post: {
                include: { payments: true }
            }
        }
    });

    let totalBonus = 0;
    let postsCount = 0;
    const details = [];

    for (const part of participations) {
        const postPayments = part.post.payments || [];
        if (postPayments.length === 0) continue;

        postsCount++;
        const postTotalAmount = postPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const employeePostShare = postTotalAmount * (parseFloat(part.percentage) / 100);
        const bonusValue = employeePostShare * (sacemPercentageRate / 100);
        totalBonus += bonusValue;

        details.push({
            date: part.post.postedAt,
            label: `Post SACEM: ${part.post.title}`,
            value: bonusValue
        });
    }

    return {
        key: 'sacemPercentage',
        value: Math.round(totalBonus),
        templateVariables: {
            postsCount,
            percent: sacemPercentageRate
        },
        details
    };
}

/**
 * Calculateur de salaire pour le SACEM (Fixe par poste)
 */
async function calculateSacemFixedSalary(employee, dateRange) {
    const { from, to } = dateRange;
    const raw = employee.rank?.remunerationConfig;
    const rankCfg = raw ? (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw) : {};
    const sacemFixedPerPost = parseFloat(rankCfg.sacemFixedPerPost || 0);

    if (sacemFixedPerPost <= 0) {
        return { key: 'sacemFixedPerPost', value: 0, templateVariables: { postsCount: 0, fixedAmount: 0 } };
    }

    // On compte uniquement les posts publiés dans la période sélectionnée.
    const participations = await prisma.sacemParticipation.findMany({
        where: {
            employeeId: employee.id,
            post: { postedAt: { gte: from, lte: to } }
        },
        include: {
            post: {
                include: { payments: true }
            }
        }
    });

    let postsParticipated = 0;
    const details = [];
    for (const part of participations) {
        postsParticipated++;
        details.push({
            date: part.post.postedAt,
            label: `Post SACEM: ${part.post.title}`,
            value: sacemFixedPerPost
        });
    }

    return {
        key: 'sacemFixedPerPost',
        value: Math.round(postsParticipated * sacemFixedPerPost),
        templateVariables: {
            postsCount: postsParticipated,
            fixedAmount: sacemFixedPerPost
        },
        details
    };
}

/**
 * Calculateur de report SACEM pour les rangs artistes.
 *
 * Logique :
 * - S1 : salaire brut SACEM (pct + fixe) = rawS1
 *   Si rawS1 > salaryFixed → surplus = rawS1 - salaryFixed (report à S2)
 * - S2 (semaine courante) : reçoit le surplus de S1 comme bonus
 *
 * Le surplus est calculé à la volée en lisant les posts de la semaine précédente.
 * Aucune table DB supplémentaire n'est nécessaire.
 */
async function calculateSacemArtistCarryover(employee, dateRange) {
    const raw = employee.rank?.remunerationConfig;
    const rankCfg = raw ? (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw) : {};

    const isArtist = rankCfg.isArtist === true;
    if (!isArtist) return { key: 'isArtist', value: 0, templateVariables: { surplus: 0, fixedSalary: parseFloat(rankCfg.salaryFixed || 0) } };

    const salaryFixed = parseFloat(rankCfg.salaryFixed || 0);
    if (salaryFixed <= 0) return { key: 'isArtist', value: 0, templateVariables: { surplus: 0, fixedSalary: 0 } };

    const sacemPercentageRate = parseFloat(rankCfg.sacemPercentage || 0);
    const sacemFixedPerPost  = parseFloat(rankCfg.sacemFixedPerPost || 0);

    // Semaine précédente (S-1)
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const prevFrom = new Date(dateRange.from.getTime() - weekMs);
    const prevTo   = new Date(dateRange.to.getTime()   - weekMs);

    // Participations de l'employé pour les posts publiés la semaine précédente
    const prevParticipations = await prisma.sacemParticipation.findMany({
        where: {
            employeeId: employee.id,
            post: { postedAt: { gte: prevFrom, lte: prevTo } }
        },
        include: {
            post: { include: { payments: true } }
        }
    });

    // Calcul du total brut SACEM de S-1 (pct + fixe par post)
    let prevRawTotal = 0;
    for (const part of prevParticipations) {
        const postTotal  = part.post.payments.reduce((s, p) => s + Number(p.amount), 0);
        const share      = postTotal * (parseFloat(part.percentage) / 100);
        const pctBonus   = share * (sacemPercentageRate / 100);
        prevRawTotal += pctBonus + sacemFixedPerPost;
    }

    // Surplus non versé la semaine dernière
    const surplus = Math.max(0, Math.round(prevRawTotal - salaryFixed));

    if (surplus <= 0) return { key: 'isArtist', value: 0 };

    return {
        key: 'isArtist',
        value: surplus,
        templateVariables: {
            surplus,
            fixedSalary: salaryFixed,
            prevWeekFrom: prevFrom.toISOString().slice(0, 10),
            prevWeekTo:   prevTo.toISOString().slice(0, 10)
        },
        details: [{
            date: prevFrom,
            label: `Report SACEM semaine précédente (brut ${Math.round(prevRawTotal)}$ > plafond ${salaryFixed}$)`,
            value: surplus
        }]
    };
}

async function getCategories(companyId) {
    const categories = await prisma.sacemPost.findMany({
        where: { companyId, NOT: { category: null } },
        distinct: ['category'],
        select: { category: true }
    });
    return categories.map(c => c.category);
}

async function getSacemStats(companyId, { from, to }) {
    const currentFrom = from ? new Date(from) : null;
    const currentTo = to ? new Date(to) : null;

    const whereCurrent = { companyId };
    if (currentFrom || currentTo) {
        whereCurrent.payments = {
            some: {
                receivedAt: { 
                    ...(currentFrom && { gte: currentFrom }), 
                    ...(currentTo && { lte: currentTo }) 
                }
            }
        };
    }

    const posts = await prisma.sacemPost.findMany({
        where: whereCurrent,
        include: {
            payments: {
                where: {
                    receivedAt: { 
                        ...(currentFrom && { gte: currentFrom }), 
                        ...(currentTo && { lte: currentTo }) 
                    }
                }
            }
        }
    });

    const statsByPost = posts.map(p => ({
        id: p.id,
        title: p.title,
        messageId: p.messageId,
        category: p.category,
        total: p.payments.reduce((sum, pay) => sum + Number(pay.amount), 0)
    })).sort((a, b) => b.total - a.total);

    const statsByCategory = statsByPost.reduce((acc, curr) => {
        const cat = curr.category || 'Non classé';
        acc[cat] = (acc[cat] || 0) + curr.total;
        return acc;
    }, {});

    const totalEarnings = statsByPost.reduce((sum, p) => sum + p.total, 0);

    // Trend calculation
    let trend = 0;
    if (currentFrom && currentTo) {
        const duration = currentTo.getTime() - currentFrom.getTime();
        const prevFrom = new Date(currentFrom.getTime() - duration);
        const prevTo = currentFrom;

        const prevPayments = await prisma.sacemPayment.aggregate({
            where: {
                post: { companyId },
                receivedAt: { gte: prevFrom, lt: prevTo }
            },
            _sum: { amount: true }
        });

        const previousEarnings = Number(prevPayments._sum.amount || 0);
        if (previousEarnings > 0) {
            trend = ((totalEarnings - previousEarnings) / previousEarnings) * 100;
        } else if (totalEarnings > 0) {
            trend = 100; // 100% increase if previous was 0
        }
    }

    return {
        totalEarnings,
        trend: parseFloat(trend.toFixed(2)),
        statsByPost: statsByPost.slice(0, 10),
        statsByCategory: Object.entries(statsByCategory).map(([name, value]) => ({ name, value }))
    };
}

module.exports = {
    importSacemData,
    listPosts,
    getPostDetails,
    updatePost,
    calculateSacemPercentageSalary,
    calculateSacemFixedSalary,
    calculateSacemArtistCarryover,
    getSacemStats,
    getCategories,
    previewSacemImport
};
