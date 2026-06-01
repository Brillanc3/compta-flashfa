// /backend/src/modules/contracts/contracts.service.js

/**
 * Service du module Contracts
 * -----------------------------------------------------------
 * Centralise toute la logique métier :
 *  - gestion des templates Markdown
 *  - gestion des articles
 *  - assignation de contrats
 *  - consultation personnelle & entreprise
 *  - signature & refus
 *  - rendu Markdown final
 */

const crypto = require("crypto");
const bcrypt = require("bcrypt");
const prisma = require("../../db");
const { createNotification } = require("../../services/notificationService");

const SHARE_BCRYPT_ROUNDS = 10;
const CONTRACT_CONFIRMATION_TEXT = "Lu et approuvé";
const CONTRACT_SIGNATURE_ROLES = {
    SENDER: "SENDER",
    RECIPIENT: "RECIPIENT"
};
const CONTRACT_SIGNATURE_ROLE_ORDER = {
    [CONTRACT_SIGNATURE_ROLES.SENDER]: 0,
    [CONTRACT_SIGNATURE_ROLES.RECIPIENT]: 1
};


function generateFieldKey(label) {
    return label
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function generatePublicShareId() {
    return crypto.randomBytes(24).toString("hex");
}

function parseContractFieldValues(fieldValues) {
    if (!fieldValues) return {};

    if (typeof fieldValues === "string") {
        try {
            const parsed = JSON.parse(fieldValues);
            return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
        } catch {
            return {};
        }
    }

    if (typeof fieldValues === "object" && !Array.isArray(fieldValues)) {
        return fieldValues;
    }

    return {};
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyFieldValuesToMarkdown(markdown, fieldValues) {
    let resolvedMarkdown = typeof markdown === "string" ? markdown : "";
    if (!resolvedMarkdown) return "";

    const parsedFieldValues = parseContractFieldValues(fieldValues);

    for (const [key, rawValue] of Object.entries(parsedFieldValues)) {
        if (key === "_system") continue;

        const value = rawValue === null || rawValue === undefined ? "" : String(rawValue);
        resolvedMarkdown = resolvedMarkdown.replace(
            new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, "g"),
            value
        );
    }

    return resolvedMarkdown;
}

function hasRemainingPlaceholders(markdown) {
    return typeof markdown === "string" && /\{\{\s*[^}]+\s*\}\}/.test(markdown);
}

function resolveAssignedContractSnapshot(assignedContract) {
    const snapshotTitle = assignedContract?.snapshotTitle?.trim()
        || assignedContract?.template?.title
        || null;

    let snapshotMarkdown = applyFieldValuesToMarkdown(
        assignedContract?.snapshotMarkdown,
        assignedContract?.fieldValues
    );

    if ((!snapshotMarkdown || hasRemainingPlaceholders(snapshotMarkdown)) && assignedContract?.template?.content) {
        snapshotMarkdown = renderContractMarkdown({
            template: {
                content: assignedContract.template.content,
                articles: assignedContract.template.articles || []
            },
            fieldValues: assignedContract.fieldValues
        });
    }

    return {
        snapshotTitle,
        snapshotMarkdown: snapshotMarkdown || null
    };
}

async function hydrateAssignedContractsSnapshots(contracts, tx = prisma) {
    const normalizedContracts = Array.isArray(contracts) ? contracts.filter(Boolean) : [];
    const updates = [];

    const hydratedContracts = normalizedContracts.map((contract) => {
        const resolvedSnapshot = resolveAssignedContractSnapshot(contract);

        if (
            contract?.id
            && resolvedSnapshot.snapshotMarkdown
            && (
                resolvedSnapshot.snapshotTitle !== contract.snapshotTitle
                || resolvedSnapshot.snapshotMarkdown !== contract.snapshotMarkdown
            )
        ) {
            updates.push(
                tx.assignedContract.update({
                    where: { id: contract.id },
                    data: {
                        snapshotTitle: resolvedSnapshot.snapshotTitle,
                        snapshotMarkdown: resolvedSnapshot.snapshotMarkdown
                    }
                })
            );
        }

        return {
            ...contract,
            snapshotTitle: resolvedSnapshot.snapshotTitle,
            snapshotMarkdown: resolvedSnapshot.snapshotMarkdown
        };
    });

    if (updates.length) {
        await Promise.all(updates);
    }

    return hydratedContracts;
}


function createHttpError(message, statusCode = 400, details = null) {
    const error = new Error(message);
    error.statusCode = statusCode;
    if (details) {
        error.details = details;
    }
    return error;
}

function normalizeConfirmationText(confirmationText) {
    const normalized = typeof confirmationText === "string"
        ? confirmationText.trim().replace(/\s+/g, " ")
        : "";

    if (normalized !== CONTRACT_CONFIRMATION_TEXT) {
        throw createHttpError(`La phrase de confirmation doit être exactement : "${CONTRACT_CONFIRMATION_TEXT}".`, 400);
    }

    return normalized;
}

function sanitizeIpAddress(ipAddress) {
    if (typeof ipAddress !== "string") return null;
    const candidate = ipAddress.split(",")[0].trim();
    if (!candidate) return null;
    return candidate.slice(0, 45);
}

function sanitizeUserAgent(userAgent) {
    if (typeof userAgent !== "string") return null;
    const normalized = userAgent.trim();
    if (!normalized) return null;
    return normalized.slice(0, 2048);
}

