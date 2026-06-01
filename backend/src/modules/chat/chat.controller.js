'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream');
const util = require('util');

const sharp = require('sharp');
const pump = util.promisify(pipeline);

const chatService = require('./chat.service');
const { PERMISSIONS } = require('./chat.perms');
const { resolvePermissionsForCategory } = require('./chat.permissionResolver');
const events = require('./chat.events');

const MAX_ATTACHMENTS_PER_MESSAGE = 2;
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

// backend root = /backend (depuis /backend/src/modules/chat)
const BACKEND_ROOT = path.resolve(__dirname, '../../..');
const UPLOADS_ATTACHMENTS_DIR = path.join(BACKEND_ROOT, 'uploads', 'attachments');

async function saveChatAttachmentPart({ channelId, part }) {
    const originalMimeType = String(part.mimetype || '').toLowerCase();
 
    if (!ALLOWED_IMAGE_MIME.has(originalMimeType)) {
        const err = new Error('Unsupported image type');
        err.statusCode = 400;
        throw err;
    }
 
    // Si le plugin multipart tronque sur dépassement
    if (part.file && part.file.truncated) {
        const err = new Error('Image too large (max 5MB)');
        err.statusCode = 413;
        throw err;
    }
 
    const publicId = crypto.randomBytes(16).toString('hex');
    const ext = '.webp'; 
 
    const channelFolder = path.join(UPLOADS_ATTACHMENTS_DIR, String(channelId));
    if (!fs.existsSync(channelFolder)) {
        fs.mkdirSync(channelFolder, { recursive: true });
    }
 
    // diskPath stocké RELATIF au BACKEND_ROOT (compatible attachments.service.js)
    const diskPath = path.join('uploads', 'attachments', String(channelId), `${publicId}${ext}`);
    const absPath = path.join(BACKEND_ROOT, diskPath);
 
    // Initialisation de Sharp pour la compression et le redimensionnement en WEBP
    const transformer = sharp()
        .rotate() // Corrige l'orientation via EXIF
        .resize(1600, 1600, {
            fit: 'inside',
            withoutEnlargement: true,
        })
        .webp({ quality: 80 }); // On force le WEBP pour l'économie d'espace disk
 
    // Exécution du pipeline Sharp
    await pump(part.file, transformer, fs.createWriteStream(absPath));
 
    // Récupération des métadonnées finales
    const metadata = await sharp(absPath).metadata();
    const stat = fs.statSync(absPath);
 
    return {
        input: {
            publicId,
            mimeType: 'image/webp',
            byteSize: stat.size,
            width: metadata.width || null,
            height: metadata.height || null,
            diskPath,
        },
        absPath,
    };
}

// ============================================================================
// Helper: lecture & validation du header x-company-id
// ============================================================================
function getCompanyId(req) {
    const raw = req.headers['x-company-id'];
    const companyId = parseInt(raw, 10);

    if (!raw || Number.isNaN(companyId)) {
        const err = new Error('Invalid or missing x-company-id header');
        err.statusCode = 400;
        throw err;
    }

    return companyId;
}

// Helper: résout les permissions finales (via service)
async function getResolvedPermissions(userId, channelId) {
    return chatService.resolvePermissions(userId, channelId);
}

// ============================================================================
// CATEGORIES
// ============================================================================
exports.listCategories = async (req, reply) => {
    const companyId = getCompanyId(req);
    const categories = await chatService.listCategories(companyId);
    return reply.send(categories);
};

exports.createCategory = async (req, reply) => {
    const companyId = getCompanyId(req);
    const { name, position } = req.body;

    const category = await chatService.createCategory(companyId, {
        name,
        position,
    });

    events.emitCategoryCreated(category);
    return reply.send(category);
};

exports.updateCategory = async (req, reply) => {
    const companyId = getCompanyId(req);
    const { categoryId } = req.params;

    const category = await chatService.updateCategory(companyId, categoryId, req.body);
    events.emitCategoryUpdated(categoryId, req.body);
    return reply.send(category);
};

