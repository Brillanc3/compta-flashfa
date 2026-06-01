// /backend/src/modules/clients/clients.service.js

const prisma = require('../../db');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const UPLOADS_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'images');

function _normalizeString(str) {
    // Force en string quelle que soit la valeur reçue
    str = String(str || '').trim();

    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

async function listClients(companyId, { page = 1, limit = 15, search = '' }) {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const where = { companyId };

    if (search) {
        const normalizedSearch = _normalizeString(search);

        // Sécurisation totale : toujours un tableau
        const searchWords = String(normalizedSearch)
            .split(' ')
            .filter(Boolean);

        where.AND = searchWords.map(word => ({
            OR: [
                { nameSearchable: { contains: word } },
                { name: { contains: search } }
            ]
        }));
    }

    const [clients, totalCount] = await prisma.$transaction([
        prisma.client.findMany({
            where,
            skip: (pageNum - 1) * limitNum,
            take: limitNum,
            orderBy: { name: 'asc' },
            include: {
                cards: {
                    include: {
                        template: {
                            include: {
                                stampZones: true
                            }
                        }
                    }
                },
                variableValues: {
                    select: { variableId: true, value: true },
                },
            }
        }),
        prisma.client.count({ where }),
    ]);

    return {
        data: clients,
        pagination: {
            totalCount,
            currentPage: pageNum,
            pageSize: limitNum,
            totalPages: Math.ceil(totalCount / limitNum)
        },
    };
}

async function createClient(companyId, clientData) {
    const { name, phoneNumber, address } = clientData;
    const nameSearchable = _normalizeString(name);

    return prisma.client.create({
        data: {
            companyId,
            name,
            phoneNumber,
            address,
            nameSearchable,
        }
    });
}

async function updateClient(clientId, companyId, updateData) {
    const { name, phoneNumber, address, iban } = updateData;
    const dataToUpdate = { name, phoneNumber, address, iban };

    if (name) {
        dataToUpdate.nameSearchable = _normalizeString(name);
    }

    const result = await prisma.client.updateMany({
        where: { id: clientId, companyId: companyId },
        data: dataToUpdate,
    });

    if (result.count === 0) {
        throw new Error("Client non trouvé ou non associé à cette entreprise.");
    }
    return prisma.client.findUnique({ where: { id: clientId } });
}

async function getClientDetails(clientId, companyId) {
    const client = await prisma.client.findFirst({
        where: { id: clientId, companyId: companyId },
        include: {
            bills: { where: { NOT: { status: 'CANCELED' } }, orderBy: { date: 'desc' } },
            cards: true,
        },
    });
    if (!client) throw new Error("Client non trouvé.");
    return client;
}

// --- Fonctions de Fidélité ---

async function getFidelityTemplate(companyId) {
    const template = await prisma.fidelityCardTemplate.findFirst({
        where: { companyId, isActive: true },
        include: { stampZones: { orderBy: { order: 'asc' } } }
    });
    return template;
}

async function setupFidelityTemplate(companyId, setupData, images) {
    const { baseImage, stampImage } = images;

    // --- VALIDATION CORRIGÉE ---
    if (!setupData || (!setupData.baseImageId && !baseImage) || (!setupData.stampImageId && !stampImage)) {
        throw new Error("Données incomplètes. Au moins une image existante ou un nouveau fichier est requis pour chaque type.");
    }

    return prisma.$transaction(async (tx) => {
        // Si on active ce modèle, on désactive tous les autres
        await tx.fidelityCardTemplate.updateMany({
            where: { companyId, NOT: { name: setupData.name } },
            data: { isActive: false }
        });

        // On regarde si le modèle existe déjà pour connaître son état isActive actuel
        const existing = await tx.fidelityCardTemplate.findUnique({
            where: { companyId_name: { companyId, name: setupData.name } }
        });

        // Par défaut on active si nouveau, sinon on respecte l'état actuel (pour éviter de réactiver un modèle qu'on vient de couper)
        const targetActive = existing ? existing.isActive : true;

        const templateData = {
            companyId,
            name: setupData.name,
            isActive: targetActive,
            baseImageId: baseImage?.publicId || setupData.baseImageId,
            stampImageId: stampImage?.publicId || setupData.stampImageId,
        };

        const createdOrUpdatedTemplate = await tx.fidelityCardTemplate.upsert({
            where: { companyId_name: { companyId, name: setupData.name } },
            update: templateData,
            create: templateData,
        });

        await tx.fidelityStampZone.deleteMany({ where: { templateId: createdOrUpdatedTemplate.id } });
        await tx.fidelityStampZone.createMany({
            data: setupData.zones.map(zone => ({ x: zone.x, y: zone.y, order: zone.order, templateId: createdOrUpdatedTemplate.id }))
        });

        return tx.fidelityCardTemplate.findUnique({
            where: { id: createdOrUpdatedTemplate.id },
            include: { stampZones: true }
        });
    });
}

async function createOrResetCard(companyId, clientId, performedByUserId) {
    const template = await prisma.fidelityCardTemplate.findFirst({
        where: { companyId, isActive: true }
    });
    if (!template) throw new Error("Aucun modèle de carte actif pour cette entreprise.");

    const existingCard = await prisma.fidelityCard.findFirst({
        where: { clientId, templateId: template.id },
        orderBy: { createdAt: 'desc' }
    });

    if (existingCard) {
        return renewFidelityCard(existingCard.id, companyId, performedByUserId);
    }

    return createCardForClient({
        companyId,
        clientId,
        templateId: template.id,
        performedByUserId
    });
}

async function createCardForClient({ companyId, clientId, templateId, performedByUserId }) {
    return prisma.$transaction(async (tx) => {
        // 1. Vérifier que le template appartient bien à la company
        const template = await tx.fidelityCardTemplate.findFirst({
            where: { id: templateId, companyId, isActive: true },
            include: { stampZones: true },
        });
        if (!template) throw new Error("Modèle introuvable ou inactif.");

        // 2. Vérifier que le client appartient bien à la company
        const client = await tx.client.findFirst({
            where: { id: clientId, companyId },
        });
        if (!client) throw new Error("Client introuvable pour cette entreprise.");

        // 3. Créer la carte
        const card = await tx.fidelityCard.create({
            data: {
                clientId,
                templateId,
                publicLink: crypto.randomBytes(6).toString('hex'),
                stampCount: 0,
                status: 'ACTIVE',
            }
        });

        // 4. Historique : création
        await tx.fidelityCardHistory.create({
            data: {
                cardId: card.id,
                performedByUserId,
                actionType: 'CARD_CREATED',
                beforeStampCount: null,
                afterStampCount: 0,
                beforeStatus: null,
                afterStatus: 'ACTIVE',
                comment: null,
            }
        });

        return card;
    });
}


async function addStampToCard({ cardId, publicLink, performedByUserId }) {
    return prisma.$transaction(async (tx) => {
        const where = cardId ? { id: cardId } : { publicLink };
        const card = await tx.fidelityCard.findUnique({
            where,
            include: {
                template: {
                    include: { stampZones: true }
                }
            }
        });

        if (!card) throw new Error("Carte introuvable.");

        if (!card.template.isActive) {
            throw new Error("Carte désactivée (global)");
        }

        const maxStamps = card.template.stampZones.length;

        if (card.status === 'COMPLETED') {
            const updated = await tx.fidelityCard.update({
                where: { id: card.id },
                data: {
                    stampCount: 1,
                    status: 'ACTIVE',
                    completedAt: null,
                }
            });

            await tx.fidelityCardHistory.create({
                data: {
                    cardId: card.id,
                    performedByUserId,
                    actionType: 'STATUS_CHANGED',
                    beforeStampCount: card.stampCount,
                    afterStampCount: 1,
                    beforeStatus: card.status,
                    afterStatus: 'ACTIVE',
                    comment: 'Nouveau cycle de fidélité démarré.',
                }
            });

            return {
                isFull: updated.stampCount >= maxStamps,
                stampCount: updated.stampCount,
                maxStamps,
                status: updated.status,
            };
        }

        if (card.stampCount >= maxStamps) {
            // Marquer comme complétée si pas déjà fait
            if (card.status !== 'COMPLETED') {
                const updated = await tx.fidelityCard.update({
                    where: { id: card.id },
                    data: {
                        status: 'COMPLETED',
                        completedAt: new Date(),
                    }
                });

                await tx.fidelityCardHistory.create({
                    data: {
                        cardId: card.id,
                        performedByUserId,
                        actionType: 'STATUS_CHANGED',
                        beforeStampCount: card.stampCount,
                        afterStampCount: card.stampCount,
                        beforeStatus: card.status,
                        afterStatus: 'COMPLETED',
                        comment: 'Carte complétée lors d\'une tentative de tampon supplémentaire.',
                    }
                });

                return {
                    isFull: true,
                    stampCount: updated.stampCount,
                    maxStamps,
                    status: updated.status,
                };
            }

            // déjà complète
            return {
                isFull: true,
                stampCount: card.stampCount,
                maxStamps,
                status: card.status,
            };
        }

        // Incrément normal
        const updated = await tx.fidelityCard.update({
            where: { id: card.id },
            data: {
                stampCount: { increment: 1 }
            }
        });

        await tx.fidelityCardHistory.create({
            data: {
                cardId: card.id,
                performedByUserId,
                actionType: 'STAMP_ADDED',
                beforeStampCount: card.stampCount,
                afterStampCount: card.stampCount + 1,
                beforeStatus: card.status,
                afterStatus: card.status,
                comment: null,
            }
        });

        // On renvoie aussi maxStamps pour l’UI
        return {
            isFull: updated.stampCount >= maxStamps,
            stampCount: updated.stampCount,
            maxStamps,
            status: updated.status,
        };
    });
}

async function setCardStatus({ cardId, newStatus, performedByUserId, comment }) {
    return prisma.$transaction(async (tx) => {
        const card = await tx.fidelityCard.findUnique({ where: { id: cardId } });
        if (!card) throw new Error("Carte introuvable.");

        if (newStatus === 'DISABLED' && !comment?.trim()) {
            throw new Error("Un commentaire est obligatoire pour désactiver une carte.");
        }

        const updated = await tx.fidelityCard.update({
            where: { id: cardId },
            data: {
                status: newStatus,
                deactivatedAt: newStatus === 'DISABLED' ? new Date() : card.deactivatedAt,
                completedAt: newStatus === 'COMPLETED' ? new Date() : card.completedAt,
            }
        });

        await tx.fidelityCardHistory.create({
            data: {
                cardId: cardId,
                performedByUserId,
                actionType: 'STATUS_CHANGED',
                beforeStampCount: card.stampCount,
                afterStampCount: updated.stampCount,
                beforeStatus: card.status,
                afterStatus: updated.status,
                comment: comment || null,
            }
        });

        return updated;
    });
}

async function setCardStampCount({ cardId, newStampCount, performedByUserId, comment }) {
    return prisma.$transaction(async (tx) => {
        const card = await tx.fidelityCard.findUnique({
            where: { id: cardId },
            include: { template: { include: { stampZones: true } } }
        });
        if (!card) throw new Error("Carte introuvable.");

        const maxStamps = card.template.stampZones.length;
        if (newStampCount < 0 || newStampCount > maxStamps) {
            throw new Error(`Le nombre de tampons doit être compris entre 0 et ${maxStamps}.`);
        }

        const updated = await tx.fidelityCard.update({
            where: { id: cardId },
            data: {
                stampCount: newStampCount,
            }
        });

        await tx.fidelityCardHistory.create({
            data: {
                cardId,
                performedByUserId,
                actionType: 'MANUAL_ADJUSTMENT',
                beforeStampCount: card.stampCount,
                afterStampCount: newStampCount,
                beforeStatus: card.status,
                afterStatus: updated.status,
                comment: comment || null,
            }
        });

        return updated;
    });
}


async function addStamp(publicLink) {
    // 1. Charger la carte + le client + l'entreprise
    const card = await prisma.fidelityCard.findUnique({
        where: { publicLink },
        include: {
            client: true
        }
    });

    if (!card) throw new Error("Carte introuvable.");

    return addStampToCard({ publicLink, performedByUserId: null });
}

async function deleteFidelityCard(cardId, companyId, performedByUserId) {
    return prisma.$transaction(async (tx) => {
        const card = await tx.fidelityCard.findFirst({
            where: { id: cardId, client: { companyId } }
        });

        if (!card) throw new Error("Carte introuvable ou accès refusé.");

        // Supprimer l'historique car pas de cascade auto dans le schéma pour cette relation
        await tx.fidelityCardHistory.deleteMany({ where: { cardId } });

        return tx.fidelityCard.delete({ where: { id: cardId } });
    });
}

async function setTemplateActive(companyId, templateId, isActive) {
    return prisma.$transaction(async (tx) => {
        // Si on active (isActive = true), on désactive d'abord tous les autres templates de la company.
        if (isActive) {
            await tx.fidelityCardTemplate.updateMany({
                where: { companyId, NOT: { id: templateId } },
                data: { isActive: false }
            });
        }

        return tx.fidelityCardTemplate.update({
            where: { id: templateId, companyId },
            data: { isActive }
        });
    });
}

async function getCardLastHistory(cardId) {
    return prisma.fidelityCardHistory.findFirst({
        where: { cardId },
        orderBy: { createdAt: 'desc' },
        include: { performedBy: { select: { name: true } } }
    });
}

async function renewFidelityCard(cardId, companyId, performedByUserId) {
    return prisma.$transaction(async (tx) => {
        const card = await tx.fidelityCard.findFirst({
            where: { id: cardId, client: { companyId } }
        });
        if (!card) throw new Error("Carte introuvable.");

        const oldCount = card.stampCount;
        const oldStatus = card.status;

        const updated = await tx.fidelityCard.update({
            where: { id: cardId },
            data: {
                stampCount: 0,
                status: 'ACTIVE',
                completedAt: null
            }
        });

        await tx.fidelityCardHistory.create({
            data: {
                cardId,
                performedByUserId,
                actionType: 'STATUS_CHANGED',
                beforeStampCount: oldCount,
                afterStampCount: 0,
                beforeStatus: oldStatus,
                afterStatus: 'ACTIVE',
                comment: 'Carte renouvelée manuellement.',
            }
        });

        return updated;
    });
}

async function serveCardImage(publicLink) {
    const card = await prisma.fidelityCard.findUnique({
        where: { publicLink },
        include: {
            template: {
                include: { stampZones: { orderBy: { order: 'asc' } } }
            }
        }
    });
    if (!card) throw new Error("Carte non trouvée.");

    const template = card.template;
    if (!template) throw new Error("Modèle de carte introuvable.");

    const baseImage = await prisma.image.findUnique({ where: { publicId: template.baseImageId } });
    const stampImage = await prisma.image.findUnique({ where: { publicId: template.stampImageId } });

    const basePath = path.join(UPLOADS_DIR, baseImage.filename);
    const stampPath = path.join(UPLOADS_DIR, stampImage.filename);

    const STAMP_SIZE = 50;
    const resizedStampBuffer = await sharp(stampPath).resize(STAMP_SIZE, STAMP_SIZE).toBuffer();

    const composites = template.stampZones
        .slice(0, card.stampCount)
        .map(zone => ({
            input: resizedStampBuffer,
            top: Math.round(zone.y - (STAMP_SIZE / 2)),
            left: Math.round(zone.x - (STAMP_SIZE / 2)),
        }));

    return sharp(basePath).composite(composites).png().toBuffer();
}


const { buildEffectiveCompanyPermissions } = require('../../middleware/auth');

// ============================================================
// HELPERS VARIABLES
// ============================================================

function _slugify(input) {
    return String(input || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        || 'variable';
}

function _uniqInts(arr) {
    if (!Array.isArray(arr)) return [];
    const out = [];
    const seen = new Set();
    for (const v of arr) {
        const n = Number(v);
        if (!Number.isSafeInteger(n) || n <= 0) continue;
        if (seen.has(n)) continue;
        seen.add(n);
        out.push(n);
    }
    return out;
}

function _isWildcard(permsSet, companyId) {
    if (!permsSet || typeof permsSet.has !== 'function') return false;
    return permsSet.has(`COMPANY.${companyId}.*`) || permsSet.has('ADMIN.*');
}

async function _getUserRankIdForCompany(userId, companyId) {
    const employment = await prisma.companyEmployee.findUnique({
        where: { companyId_userId: { companyId, userId } },
        select: { rankId: true, status: true },
    });
    if (employment?.status === 'ACTIVE' && employment.rankId) return employment.rankId;
    return null;
}

/**
 * Vérifie si un utilisateur a accès en écriture à une variable donnée.
 * Règles : wildcard OU userId dans access USER OU rankId dans access RANK
 */
async function _canEditVariable(variableId, userId, companyId) {
    const permsSet = await buildEffectiveCompanyPermissions(userId, companyId);
    if (_isWildcard(permsSet, companyId)) return true;
    if (permsSet.has('clients.variables.manage')) return true;

    const accesses = await prisma.clientVariableAccess.findMany({
        where: { variableId },
    });

    // Check user direct
    if (accesses.some(a => a.kind === 'USER' && a.userId === userId)) return true;

    // Check rank
    const rankId = await _getUserRankIdForCompany(userId, companyId);
    if (rankId && accesses.some(a => a.kind === 'RANK' && a.rankId === rankId)) return true;

    return false;
}

// ============================================================
// VARIABLES — CRUD
// ============================================================

async function listVariables(companyId) {
    return prisma.clientVariable.findMany({
        where: { companyId },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        include: {
            accesses: {
                include: {
                    user: { select: { id: true, name: true } },
                    rank: { select: { id: true, name: true } },
                },
            },
        },
    });
}

async function createVariable(companyId, { 
    label, 
    type = 'BOOLEAN', 
    config = {}, 
    order = 0,
    showInPerks = false,
    showInCatalog = false,
    perksDescription = '',
    perksPrice = null,
    perksPriceDuration = '',
    perksIconUrl = null
}) {
    if (!label?.trim()) throw new Error('Le libellé est requis.');
    const slug = _slugify(label);

    const existing = await prisma.clientVariable.findUnique({
        where: { companyId_slug: { companyId, slug } },
    });
    if (existing) throw new Error(`Une variable avec le slug "${slug}" existe déjà.`);

    const validTypes = ['BOOLEAN', 'TEXT'];
    if (!validTypes.includes(type)) throw new Error('Type invalide (BOOLEAN ou TEXT).');

    return prisma.clientVariable.create({
        data: { 
            companyId, 
            slug, 
            label: label.trim(), 
            type, 
            config, 
            order,
            showInPerks: Boolean(showInPerks),
            showInCatalog: Boolean(showInCatalog),
            perksDescription: perksDescription ?? null,
            perksPrice: perksPrice !== null && perksPrice !== '' ? Number(perksPrice) : null,
            perksPriceDuration: perksPriceDuration ?? null,
            perksIconUrl: perksIconUrl ?? null
        },
        include: { accesses: true },
    });
}

async function updateVariable(companyId, variableId, { 
    label, config, order, type, 
    showInPerks, showInCatalog, 
    perksDescription, perksPrice, 
    perksPriceDuration, 
    perksIconUrl 
}) {
    const variable = await prisma.clientVariable.findFirst({
        where: { id: variableId, companyId },
    });
    if (!variable) throw new Error('Variable introuvable.');

    const data = {};
    if (label !== undefined) {
        if (!label?.trim()) throw new Error('Le libellé ne peut pas être vide.');
        data.label = label.trim();
    }
    if (config !== undefined) data.config = config;
    if (order !== undefined) data.order = Number(order) || 0;
    if (type !== undefined) {
        const validTypes = ['BOOLEAN', 'TEXT'];
        if (!validTypes.includes(type)) throw new Error('Type invalide.');
        data.type = type;
    }
    if (showInPerks !== undefined) data.showInPerks = Boolean(showInPerks);
    if (showInCatalog !== undefined) data.showInCatalog = Boolean(showInCatalog);
    if (perksDescription !== undefined) data.perksDescription = perksDescription ?? null;
    if (perksPrice !== undefined) data.perksPrice = perksPrice !== null && perksPrice !== '' ? Number(perksPrice) : null;
    if (perksPriceDuration !== undefined) data.perksPriceDuration = perksPriceDuration ?? null;
    if (perksIconUrl !== undefined) data.perksIconUrl = perksIconUrl ?? null;

    return prisma.clientVariable.update({
        where: { id: variableId },
        data,
        include: { accesses: true },
    });
}

async function deleteVariable(companyId, variableId) {
    const variable = await prisma.clientVariable.findFirst({
        where: { id: variableId, companyId },
    });
    if (!variable) throw new Error('Variable introuvable.');

    // Delete image if exists
    const image = await prisma.image.findFirst({
        where: { ownerType: 'CLIENT_VARIABLE', ownerId: variableId }
    });

    if (image) {
        const filePath = path.join(__dirname, '..', '..', '..', 'uploads', 'images', image.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        await prisma.image.delete({ where: { id: image.id } });
    }

    await prisma.$transaction([
        prisma.clientVariableAccess.deleteMany({ where: { variableId } }),
        prisma.clientVariableValue.deleteMany({ where: { variableId } }),
        prisma.clientVariable.delete({ where: { id: variableId } }),
    ]);

    return true;
}

// ============================================================
// VARIABLES — ACL (Accès en écriture)
// ============================================================

async function getRanksForCompany(companyId) {
    return prisma.rank.findMany({
        where: { companyId },
        select: { id: true, name: true, position: true },
        orderBy: { position: 'asc' },
    });
}

async function updateVariableAccess(companyId, variableId, { userIds = [], rankIds = [] }) {
    const variable = await prisma.clientVariable.findFirst({
        where: { id: variableId, companyId },
    });
    if (!variable) throw new Error('Variable introuvable.');

    const cleanUserIds = _uniqInts(userIds);
    const cleanRankIds = _uniqInts(rankIds);

    await prisma.$transaction(async (tx) => {
        await tx.clientVariableAccess.deleteMany({ where: { variableId } });

        const data = [];
        for (const uid of cleanUserIds) data.push({ variableId, kind: 'USER', userId: uid });
        for (const rid of cleanRankIds) data.push({ variableId, kind: 'RANK', rankId: rid });

        if (data.length > 0) {
            await tx.clientVariableAccess.createMany({ data });
        }
    });

    return prisma.clientVariable.findUnique({
        where: { id: variableId },
        include: {
            accesses: {
                include: {
                    user: { select: { id: true, name: true } },
                    rank: { select: { id: true, name: true } },
                },
            },
        },
    });
}

// ============================================================
// VARIABLES — VALEURS PAR CLIENT
// ============================================================

async function getClientVariableValues(companyId, clientId) {
    // Récupère toutes les variables de la company + la valeur du client (peut être null)
    const variables = await prisma.clientVariable.findMany({
        where: { companyId },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        include: {
            values: {
                where: { clientId },
            },
        },
    });

    return variables.map(v => ({
        id: v.id,
        slug: v.slug,
        label: v.label,
        type: v.type,
        config: v.config,
        value: v.values[0]?.value ?? null,
        updatedAt: v.values[0]?.updatedAt ?? null,
    }));
}

async function setClientVariableValue(companyId, clientId, variableId, value, performedByUserId) {
    const variable = await prisma.clientVariable.findFirst({
        where: { id: variableId, companyId },
    });
    if (!variable) throw new Error('Variable introuvable.');

    // Vérifier que le client appartient à la company
    const client = await prisma.client.findFirst({ where: { id: clientId, companyId } });
    if (!client) throw new Error('Client introuvable.');

    // Vérifier les droits
    const canEdit = await _canEditVariable(variableId, performedByUserId, companyId);
    if (!canEdit) throw new Error('Permission refusée pour modifier cette variable.');

    // Upsert
    return prisma.clientVariableValue.upsert({
        where: { variableId_clientId: { variableId, clientId } },
        update: { value: value ?? null, updatedByUserId: performedByUserId },
        create: { variableId, clientId, value: value ?? null, updatedByUserId: performedByUserId },
    });
}

async function getVariablesWithValuesForClients(companyId, clientIds) {
    if (!clientIds?.length) return { variables: [], valuesByClient: {} };

    const [variables, values] = await Promise.all([
        prisma.clientVariable.findMany({
            where: { companyId },
            orderBy: [{ order: 'asc' }, { id: 'asc' }],
            select: { id: true, slug: true, label: true, type: true, config: true, order: true },
        }),
        prisma.clientVariableValue.findMany({
            where: { clientId: { in: clientIds }, variable: { companyId } },
            select: { clientId: true, variableId: true, value: true },
        }),
    ]);

    // Grouper par clientId
    const valuesByClient = {};
    for (const v of values) {
        if (!valuesByClient[v.clientId]) valuesByClient[v.clientId] = {};
        valuesByClient[v.clientId][v.variableId] = v.value;
    }

    return { variables, valuesByClient };
}

/**
 * Retourne tous les avantages (perks) actifs pour un user connecté.
 * Un perk est actif si :
 *   - le user a un client lié (client.userId = userId)
 *   - ce client a une valeur pour une ClientVariable ayant showInPerks = true
 *   - pour BOOLEAN : la valeur est "true"
 *   - pour TEXT : la valeur est non-nulle et non-vide
 */
async function getMyPerks(userId) {
    // 1. Trouver tous les clients liés à cet user
    const clients = await prisma.client.findMany({
        where: { userId },
        select: {
            id: true,
            name: true,
            companyId: true,
            company: { select: { id: true, name: true } },
            cards: {
                where: { status: 'ACTIVE' },
                select: { id: true, stampCount: true, publicLink: true, template: { select: { id: true, name: true, stampZones: { select: { id: true } } } } },
                take: 1,
                orderBy: { createdAt: 'desc' },
            },
            variableValues: {
                select: {
                    variableId: true,
                    value: true,
                    variable: {
                        select: {
                            id: true,
                            slug: true,
                            label: true,
                            type: true,
                            config: true,
                            showInPerks: true,
                            perksDescription: true,
                            perksIconUrl: true,
                        },
                    },
                },
                where: {
                    variable: { showInPerks: true },
                },
            },
        },
    });

    const perks = [];

    for (const client of clients) {
        for (const vv of client.variableValues) {
            const { variable, value } = vv;
            if (!variable.showInPerks) continue;

            // Condition d'activation
            let isActive = false;
            if (variable.type === 'BOOLEAN') {
                isActive = value === 'true';
            } else {
                // TEXT : actif si valeur non nulle/vide
                isActive = value !== null && value !== undefined && value.trim() !== '';
            }

            if (!isActive) continue;

            perks.push({
                clientId: client.id,
                clientName: client.name,
                company: client.company,
                variable: {
                    id: variable.id,
                    slug: variable.slug,
                    label: variable.label,
                    type: variable.type,
                    config: variable.config,
                    perksDescription: variable.perksDescription,
                    perksIconUrl: variable.perksIconUrl,
                },
                value,
                // Carte de fidélité active (si existe)
                fidelityCard: client.cards[0] ?? null,
            });
        }
    }

    return perks;
}

/**
 * Retourne le catalogue complet de tous les avantages disponibles dans toutes les compagnies.
 */
async function getAllPerksCatalog() {
    const variables = await prisma.clientVariable.findMany({
        where: { showInCatalog: true },
        select: {
            id: true,
            slug: true,
            label: true,
            type: true,
            config: true,
            perksDescription: true,
            perksPrice: true,
            perksPriceDuration: true,
            perksIconUrl: true,
            company: {
                select: {
                    id: true,
                    name: true,
                }
            }
        },
        orderBy: [
            { company: { name: 'asc' } },
            { order: 'asc' },
        ]
    });
    
    return variables;
}

module.exports = {
    _normalizeString,
    listClients,
    createClient,
    updateClient,
    getClientDetails,
    getFidelityTemplate,
    setupFidelityTemplate,
    createOrResetCard,
    addStamp,
    addStampToCard,
    setCardStampCount,
    serveCardImage,
    createCardForClient,
    deleteFidelityCard,
    setTemplateActive,
    getCardLastHistory,
    renewFidelityCard,
    setCardStatus,
    // Variables
    listVariables,
    createVariable,
    updateVariable,
    deleteVariable,
    getRanksForCompany,
    updateVariableAccess,
    getClientVariableValues,
    setClientVariableValue,
    getVariablesWithValuesForClients,
    // Perks
    getMyPerks,
    getAllPerksCatalog,
};