function serializeUserLite(user) {
    if (!user) return null;

    return {
        id: user.id,
        name: user.name,
        username: user.username ?? null,
        imageUrl: user.imageUrl ?? null,
        status: user.status ?? null,
        characterId: user.characterId ?? null
    };
}

function serializeContractSignature(signature) {
    if (!signature) return null;

    return {
        id: signature.id,
        role: signature.role,
        signedAt: signature.signedAt,
        confirmationText: signature.confirmationText,
        signerUserId: signature.signerUserId,
        signatureVersionId: signature.signatureVersionId ?? null,
        signatureSvgSnapshot: signature.signatureSvgSnapshot ?? null,
        signerNameSnapshot: signature.signerNameSnapshot ?? null,
        signerIpAddress: signature.signerIpAddress ?? null,
        signerUserAgent: signature.signerUserAgent ?? null,
        signerUser: serializeUserLite(signature.signerUser),
        signatureVersion: signature.signatureVersion
            ? {
                id: signature.signatureVersion.id,
                createdAt: signature.signatureVersion.createdAt
            }
            : null
    };
}

function sortSerializedContractSignatures(signatures) {
    return [...(Array.isArray(signatures) ? signatures : [])].sort((a, b) => {
        const left = CONTRACT_SIGNATURE_ROLE_ORDER[a?.role] ?? 99;
        const right = CONTRACT_SIGNATURE_ROLE_ORDER[b?.role] ?? 99;

        if (left !== right) {
            return left - right;
        }

        const leftTime = a?.signedAt ? new Date(a.signedAt).getTime() : 0;
        const rightTime = b?.signedAt ? new Date(b.signedAt).getTime() : 0;

        return leftTime - rightTime;
    });
}

function buildContractSignatureState(contract) {
    const signatures = sortSerializedContractSignatures(
        (contract?.signatures || []).map(serializeContractSignature)
    );

    const senderSignature = signatures.find((item) => item.role === CONTRACT_SIGNATURE_ROLES.SENDER) || null;
    const recipientSignature = signatures.find((item) => item.role === CONTRACT_SIGNATURE_ROLES.RECIPIENT) || null;
    const completedCount = Number(Boolean(senderSignature)) + Number(Boolean(recipientSignature));

    return {
        signatures,
        senderSignature,
        recipientSignature,
        signature: recipientSignature || senderSignature || null,
        signingProgress: {
            totalRequired: 2,
            completedCount,
            remainingCount: Math.max(0, 2 - completedCount),
            isSenderSigned: Boolean(senderSignature),
            isRecipientSigned: Boolean(recipientSignature),
            isFullySigned: Boolean(senderSignature && recipientSignature)
        }
    };
}

function getUserContractRoles(contract, userId) {
    const normalizedUserId = Number(userId);
    const roles = [];

    if (Number(contract?.senderUserId) === normalizedUserId) {
        roles.push(CONTRACT_SIGNATURE_ROLES.SENDER);
    }

    if (Number(contract?.assignedToUserId) === normalizedUserId) {
        roles.push(CONTRACT_SIGNATURE_ROLES.RECIPIENT);
    }

    return roles;
}

function resolveSigningRole(contract, userId, requestedRole = null) {
    const allowedRoles = getUserContractRoles(contract, userId);

    if (!allowedRoles.length) {
        throw createHttpError("Vous n'êtes pas autorisé à signer ce contrat.", 403);
    }

    const existingRoles = new Set((contract?.signatures || []).map((item) => item.role));

    if (requestedRole) {
        const normalizedRole = String(requestedRole).trim().toUpperCase();

        if (!Object.values(CONTRACT_SIGNATURE_ROLES).includes(normalizedRole)) {
            throw createHttpError("Le rôle de signature demandé est invalide.", 400);
        }

        if (!allowedRoles.includes(normalizedRole)) {
            throw createHttpError("Vous ne pouvez pas signer ce contrat avec ce rôle.", 403);
        }

        return normalizedRole;
    }

    const remainingRoles = allowedRoles.filter((role) => !existingRoles.has(role));

    if (remainingRoles.includes(CONTRACT_SIGNATURE_ROLES.RECIPIENT)) {
        return CONTRACT_SIGNATURE_ROLES.RECIPIENT;
    }

    if (remainingRoles.includes(CONTRACT_SIGNATURE_ROLES.SENDER)) {
        return CONTRACT_SIGNATURE_ROLES.SENDER;
    }

    return allowedRoles.includes(CONTRACT_SIGNATURE_ROLES.RECIPIENT)
        ? CONTRACT_SIGNATURE_ROLES.RECIPIENT
        : allowedRoles[0];
}