exports.deleteCategory = async (req, reply) => {
    const companyId = getCompanyId(req);
    const { categoryId } = req.params;

    await chatService.deleteCategory(companyId, categoryId);
    events.emitCategoryDeleted(categoryId);
    return reply.send({ success: true });
};

// ============================================================================
// CHANNELS
// ============================================================================
exports.listChannels = async (req, reply) => {
    const companyId = getCompanyId(req);
    const userId = req.user?.userId;

    if (!userId) {
        return reply.code(403).send({ message: 'Cette route requiert un contexte utilisateur (session JWT). Les clés API sans userId associé ne peuvent pas accéder aux salons.' });
    }

    const channels = await chatService.listChannels(companyId, userId);
    return reply.send(channels);
};

exports.getUnreadCount = async (req, reply) => {
    const companyId = getCompanyId(req);
    const userId = req.user.userId;

    const count = await chatService.getUnreadCount(companyId, userId);
    return reply.send({ count });
};

exports.getTotalUnreadCounts = async (req, reply) => {
    const userId = req.user.userId;

    const counts = await chatService.getTotalUnreadCounts(userId);
    return reply.send(counts);
};

exports.getChannelHash = async (req, reply) => {
    const companyId = getCompanyId(req);
    const userId = req.user.userId;
    const hash = await chatService.getChannelHash(companyId, userId);
    return reply.send({ hash });
};

exports.getChannel = async (req, reply) => {
    const { channelId } = req.params;
    const userId = req.user.userId;

    const perms = await getResolvedPermissions(userId, channelId);
    if (!perms.can.viewChannel) {
        return reply.code(403).send({ message: 'Missing VIEW_CHANNEL' });
    }

    const channel = await chatService.getChannel(channelId);
    return reply.send({ channel, permissions: perms });
};

exports.createChannel = async (req, reply) => {
    const companyId = getCompanyId(req);
    const userId = req.user.userId;
    const { categoryId } = req.body || {};

    if (categoryId) {
        const catPerms = await resolvePermissionsForCategory({ userId, categoryId }).catch(() => null);
        const canManage = catPerms?.can?.manageCategoryChannels || catPerms?.can?.manageChannel;
        if (!canManage) {
            return reply.code(403).send({ message: 'Missing MANAGE_CATEGORY_CHANNELS on this category' });
        }
    }

    const channel = await chatService.createChannel(companyId, userId, req.body);

    events.emitChannelCreated(channel);
    return reply.send(channel);
};

exports.updateChannel = async (req, reply) => {
    const { channelId } = req.params;
    const userId = req.user.userId;

    const perms = await getResolvedPermissions(userId, channelId);
    if (!perms.can.manageChannel) {
        return reply.code(403).send({ message: 'Missing MANAGE_CHANNEL' });
    }

    const updated = await chatService.updateChannel(channelId, req.body);

    events.emitChannelUpdated(channelId, req.body);
    return reply.send(updated);
};

exports.deleteChannel = async (req, reply) => {
    const { channelId } = req.params;
    const userId = req.user.userId;

    const perms = await getResolvedPermissions(userId, channelId);
    if (!perms.can.manageChannel) {
        return reply.code(403).send({ message: 'Missing MANAGE_CHANNEL' });
    }

    await chatService.deleteChannel(channelId);

    events.emitChannelDeleted(channelId);
    return reply.send({ success: true });
};

// ============================================================================
// MESSAGES
// ============================================================================
exports.getMessages = async (req, reply) => {
    const { channelId } = req.params;
    const userId = req.user.userId;
    const { before, after, limit } = req.query;

    const perms = await getResolvedPermissions(userId, channelId);
    if (!perms.can.viewChannel) {
        return reply.code(403).send({ message: 'Missing VIEW_CHANNEL' });
    }

    // Le service renvoie déjà un DTO frontend-friendly
    const items = await chatService.getMessages(channelId, { before, after, limit });
    return reply.send(items);
};