function buildAssignedContractPayload(contract, currentUserId = null) {
    const resolvedSnapshot = resolveAssignedContractSnapshot(contract);
    const signatureState = buildContractSignatureState(contract);
    const currentUserRoles = currentUserId ? getUserContractRoles(contract, currentUserId) : [];
    const signedRoles = new Set(signatureState.signatures.map((item) => item.role));
    const canCurrentUserSign = contract?.status === "PENDING"
        && currentUserRoles.some((role) => !signedRoles.has(role));

    return {
        id: contract.id,
        assignedAt: contract.assignedAt,
        signedAt: contract.signedAt,
        refusedAt: contract.refusedAt,
        refusalReason: contract.refusalReason,
        publicUuid: contract.publicUuid ?? null,
        publicEnabledAt: contract.publicEnabledAt ?? null,
        publicRevokedAt: contract.publicRevokedAt ?? null,
        status: contract.status,
        fieldValues: contract.fieldValues,
        templateId: contract.templateId,
        assignedToUserId: contract.assignedToUserId,
        senderUserId: contract.senderUserId ?? null,
        generatedCompanyId: contract.generatedCompanyId ?? null,
        modifiesCompanyId: contract.modifiesCompanyId ?? null,
        generatedCompanyNameSnapshot: contract.generatedCompanyNameSnapshot ?? null,
        modifiesCompanyNameSnapshot: contract.modifiesCompanyNameSnapshot ?? null,
        snapshotTitle: resolvedSnapshot.snapshotTitle,
        snapshotMarkdown: resolvedSnapshot.snapshotMarkdown,
        backgroundImageUrl: contract?.template?.backgroundImageUrl ?? null,
        assignedToUser: serializeUserLite(contract.assignedToUser),
        senderUser: serializeUserLite(contract.senderUser),
        template: contract.template
            ? {
                id: contract.template.id,
                title: resolvedSnapshot.snapshotTitle || contract.template.title || null,
                markdown: resolvedSnapshot.snapshotMarkdown,
                content: contract.template.content ?? null,
                backgroundImageUrl: contract.template.backgroundImageUrl ?? null,
                type: contract.template.type ?? null,
                ownerUserId: contract.template.ownerUserId ?? null,
                companyId: contract.template.companyId ?? null,
                createdAt: contract.template.createdAt ?? null,
                updatedAt: contract.template.updatedAt ?? null
            }
            : null,
        currentUserRoles,
        currentUserRole: currentUserRoles[0] || null,
        canCurrentUserSign,
        ...signatureState
    };
}

const ASSIGNED_CONTRACT_SIGNATURES_INCLUDE = {
    orderBy: [
        { signedAt: "asc" },
        { id: "asc" }
    ],
    include: {
        signerUser: {
            select: {
                id: true,
                name: true,
                username: true,
                imageUrl: true,
                status: true,
                characterId: true
            }
        },
        signatureVersion: {
            select: {
                id: true,
                createdAt: true
            }
        }
    }
};

const ASSIGNED_CONTRACT_USER_SELECT = {
    id: true,
    name: true,
    username: true,
    status: true,
    imageUrl: true,
    characterId: true
};

const ASSIGNED_CONTRACT_TEMPLATE_SELECT = {
    id: true,
    type: true,
    title: true,
    content: true,
    backgroundImageUrl: true,
    ownerUserId: true,
    companyId: true,
    createdAt: true,
    updatedAt: true,
    articles: {
        orderBy: { order: "asc" },
        select: {
            title: true,
            body: true
        }
    }
};

function normalizeAssignedContractIds(assignedContractIds) {
    if (!Array.isArray(assignedContractIds) || !assignedContractIds.length) {
        throw new Error("Au moins un contrat doit être sélectionné.");
    }

    const normalized = [];
    const seen = new Set();

    for (const rawId of assignedContractIds) {
        const id = Number(rawId);
        if (!Number.isInteger(id) || id <= 0) {
            throw new Error("La sélection de contrats est invalide.");
        }

        if (!seen.has(id)) {
            seen.add(id);
            normalized.push(id);
        }
    }

    if (!normalized.length) {
        throw new Error("Au moins un contrat doit être sélectionné.");
    }

    return normalized;
}

async function generateUniquePublicShareId(tx) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const publicId = generatePublicShareId();
        const existing = await tx.contractShare.findUnique({
            where: { publicId },
            select: { id: true }
        });

        if (!existing) {
            return publicId;
        }
    }

    throw new Error("Impossible de générer un identifiant de partage unique.");
}

function ensureShareIsManageable(share, { userId, companyId }) {
    const normalizedCompanyId = Number(companyId);
    if (Number.isInteger(normalizedCompanyId) && normalizedCompanyId > 0) {
        if (!share || share.companyId !== normalizedCompanyId) {
            throw new Error("PARTAGE_INTROUVABLE_OU_INTERDIT");
        }
        return;
    }

    if (!share || share.createdByUserId !== Number(userId)) {
        throw new Error("PARTAGE_INTROUVABLE_OU_INTERDIT");
    }
}

function serializeContractShare(share) {
    return {
        id: share.id,
        publicId: share.publicId,
        publicPath: `/contracts/share/${share.publicId}`,
        companyId: share.companyId,
        createdAt: share.createdAt,
        updatedAt: share.updatedAt,
        revokedAt: share.revokedAt,
        isRevoked: Boolean(share.revokedAt),
        isPasswordProtected: Boolean(share.passwordHash),
        createdByUser: share.createdByUser
            ? {
                id: share.createdByUser.id,
                name: share.createdByUser.name
            }
            : null,
        contracts: (share.items || []).map((item) => ({
            order: item.order,
            id: item.assignedContract.id,
            assignedAt: item.assignedContract.assignedAt,
            signedAt: item.assignedContract.signedAt,
            status: item.assignedContract.status,
            snapshotTitle: item.assignedContract.snapshotTitle,
        }))
    };
}

function serializePublicContractShare(share) {
    return {
        publicId: share.publicId,
        publicPath: `/contracts/share/${share.publicId}`,
        contractCount: share.items.length,
        contracts: share.items.map((item) => ({
            order: item.order,
            ...buildAssignedContractPayload(item.assignedContract)
        }))
    };
}

async function getOrderedContractsForShare({
                                               assignedContractIds,
                                               createdByUserId,
                                               companyId,
                                               tx = prisma
                                           }) {
    const normalizedIds = normalizeAssignedContractIds(assignedContractIds);

    const contracts = await tx.assignedContract.findMany({
        where: {
            id: { in: normalizedIds }
        },
        select: {
            id: true,
            assignedToUserId: true,
            modifiesCompanyId: true,
            fieldValues: true,
            snapshotTitle: true,
            snapshotMarkdown: true,
            status: true,
            template: {
                select: {
                    title: true,
                    content: true,
                    articles: {
                        orderBy: { order: "asc" },
                        select: {
                            title: true,
                            body: true
                        }
                    }
                }
            }
        }
    });

    if (contracts.length !== normalizedIds.length) {
        throw new Error("Un ou plusieurs contrats sont introuvables.");
    }

    const contractsById = new Map(contracts.map((contract) => [contract.id, contract]));
    const orderedContracts = await hydrateAssignedContractsSnapshots(
        normalizedIds.map((id) => contractsById.get(id)),
        tx
    );

    const invalidSnapshot = orderedContracts.find(
        (contract) => !contract?.snapshotTitle?.trim() || !contract?.snapshotMarkdown?.trim()
    );

    if (invalidSnapshot) {
        throw new Error("Un ou plusieurs contrats ne sont pas partageables pour le moment.");
    }

    const normalizedCompanyId = Number(companyId);
    if (Number.isInteger(normalizedCompanyId) && normalizedCompanyId > 0) {
        const invalidCompanyContract = orderedContracts.find(
            (contract) => contract.modifiesCompanyId !== normalizedCompanyId
        );

        if (invalidCompanyContract) {
            throw new Error("Tous les contrats sélectionnés doivent appartenir à l'entreprise courante.");
        }
    } else {
        const invalidOwnedContract = orderedContracts.find(
            (contract) => contract.assignedToUserId !== Number(createdByUserId)
        );

        if (invalidOwnedContract) {
            throw new Error("Vous ne pouvez partager que vos propres contrats.");
        }
    }

    return orderedContracts;
}

async function getManagedContractShareRecord({ shareId, userId, companyId, tx = prisma }) {
    const parsedShareId = Number(shareId);

    if (!Number.isInteger(parsedShareId) || parsedShareId <= 0) {
        throw new Error("PARTAGE_INVALIDE");
    }

    const share = await tx.contractShare.findUnique({
        where: { id: parsedShareId },
        include: {
            createdByUser: {
                select: { id: true, name: true }
            },
            items: {
                orderBy: { order: "asc" },
                select: {
                    order: true,
                    assignedContract: {
                        select: {
                            id: true,
                            assignedAt: true,
                            signedAt: true,
                            status: true,
                            snapshotTitle: true
                        }
                    }
                }
            }
        }
    });

    ensureShareIsManageable(share, { userId, companyId });

    return share;
}

async function getPublicContractShareRecord(publicId) {
    if (!publicId || typeof publicId !== "string") {
        throw new Error("PARTAGE_PUBLIC_INVALIDE");
    }

    const share = await prisma.contractShare.findFirst({
        where: {
            publicId,
            revokedAt: null
        },
        include: {
            items: {
                orderBy: { order: "asc" },
                select: {
                    order: true,
                    assignedContract: {
                        include: {
                            assignedToUser: {
                                select: ASSIGNED_CONTRACT_USER_SELECT
                            },
                            senderUser: {
                                select: ASSIGNED_CONTRACT_USER_SELECT
                            },
                            template: {
                                select: ASSIGNED_CONTRACT_TEMPLATE_SELECT
                            },
                            signatures: ASSIGNED_CONTRACT_SIGNATURES_INCLUDE
                        }
                    }
                }
            }
        }
    });

    if (!share) {
        throw new Error("PARTAGE_PUBLIC_INTROUVABLE");
    }

    const hydratedContracts = await hydrateAssignedContractsSnapshots(
        share.items.map((item) => item.assignedContract),
        prisma
    );
    const hydratedContractsById = new Map(hydratedContracts.map((contract) => [contract.id, contract]));

    return {
        ...share,
        items: share.items.map((item) => ({
            ...item,
            assignedContract: hydratedContractsById.get(item.assignedContract.id) || item.assignedContract
        }))
    };
}


/* ========================================================================== */
/* 🧩 GESTION DES TEMPLATES                                                   */
/* ========================================================================== */

/**
 * Met à jour un template de contrat (hors articles et fields)
 *
 * @param {Object} params
 * @param {number} params.templateId
 * @param {number | null} params.ownerUserId
 * @param {Object} params.data
 */
async function updateContractTemplate({ templateId, ownerUserId, data }) {
    const {
        title,
        type,
        content,
        backgroundImageUrl
    } = data;

    return prisma.contractTemplate.update({
        where: {
            id: templateId
        },
        data: {
            title,
            type,
            content,
            backgroundImageUrl,
            ownerUserId
        }
    });
}

/**
 * Crée un template Markdown complet.
 */
async function createTemplate({ title, content, type, ownerUserId, backgroundImageUrl, companyId }) {
    return prisma.contractTemplate.create({
        data: {
            title,
            content,
            type,
            ownerUserId: ownerUserId,
            backgroundImageUrl: backgroundImageUrl || null,
            companyId: companyId
        }
    });
}