exports.postMessage = async (req, reply) => {
    const { channelId } = req.params;
    const userId = req.user.userId;

    const perms = await getResolvedPermissions(userId, channelId);
    if (!perms.can.sendMessages) {
        return reply.code(403).send({ message: 'Missing SEND_MESSAGES' });
    }

    let content = '';
    const attachmentInputs = [];
    const writtenFilesAbs = [];

    let replyToId = null;
    try {
        if (req.isMultipart()) {
            for await (const part of req.parts()) {
                if (part.type === 'field') {
                    if (part.fieldname === 'content') {
                        content = String(part.value ?? '');
                    } else if (part.fieldname === 'replyToId') {
                        replyToId = part.value ?? null;
                    }
                    continue;
                }

                if (part.type === 'file') {
                    if (part.fieldname !== 'attachments') {
                        try { part.file?.resume?.(); } catch {}
                        continue;
                    }

                    if (attachmentInputs.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
                        try { part.file?.resume?.(); } catch {}
                        const err = new Error(`Maximum ${MAX_ATTACHMENTS_PER_MESSAGE} images par message.`);
                        err.statusCode = 400;
                        throw err;
                    }

                    const saved = await saveChatAttachmentPart({ channelId, part });
                    attachmentInputs.push(saved.input);
                    writtenFilesAbs.push(saved.absPath);
                }
            }
        } else {
            content = String(req.body?.content ?? '');
            replyToId = req.body?.replyToId ?? null;
        }

        if (!content && attachmentInputs.length === 0) {
            return reply.code(400).send({ message: 'content or attachments required' });
        }

        const msg = attachmentInputs.length > 0
            ? await chatService.postMessageWithAttachments(channelId, userId, content, attachmentInputs, replyToId)
            : await chatService.postMessage(channelId, userId, content, replyToId);

        // SSE/Redis bus (compat)
        void events.emitMessageCreated(channelId, msg).catch(() => {});

        return reply.send(msg);
    } catch (e) {
        // Nettoyage fichiers écrits si erreur avant DB
        for (const p of writtenFilesAbs) {
            try {
                if (p && fs.existsSync(p)) fs.unlinkSync(p);
            } catch {}
        }

        const status =
            e?.statusCode && Number.isFinite(e.statusCode)
                ? e.statusCode
                : 400;

        return reply.code(status).send({ message: e?.message || 'Upload failed' });
    }
};

exports.editMessage = async (req, reply) => {
    const { channelId, messageId } = req.params;
    const userId = req.user.userId;
    const { content } = req.body;

    const perms = await getResolvedPermissions(userId, channelId);
    if (!perms.can.viewChannel) {
        return reply.code(403).send({ message: 'Missing VIEW_CHANNEL' });
    }

    if (typeof content !== 'string' || content.trim().length === 0) {
        return reply.code(400).send({ message: 'content required' });
    }

    const meta = await chatService.getMessageMeta(channelId, messageId);
    if (!meta || meta.deletedAt) {
        return reply.code(404).send({ message: 'Message not found' });
    }

    // Edit = uniquement l'auteur
    if (Number(meta.authorId) !== Number(userId)) {
        return reply.code(403).send({ message: 'Only author can edit message' });
    }

    const updated = await chatService.editMessage(channelId, messageId, content);

    void events.emitMessageUpdated(channelId, updated).catch(() => {});
    return reply.send(updated);
};