async function createTemplateField(templateId, { label, fieldType = "TEXT" }) {
    if (!label?.trim()) {
        throw new Error("Le label est obligatoire.");
    }

    const key = generateFieldKey(label);

    // gérer les collisions de clé
    let finalKey = key;
    let i = 1;

    while (await prisma.contractTemplateField.findFirst({
        where: { templateId, key: finalKey }
    })) {
        finalKey = `${key}_${i++}`;
    }

    const order = await prisma.contractTemplateField.count({
        where: { templateId }
    });

    return prisma.contractTemplateField.create({
        data: {
            templateId,
            label,
            key: finalKey,
            fieldType,
            order
        }
    });
}

async function updateTemplateField(templateId, fieldId, data) {
    const field = await prisma.contractTemplateField.findFirst({
        where: { id: fieldId, templateId }
    });

    if (!field) {
        throw new Error("Champ introuvable.");
    }

    const updateData = {};

    if (data.label) {
        updateData.label = data.label;
        updateData.key = generateFieldKey(data.label);
    }

    if (data.fieldType) {
        updateData.fieldType = data.fieldType;
    }

    return prisma.contractTemplateField.update({
        where: { id: fieldId },
        data: updateData
    });
}

async function deleteTemplateField(templateId, fieldId) {
    const field = await prisma.contractTemplateField.findFirst({
        where: { id: fieldId, templateId }
    });

    if (!field) {
        throw new Error("Champ introuvable.");
    }

    await prisma.contractTemplateField.delete({
        where: { id: fieldId }
    });

    return { success: true };
}



/**
 * Remplace entièrement la liste des articles Markdown d’un template.
 */
async function updateArticles(templateId, articles) {
    return prisma.$transaction(async (tx) => {
        await tx.contractTemplateArticle.deleteMany({ where: { templateId } });

        if (!articles.length) return;

        await tx.contractTemplateArticle.createMany({
            data: articles.map((a, index) => ({
                templateId,
                title: a.title,
                body: a.body,
                params: a.params || {},
                order: index
            }))
        });
    });
}

/**
 * Récupère un template avec champs et articles.
 */
async function getTemplate(templateId) {
    return prisma.contractTemplate.findUnique({
        where: { id: templateId },
        include: {
            fields: true,
            articles: { orderBy: { order: "asc" } }
        }
    });
}

/**
 * Liste tous les templates disponibles.
 */
async function listTemplates(ownerUserId, companyId) {
    return prisma.contractTemplate.findMany({
        where: {
            type: { in: ["COMPANY"] },
            //ownerUserId: ownerUserId,
            companyId: companyId
        },
        orderBy: { createdAt: "desc" },
        include: { fields: true },
    });
}

/* ========================================================================== */
/* 📨 ASSIGNATION DE CONTRATS                                                */
/* ========================================================================== */

/**
 * Assigne un contrat à un utilisateur.
 */
async function assignContract({ templateId, assignedToUserId, fieldValues, modifiesCompanyId, assignerId }) {
    const template = await prisma.contractTemplate.findUnique({
        where: { id: templateId },
        include: { articles: true, fields: true }
    });

    if (!template) throw new Error("Template introuvable.");

    const markdownSnapshot = renderContractMarkdown({
        template,
        fieldValues: JSON.stringify(fieldValues || {})
    });

    const assigned = await prisma.assignedContract.create({
        data: {
            templateId,
            assignedToUserId,
            senderUserId: Number.isInteger(Number(assignerId)) ? Number(assignerId) : null,
            fieldValues: JSON.stringify(fieldValues || {}),
            modifiesCompanyId: modifiesCompanyId || null,
            status: "PENDING",
            snapshotTitle: template.title,
            snapshotMarkdown: markdownSnapshot
        }
    });

    await createNotification({
        senderId: assignerId,
        recipientUserIds: [assignedToUserId],
        content: {
            title: "Contrat à signer",
            body: `Vous avez reçu un contrat : « ${template.title} ».`,
            assignedContractId: assigned.id
        },
        type: "SYSTEM",
        behavior: "BLOCKING"
    });

    return assigned;
}

/* ========================================================================== */
/* 🔗 PARTAGES PUBLICS READ-ONLY / MANAGEMENT                                */
/* ========================================================================== */

async function createContractShare({ createdByUserId, assignedContractIds, password, companyId = null }) {
    const normalizedCompanyId = Number.isInteger(Number(companyId)) && Number(companyId) > 0
        ? Number(companyId)
        : null;

    return prisma.$transaction(async (tx) => {
        const orderedContracts = await getOrderedContractsForShare({
            assignedContractIds,
            createdByUserId,
            companyId: normalizedCompanyId,
            tx
        });

        const publicId = await generateUniquePublicShareId(tx);
        const trimmedPassword = typeof password === "string" ? password.trim() : "";
        const passwordHash = trimmedPassword
            ? await bcrypt.hash(trimmedPassword, SHARE_BCRYPT_ROUNDS)
            : null;

        const share = await tx.contractShare.create({
            data: {
                publicId,
                passwordHash,
                createdByUserId: Number(createdByUserId),
                companyId: normalizedCompanyId,
                items: {
                    create: orderedContracts.map((contract, index) => ({
                        assignedContractId: contract.id,
                        order: index
                    }))
                }
            },
            include: {
                createdByUser: {
                    select: { id: true, name: true }
                },
                items: {
                    orderBy: { order: "asc" },
                    select: {
                        order: true,
                        assignedContract: {
                            select: {
                                id: true,
                                assignedAt: true,
                                signedAt: true,
                                status: true,
                                snapshotTitle: true
                            }
                        }
                    }
                }
            }
        });

        return serializeContractShare(share);
    });
}