exports.deleteMessage = async (req, reply) => {
    const { channelId, messageId } = req.params;
    const userId = req.user.userId;

    const perms = await getResolvedPermissions(userId, channelId);
    if (!perms.can.viewChannel) {
        return reply.code(403).send({ message: 'Missing VIEW_CHANNEL' });
    }

    const meta = await chatService.getMessageMeta(channelId, messageId);
    if (!meta || meta.deletedAt) {
        return reply.code(404).send({ message: 'Message not found' });
    }

    const isOwner = Number(meta.authorId) === Number(userId);
    const canDeleteOthers = Boolean(perms?.can?.manageMessages);
    if (!isOwner && !canDeleteOthers) {
        return reply.code(403).send({ message: 'Missing MANAGE_MESSAGES' });
    }

    await chatService.deleteMessage(channelId, messageId);

    events.emitMessageDeleted(channelId, messageId);
    return reply.send({ success: true });
};

exports.getMessageHistory = async (req, reply) => {
    const { channelId, messageId } = req.params;
    const userId = req.user.userId;

    const perms = await getResolvedPermissions(userId, channelId);
    if (!perms.can.viewChannel) {
        return reply.code(403).send({ message: 'Missing VIEW_CHANNEL' });
    }

    const meta = await chatService.getMessageMeta(channelId, messageId);
    if (!meta || meta.deletedAt) {
        return reply.code(404).send({ message: 'Message not found' });
    }

    const isOwner = Number(meta.authorId) === Number(userId);
    const canManage = Boolean(perms?.can?.manageMessages);
    if (!isOwner && !canManage) {
        return reply.code(403).send({ message: 'Missing Permissions' });
    }

    const history = await chatService.getMessageEditHistory(channelId, messageId);
    return reply.send(history);
};

// ============================================================================
// PERMISSIONS OVERRIDES — DISCORD-LIKE
// ============================================================================
exports.getPermissionCatalog = async (req, reply) => {
    return reply.send(PERMISSIONS);
};

// ---------- RANK OVERRIDES ----------
exports.getRankOverrides = async (req, reply) => {
    const { channelId } = req.params;
    const userId = req.user.userId;

    const perms = await getResolvedPermissions(userId, channelId);
    if (!perms.can.manageChannel) {
        return reply.code(403).send({ message: 'Missing MANAGE_CHANNEL' });
    }

    const overrides = await chatService.getRankOverrides(channelId);
    return reply.send(overrides);
};

exports.setRankOverride = async (req, reply) => {
    const { channelId, rankId } = req.params;
    const userId = req.user.userId;
    const { allowBits, denyBits } = req.body;

    const perms = await getResolvedPermissions(userId, channelId);
    if (!perms.can.manageChannel) {
        return reply.code(403).send({ message: 'Missing MANAGE_CHANNEL' });
    }

    const override = await chatService.setRankOverride(channelId, rankId, allowBits, denyBits);

    events.emitPermissionsUpdated(channelId, {
        scope: 'rank',
        rankId: Number(rankId),
        override,
    });

    return reply.send(override);
};

exports.removeRankOverride = async (req, reply) => {
    const { channelId, rankId } = req.params;
    const userId = req.user.userId;

    const perms = await getResolvedPermissions(userId, channelId);
    if (!perms.can.manageChannel) {
        return reply.code(403).send({ message: 'Missing MANAGE_CHANNEL' });
    }

    await chatService.removeRankOverride(channelId, rankId);

    events.emitPermissionsUpdated(channelId, {
        scope: 'rank',
        rankId: Number(rankId),
        override: null,
    });

    return reply.send({ success: true });
};

// ---------- USER OVERRIDES ----------
exports.getUserOverrides = async (req, reply) => {
    const { channelId } = req.params;
    const adminId = req.user.userId;

    const perms = await getResolvedPermissions(adminId, channelId);
    if (!perms.can.manageChannel) {
        return reply.code(403).send({ message: 'Missing MANAGE_CHANNEL' });
    }

    const overrides = await chatService.getUserOverrides(channelId);
    return reply.send(overrides);
};