async function listContractShares({ userId, companyId = null }) {
    const normalizedCompanyId = Number.isInteger(Number(companyId)) && Number(companyId) > 0
        ? Number(companyId)
        : null;

    const shares = await prisma.contractShare.findMany({
        where: normalizedCompanyId
            ? { companyId: normalizedCompanyId }
            : { createdByUserId: Number(userId) },
        orderBy: [
            { revokedAt: "asc" },
            { createdAt: "desc" }
        ],
        include: {
            createdByUser: {
                select: { id: true, name: true }
            },
            items: {
                orderBy: { order: "asc" },
                select: {
                    order: true,
                    assignedContract: {
                        select: {
                            id: true,
                            assignedAt: true,
                            signedAt: true,
                            status: true,
                            snapshotTitle: true
                        }
                    }
                }
            }
        }
    });

    return shares.map(serializeContractShare);
}

async function getManagedContractShare({ shareId, userId, companyId = null }) {
    const share = await getManagedContractShareRecord({ shareId, userId, companyId });
    return serializeContractShare(share);
}

async function regenerateContractShare({ shareId, userId, companyId = null }) {
    return prisma.$transaction(async (tx) => {
        const share = await getManagedContractShareRecord({ shareId, userId, companyId, tx });
        const newPublicId = await generateUniquePublicShareId(tx);

        const updatedShare = await tx.contractShare.update({
            where: { id: share.id },
            data: {
                publicId: newPublicId,
                revokedAt: null
            },
            include: {
                createdByUser: {
                    select: { id: true, name: true }
                },
                items: {
                    orderBy: { order: "asc" },
                    select: {
                        order: true,
                        assignedContract: {
                            select: {
                                id: true,
                                assignedAt: true,
                                signedAt: true,
                                status: true,
                                snapshotTitle: true
                            }
                        }
                    }
                }
            }
        });

        return serializeContractShare(updatedShare);
    });
}

async function revokeContractShare({ shareId, userId, companyId = null }) {
    const managedShare = await getManagedContractShareRecord({ shareId, userId, companyId });

    const updatedShare = await prisma.contractShare.update({
        where: { id: managedShare.id },
        data: {
            revokedAt: new Date()
        },
        include: {
            createdByUser: {
                select: { id: true, name: true }
            },
            items: {
                orderBy: { order: "asc" },
                select: {
                    order: true,
                    assignedContract: {
                        select: {
                            id: true,
                            assignedAt: true,
                            signedAt: true,
                            status: true,
                            snapshotTitle: true
                        }
                    }
                }
            }
        }
    });

    return serializeContractShare(updatedShare);
}

async function activateContractShare({ shareId, userId, companyId = null }) {
    const managedShare = await getManagedContractShareRecord({ shareId, userId, companyId });

    const updatedShare = await prisma.contractShare.update({
        where: { id: managedShare.id },
        data: {
            revokedAt: null
        },
        include: {
            createdByUser: {
                select: { id: true, name: true }
            },
            items: {
                orderBy: { order: "asc" },
                select: {
                    order: true,
                    assignedContract: {
                        select: {
                            id: true,
                            assignedAt: true,
                            signedAt: true,
                            status: true,
                            snapshotTitle: true
                        }
                    }
                }
            }
        }
    });

    return serializeContractShare(updatedShare);
}

async function updateContractSharePassword({ shareId, userId, companyId = null, password }) {
    const managedShare = await getManagedContractShareRecord({ shareId, userId, companyId });
    const trimmedPassword = typeof password === "string" ? password.trim() : "";

    const updatedShare = await prisma.contractShare.update({
        where: { id: managedShare.id },
        data: {
            passwordHash: trimmedPassword
                ? await bcrypt.hash(trimmedPassword, SHARE_BCRYPT_ROUNDS)
                : null
        },
        include: {
            createdByUser: {
                select: { id: true, name: true }
            },
            items: {
                orderBy: { order: "asc" },
                select: {
                    order: true,
                    assignedContract: {
                        select: {
                            id: true,
                            assignedAt: true,
                            signedAt: true,
                            status: true,
                            snapshotTitle: true
                        }
                    }
                }
            }
        }
    });

    return serializeContractShare(updatedShare);
}

async function deleteContractShare({ shareId, userId, companyId = null }) {
    const managedShare = await getManagedContractShareRecord({ shareId, userId, companyId });

    await prisma.contractShare.delete({
        where: { id: managedShare.id }
    });

    return {
        success: true,
        deletedShareId: managedShare.id
    };
}

async function getPublicContractShareMeta(publicId) {
    const share = await prisma.contractShare.findFirst({
        where: {
            publicId,
            revokedAt: null
        },
        select: {
            publicId: true,
            passwordHash: true,
            _count: {
                select: { items: true }
            }
        }
    });

    if (!share) {
        throw new Error("PARTAGE_PUBLIC_INTROUVABLE");
    }

    return {
        publicId: share.publicId,
        publicPath: `/contracts/share/${share.publicId}`,
        isPasswordProtected: Boolean(share.passwordHash),
        contractCount: share._count.items
    };
}

async function accessPublicContractShare({ publicId, password }) {
    const share = await getPublicContractShareRecord(publicId);

    if (share.passwordHash) {
        const plainPassword = typeof password === "string" ? password : "";
        if (!plainPassword) {
            throw new Error("PARTAGE_PUBLIC_MOT_DE_PASSE_REQUIS");
        }

        const isValidPassword = await bcrypt.compare(plainPassword, share.passwordHash);
        if (!isValidPassword) {
            throw new Error("PARTAGE_PUBLIC_MOT_DE_PASSE_INVALIDE");
        }
    }

    return serializePublicContractShare(share);
}