exports.setUserOverride = async (req, reply) => {
    const { channelId, userId } = req.params;
    const adminId = req.user.userId;
    const { allowBits, denyBits } = req.body;

    const perms = await getResolvedPermissions(adminId, channelId);
    if (!perms.can.manageChannel) {
        return reply.code(403).send({ message: 'Missing MANAGE_CHANNEL' });
    }

    const override = await chatService.setUserOverride(channelId, userId, allowBits, denyBits);

    events.emitPermissionsUpdated(channelId, {
        scope: 'user',
        userId: Number(userId),
        override,
    });

    return reply.send(override);
};

exports.removeUserOverride = async (req, reply) => {
    const { channelId, userId } = req.params;
    const adminId = req.user.userId;

    const perms = await getResolvedPermissions(adminId, channelId);
    if (!perms.can.manageChannel) {
        return reply.code(403).send({ message: 'Missing MANAGE_CHANNEL' });
    }

    await chatService.removeUserOverride(channelId, userId);

    events.emitPermissionsUpdated(channelId, {
        scope: 'user',
        userId: Number(userId),
        override: null,
    });

    return reply.send({ success: true });
};

// ---------- Permissions effectives ----------
exports.getMyPermissionsInChannel = async (req, reply) => {
    const { channelId } = req.params;
    const userId = req.user.userId;

    const perms = await getResolvedPermissions(userId, channelId);
    return reply.send(perms);
};

// ---------- SYNC channel <-> category ----------
exports.syncChannelToCategory = async (req, reply) => {
    const { channelId } = req.params;
    const userId = req.user.userId;

    const perms = await getResolvedPermissions(userId, channelId);
    if (!perms.can.manageChannel) {
        return reply.code(403).send({ message: 'Missing MANAGE_CHANNEL' });
    }

    const updated = await chatService.syncChannelToCategory(channelId);

    events.emitPermissionsUpdated(channelId, { scope: 'channel', sync: true });
    events.emitChannelUpdated(channelId, { syncedWithCategory: true });
    return reply.send(updated);
};

// ============================================================================
// CATEGORY-LEVEL PERMISSION OVERRIDES (Discord parent cascade)
// ============================================================================
async function ensureCategoryAdmin(req, reply) {
    const companyId = getCompanyId(req);
    const userId = req.user.userId;
    // Use company-level CHAT.ADMINISTRATOR / wildcard via any owned channel — simplest: just
    // require user to have manageChannel on at least one channel of this category, OR be admin.
    // Cheap path: load any channel in the category and check permissions.
    const { categoryId } = req.params;
    const channels = await chatService.listChannelsInCategory(categoryId);

    if (channels.length === 0) {
        // Empty category — fall back to checking on a synthetic resolution: the user must be a
        // global admin (resolver returns admin mask). We approximate by checking via any channel
        // of the same company; if none we accept only true admins via permissions middleware.
        // To keep simple: deny non-admin if category empty AND no other reference.
        // We allow if user has CHAT.ADMINISTRATOR via permission token (best effort).
        if (!req.user?.permissions?.includes?.('CHAT.ADMINISTRATOR')) {
            reply.code(403).send({ message: 'Missing MANAGE_CHANNEL on any channel of this category' });
            return null;
        }
        return { companyId, userId };
    }

    for (const ch of channels) {
        const p = await getResolvedPermissions(userId, ch.id);
        if (p.can.manageChannel) return { companyId, userId };
    }
    reply.code(403).send({ message: 'Missing MANAGE_CHANNEL on this category' });
    return null;
}

exports.getCategoryRankOverrides = async (req, reply) => {
    const ok = await ensureCategoryAdmin(req, reply);
    if (!ok) return;
    const { categoryId } = req.params;
    const overrides = await chatService.getCategoryRankOverrides(categoryId);
    return reply.send(overrides);
};

exports.setCategoryRankOverride = async (req, reply) => {
    const ok = await ensureCategoryAdmin(req, reply);
    if (!ok) return;
    const { categoryId, rankId } = req.params;
    const { allowBits, denyBits } = req.body;
    const override = await chatService.setCategoryRankOverride(categoryId, rankId, allowBits, denyBits);

    events.emitCategoryPermissionsUpdated?.(categoryId, {
        scope: 'rank',
        rankId: Number(rankId),
        override,
    });
    return reply.send(override);
};