/* ========================================================================== */
/* 🧾 CONTRATS D'UNE ENTREPRISE                                               */
/* ========================================================================== */

/**
 * Liste tous les contrats liés à une entreprise (modifiesCompanyId).
 */
async function getCompanyContracts(companyId) {
    const contracts = await prisma.assignedContract.findMany({
        where: { modifiesCompanyId: companyId },
        orderBy: { assignedAt: "desc" },
        include: {
            assignedToUser: {
                select: ASSIGNED_CONTRACT_USER_SELECT
            },
            senderUser: {
                select: ASSIGNED_CONTRACT_USER_SELECT
            },
            template: {
                select: ASSIGNED_CONTRACT_TEMPLATE_SELECT
            },
            signatures: ASSIGNED_CONTRACT_SIGNATURES_INCLUDE
        }
    });

    const hydratedContracts = await hydrateAssignedContractsSnapshots(contracts);

    return hydratedContracts.map((contract) => buildAssignedContractPayload(contract));
}


/* ========================================================================== */
/* 👤 CONTRATS PERSONNELS                                                    */
/* ========================================================================== */

/**
 * Récupère un contrat assigné à l'utilisateur courant.
 */
async function getAssignedContract(contractId, userId) {
    contractId = Number(contractId);

    if (!contractId || Number.isNaN(contractId)) {
        throw createHttpError("INVALID_CONTRACT_ID", 400);
    }

    const contract = await prisma.assignedContract.findFirst({
        where: {
            id: contractId,
            OR: [
                { assignedToUserId: userId },
                { senderUserId: userId }
            ]
        },
        include: {
            assignedToUser: {
                select: ASSIGNED_CONTRACT_USER_SELECT
            },
            senderUser: {
                select: ASSIGNED_CONTRACT_USER_SELECT
            },
            template: {
                select: ASSIGNED_CONTRACT_TEMPLATE_SELECT
            },
            signatures: ASSIGNED_CONTRACT_SIGNATURES_INCLUDE
        }
    });

    if (!contract) return null;

    const [hydratedContract] = await hydrateAssignedContractsSnapshots([contract]);
    return buildAssignedContractPayload(hydratedContract, userId);
}


/* ========================================================================== */
/* ✍️ SIGNATURE DU CONTRAT                                                   */
/* ========================================================================== */

async function signContract({ contractId, userId, role = null, confirmationText, ipAddress = null, userAgent = null }) {
    const normalizedContractId = Number(contractId);

    if (!Number.isInteger(normalizedContractId) || normalizedContractId <= 0) {
        throw createHttpError("Contrat introuvable.", 404);
    }

    const normalizedConfirmationText = normalizeConfirmationText(confirmationText);

    return prisma.$transaction(async (tx) => {
        const assigned = await tx.assignedContract.findUnique({
            where: { id: normalizedContractId },
            include: {
                assignedToUser: {
                    select: ASSIGNED_CONTRACT_USER_SELECT
                },
                senderUser: {
                    select: ASSIGNED_CONTRACT_USER_SELECT
                },
                template: {
                    select: ASSIGNED_CONTRACT_TEMPLATE_SELECT
                },
                signatures: ASSIGNED_CONTRACT_SIGNATURES_INCLUDE
            }
        });

        if (!assigned) {
            throw createHttpError("Contrat introuvable.", 404);
        }

        if (assigned.status === "REJECTED") {
            throw createHttpError("Ce contrat a déjà été refusé.", 409);
        }

        const signingRole = resolveSigningRole(assigned, userId, role);
        const existingSignature = (assigned.signatures || []).find((item) => item.role === signingRole);

        if (existingSignature) {
            throw createHttpError("Ce rôle de signature a déjà été validé pour ce contrat.", 409, {
                role: signingRole
            });
        }

        if (assigned.status !== "PENDING") {
            throw createHttpError("Ce contrat n'est plus signable.", 409);
        }

        const activeSignatureVersion = await tx.userElectronicSignatureVersion.findFirst({
            where: { userId: Number(userId) },
            orderBy: [
                { createdAt: "desc" },
                { id: "desc" }
            ]
        });

        if (!activeSignatureVersion) {
            throw createHttpError(
                "Vous devez configurer une signature électronique dans votre profil avant de signer ce contrat.",
                409
            );
        }

        const signerUser = signingRole === CONTRACT_SIGNATURE_ROLES.RECIPIENT
            ? assigned.assignedToUser
            : assigned.senderUser;

        if (!signerUser) {
            throw createHttpError("Le signataire de ce rôle est introuvable.", 409, {
                role: signingRole
            });
        }

        await tx.contractSignature.create({
            data: {
                assignedContractId: assigned.id,
                role: signingRole,
                signerUserId: Number(userId),
                signatureVersionId: activeSignatureVersion.id,
                signatureSvgSnapshot: activeSignatureVersion.svg,
                signerNameSnapshot: signerUser.name || null,
                signerIpAddress: sanitizeIpAddress(ipAddress),
                signerUserAgent: sanitizeUserAgent(userAgent),
                confirmationText: normalizedConfirmationText
            }
        });

        const willBeFullySigned = (() => {
            const nextRoles = new Set((assigned.signatures || []).map((item) => item.role));
            nextRoles.add(signingRole);
            return nextRoles.has(CONTRACT_SIGNATURE_ROLES.SENDER) && nextRoles.has(CONTRACT_SIGNATURE_ROLES.RECIPIENT);
        })();

        if (willBeFullySigned && assigned.modifiesCompanyId) {
            await applyCompanyChanges(assigned, tx);
        }

        const updated = await tx.assignedContract.update({
            where: { id: assigned.id },
            data: willBeFullySigned
                ? {
                    status: "SIGNED",
                    signedAt: new Date()
                }
                : {},
            include: {
                assignedToUser: {
                    select: ASSIGNED_CONTRACT_USER_SELECT
                },
                senderUser: {
                    select: ASSIGNED_CONTRACT_USER_SELECT
                },
                template: {
                    select: ASSIGNED_CONTRACT_TEMPLATE_SELECT
                },
                signatures: ASSIGNED_CONTRACT_SIGNATURES_INCLUDE
            }
        });

        const [hydratedContract] = await hydrateAssignedContractsSnapshots([updated], tx);
        return buildAssignedContractPayload(hydratedContract, userId);
    });
}

async function applyCompanyChanges(assigned, tx = prisma) {
    void assigned;
    void tx;
    return;
}

/* ========================================================================== */
/* ❌ REFUS DU CONTRAT                                                       */
/* ========================================================================== */

async function rejectContract(contractId, userId, reason) {
    const normalizedContractId = Number(contractId);

    if (!Number.isInteger(normalizedContractId) || normalizedContractId <= 0) {
        throw createHttpError("Contrat introuvable.", 404);
    }

    const contract = await prisma.assignedContract.findUnique({
        where: { id: normalizedContractId }
    });

    if (!contract) {
        throw createHttpError("Contrat introuvable.", 404);
    }

    if (Number(contract.assignedToUserId) !== Number(userId)) {
        throw createHttpError("Seul le destinataire peut refuser ce contrat.", 403);
    }

    if (contract.status === "REJECTED") {
        throw createHttpError("Ce contrat a déjà été refusé.", 409);
    }

    if (contract.status !== "PENDING") {
        throw createHttpError("Ce contrat ne peut plus être refusé.", 409);
    }

    const updated = await prisma.assignedContract.update({
        where: { id: normalizedContractId },
        data: {
            status: "REJECTED",
            refusedAt: new Date(),
            refusalReason: reason || null
        }
    });

    await notifyContractRefusal(updated, reason);

    return updated;
}

async function notifyContractRefusal(contract, reason) {
    if (!contract.modifiesCompanyId) return;

    const employees = await prisma.companyEmployee.findMany({
        where: { companyId: contract.modifiesCompanyId },
        include: { rank: true }
    });

    const managerUserIds = employees
        .filter(e =>
            e.rank?.name?.toLowerCase().includes("manager") ||
            e.rank?.name?.toLowerCase().includes("admin")
        )
        .map(e => e.userId);

    if (!managerUserIds.length) return;

    await createNotification({
        senderId: contract.assignedToUserId,
        recipientUserIds: managerUserIds,
        content: {
            title: "Contrat refusé",
            body: `Un contrat a été refusé par l'utilisateur #${contract.assignedToUserId}.`,
            contractId: contract.id,
            reason: reason || null
        },
        type: "SYSTEM",
        behavior: "PERMANENT"
    });
}

async function getContractsForUser(userId) {
    const contracts = await prisma.assignedContract.findMany({
        where: {
            assignedToUserId: userId
        },
        include: {
            assignedToUser: {
                select: ASSIGNED_CONTRACT_USER_SELECT
            },
            senderUser: {
                select: ASSIGNED_CONTRACT_USER_SELECT
            },
            template: {
                select: ASSIGNED_CONTRACT_TEMPLATE_SELECT
            },
            signatures: ASSIGNED_CONTRACT_SIGNATURES_INCLUDE
        },
        orderBy: { assignedAt: "desc" }
    });

    const hydratedContracts = await hydrateAssignedContractsSnapshots(contracts);
    return hydratedContracts.map((contract) => buildAssignedContractPayload(contract, userId));
}

/* ========================================================================== */
/* 🧱 RENDU MARKDOWN FINAL                                                   */
/* ========================================================================== */

function renderContractMarkdown({ template, fieldValues }) {
    let md = typeof template?.content === "string" ? template.content : "";

    // Ajout des articles
    if (template?.articles?.length) {
        const articlesMD = template.articles
            .map((a, index) =>
                a.title.replace(/\{\{article_number\}\}/g, index + 1)
                + "\n\n" +
                a.body + "\n"
            )
            .join("\n");

        md += "\n\n---\n\n" + articlesMD;
    }

    return applyFieldValuesToMarkdown(md, fieldValues);
}

/* ========================================================================== */
/* EXPORT                                                                     */
/* ========================================================================== */

module.exports = {
    // Templates
    createTemplate,
    updateContractTemplate,
    updateArticles,
    getTemplate,
    listTemplates,
    deleteTemplateField,
    updateTemplateField,
    createTemplateField,

    // Assignation
    assignContract,

    // Partages publics
    createContractShare,
    listContractShares,
    getManagedContractShare,
    regenerateContractShare,
    revokeContractShare,
    activateContractShare,
    updateContractSharePassword,
    deleteContractShare,
    getPublicContractShareMeta,
    accessPublicContractShare,

    // Entreprise
    getCompanyContracts,

    // Personnel
    getAssignedContract,
    getContractsForUser,

    // Signature & refus
    signContract,
    rejectContract,

    // Markdown
    renderContractMarkdown
};