exports.removeCategoryRankOverride = async (req, reply) => {
    const ok = await ensureCategoryAdmin(req, reply);
    if (!ok) return;
    const { categoryId, rankId } = req.params;
    await chatService.removeCategoryRankOverride(categoryId, rankId);
    events.emitCategoryPermissionsUpdated?.(categoryId, {
        scope: 'rank',
        rankId: Number(rankId),
        override: null,
    });
    return reply.send({ success: true });
};

exports.getCategoryUserOverrides = async (req, reply) => {
    const ok = await ensureCategoryAdmin(req, reply);
    if (!ok) return;
    const { categoryId } = req.params;
    const overrides = await chatService.getCategoryUserOverrides(categoryId);
    return reply.send(overrides);
};

exports.setCategoryUserOverride = async (req, reply) => {
    const ok = await ensureCategoryAdmin(req, reply);
    if (!ok) return;
    const { categoryId, userId } = req.params;
    const { allowBits, denyBits } = req.body;
    const override = await chatService.setCategoryUserOverride(categoryId, userId, allowBits, denyBits);
    events.emitCategoryPermissionsUpdated?.(categoryId, {
        scope: 'user',
        userId: Number(userId),
        override,
    });
    return reply.send(override);
};

exports.removeCategoryUserOverride = async (req, reply) => {
    const ok = await ensureCategoryAdmin(req, reply);
    if (!ok) return;
    const { categoryId, userId } = req.params;
    await chatService.removeCategoryUserOverride(categoryId, userId);
    events.emitCategoryPermissionsUpdated?.(categoryId, {
        scope: 'user',
        userId: Number(userId),
        override: null,
    });
    return reply.send({ success: true });
};

// ============================================================================
// READ STATE
// ============================================================================
exports.getReadState = async (req, reply) => {
    const { channelId } = req.params;
    const userId = req.user.userId;

    const state = await chatService.getReadState(channelId, userId);
    return reply.send(state);
};

exports.updateReadState = async (req, reply) => {
    const { channelId } = req.params;
    const userId = req.user.userId;

    const result = await chatService.updateReadState(channelId, userId);
    return reply.send(result);
};

exports.ackChannel = async (req, reply) => {
    const { channelId } = req.params;
    const userId = req.user.userId ?? req.user.id;
    await chatService.updateReadState(channelId, userId);
    return reply.code(204).send();
};

exports.markAllCompanyChannelsRead = async (req, reply) => {
    const { companyId } = req.params;
    const userId = req.user.userId;
    const result = await chatService.markAllCompanyChannelsRead(companyId, userId);
    return reply.send(result);
};

// ============================================================================
// DIRECT MESSAGES
// ============================================================================
exports.listDmConversations = async (req, reply) => {
    const userId = req.user.userId;

    const convos = await chatService.listDmConversations(userId);
    return reply.send(convos);
};

exports.getDmConversation = async (req, reply) => {
    const userId = req.user.userId;
    const otherId = req.params.userId;

    const convo = await chatService.getDmConversation(userId, otherId);
    return reply.send(convo);
};

exports.postDmMessage = async (req, reply) => {
    const userId = req.user.userId;
    const otherId = req.params.userId;
    const { content } = req.body;

    const msg = await chatService.postDmMessage(userId, otherId, content);

    // NOTE : à compléter selon ton gateway DM
    return reply.send(msg);
};

// ============================================================================
exports.getChannelMembers = async (req, reply) => {
    const channelId = req.params.channelId;
    const channel = await chatService.getChannel(channelId);
    if (!channel) return reply.status(404).send({ error: 'Channel not found' });
    const members = await chatService.getChannelMembers(channelId, channel.companyId);
    return reply.send({ members, companyId: channel.companyId });
};

// PRESENCE
// ============================================================================
exports.getPresence = async (req, reply) => {
    const companyId = getCompanyId(req);
    const presences = await chatService.getCompanyPresence(companyId);
    return reply.send(presences);
};

exports.updatePresence = async (req, reply) => {
    const userId = req.user.userId ?? req.user.id;
    const companyId = getCompanyId(req);
    const { status, customEmoji, customText } = req.body;

    const allowed = ['ONLINE', 'IDLE', 'DND', 'INVISIBLE'];
    if (!allowed.includes(status)) {
        return reply.status(400).send({ error: 'Invalid status. Must be one of: ONLINE, IDLE, DND, INVISIBLE' });
    }

    const presence = await chatService.updatePresence(userId, companyId, { status, customEmoji, customText });

    events.emitPresenceUpdated(companyId, { userId, status: presence.status, customEmoji: presence.customEmoji, customText: presence.customText });

    return reply.send(presence);
};

exports.heartbeatPresence = async (req, reply) => {
    const userId = req.user.userId ?? req.user.id;
    const companyId = getCompanyId(req);
    await chatService.heartbeatPresence(userId, companyId);
    return reply.send({ ok: true });
};

// ============================================================================
// REACTIONS
// ============================================================================
async function addReaction(req, reply) {
    const userId = req.user.userId ?? req.user.id;
    const { channelId, messageId } = req.params;
    const { emoji } = req.body;
    const result = await chatService.addReaction(userId, channelId, messageId, emoji);
    events.emitReactionAdded(channelId, messageId, { userId, emoji, count: result.count });
    return reply.send(result);
}

async function removeReaction(req, reply) {
    const userId = req.user.userId ?? req.user.id;
    const { channelId, messageId, emoji } = req.params;
    const result = await chatService.removeReaction(userId, channelId, messageId, emoji);
    events.emitReactionRemoved(channelId, messageId, { userId, emoji });
    return reply.send(result);
}

exports.addReaction = addReaction;
exports.removeReaction = removeReaction;

// ============================================================================
// PINS
// ============================================================================
async function getPins(req, reply) {
    const { channelId } = req.params;
    const pins = await chatService.getChannelPins(channelId);
    return reply.send(pins);
}

async function pinMessage(req, reply) {
    const userId = req.user.userId ?? req.user.id;
    const { channelId, messageId } = req.params;
    const pin = await chatService.pinMessage(userId, channelId, messageId);
    events.emitMessagePinned(channelId, {
        messageId: String(messageId),
        pinnedByUserId: userId,
        pinnedAt: pin.pinnedAt,
    });
    return reply.send(pin);
}

async function unpinMessage(req, reply) {
    const { channelId, messageId } = req.params;
    await chatService.unpinMessage(channelId, messageId);
    events.emitMessageUnpinned(channelId, messageId);
    return reply.status(204).send();
}

exports.getPins = getPins;
exports.pinMessage = pinMessage;
exports.unpinMessage = unpinMessage;

// ============================================================================
// OPTIMIZED ENDPOINTS
// ============================================================================
async function getChannelContext(req, reply) {
    const userId = req.user.userId ?? req.user.id;
    const companyId = req.user.companyId ?? req.headers['x-company-id'];
    const { channelId } = req.params;
    const { limit = 50, cursor } = req.query;
    const data = await chatService.getChannelContext(userId, Number(companyId), channelId, {
        limit: Math.min(Number(limit), 100),
        cursor,
    });
    return reply.send(data);
}

async function bootstrapChat(req, reply) {
    const userId = req.user.userId ?? req.user.id;
    const companyId = req.user.companyId ?? req.headers['x-company-id'];
    const data = await chatService.bootstrapChat(userId, Number(companyId));
    return reply.send(data);
}

exports.getChannelContext = getChannelContext;
exports.bootstrapChat = bootstrapChat;