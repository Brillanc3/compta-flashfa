// /backend/src/modules/admin/admin.images.service.js

const prisma = require('../../db');
const { pipeline } = require('stream');
const util = require('util');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { UPLOADS_DIR } = require('../image/image.service');

const pump = util.promisify(pipeline);

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function buildPublicUrl(image) {
    return `/api/images/${image.publicId}?v=${image.updatedAt.getTime()}`;
}

function formatImage(img) {
    return { ...img, publicUrl: buildPublicUrl(img) };
}

async function computeAndCacheByteSize(image) {
    try {
        const stats = await fs.promises.stat(path.join(UPLOADS_DIR, image.filename));
        await prisma.image.update({ where: { id: image.id }, data: { byteSize: stats.size } });
        image.byteSize = stats.size;
    } catch {
        image.byteSize = null;
    }
}

async function listImages({ ownerType, ownerId, search, webpOnly, page = 1, limit = 20 } = {}) {
    const where = {};
    if (ownerType) where.ownerType = ownerType;
    if (ownerId) where.ownerId = parseInt(ownerId, 10);
    if (search) where.publicId = { contains: search };
    if (webpOnly === 'true') where.mimetype = 'image/webp';
    if (webpOnly === 'false') where.NOT = { mimetype: 'image/webp' };

    const skip = (page - 1) * limit;
    const [images, total] = await Promise.all([
        prisma.image.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
        prisma.image.count({ where }),
    ]);

    const needsSize = images.filter(img => img.byteSize == null);
    if (needsSize.length > 0) {
        await Promise.all(needsSize.map(computeAndCacheByteSize));
    }

    return { images: images.map(formatImage), total, page, limit };
}

async function uploadAdminImage(fileData, adminUserId) {
    if (!ALLOWED_MIMETYPES.includes(fileData.mimetype)) {
        throw Object.assign(new Error('Format non supporté.'), { statusCode: 400 });
    }

    const fileExtension = path.extname(fileData.filename);
    const newFilename = `${crypto.randomBytes(16).toString('hex')}${fileExtension}`;
    const filePath = path.join(UPLOADS_DIR, newFilename);

    await pump(fileData.file, fs.createWriteStream(filePath));

    const stats = await fs.promises.stat(filePath);

    const image = await prisma.image.create({
        data: {
            filename: newFilename,
            mimetype: fileData.mimetype,
            byteSize: stats.size,
            ownerType: 'ADMIN',
            ownerId: adminUserId,
        },
    });

    const full = await prisma.image.findUnique({ where: { id: image.id } });
    return formatImage(full);
}

async function getImage(imageId) {
    const image = await prisma.image.findUnique({ where: { id: imageId } });
    if (!image) return null;
    if (image.byteSize == null) await computeAndCacheByteSize(image);
    return formatImage(image);
}

async function replaceImage(imageId, fileData) {
    if (!ALLOWED_MIMETYPES.includes(fileData.mimetype)) {
        throw Object.assign(new Error('Format non supporté.'), { statusCode: 400 });
    }

    const existing = await prisma.image.findUnique({ where: { id: imageId } });
    if (!existing) throw Object.assign(new Error('Image introuvable.'), { statusCode: 404 });

    const fileExtension = path.extname(fileData.filename);
    const newFilename = `${crypto.randomBytes(16).toString('hex')}${fileExtension}`;
    const newFilePath = path.join(UPLOADS_DIR, newFilename);

    await pump(fileData.file, fs.createWriteStream(newFilePath));

    const stats = await fs.promises.stat(newFilePath);

    fs.unlink(path.join(UPLOADS_DIR, existing.filename), (err) => {
        if (err) console.error('[admin.images] suppression ancien fichier:', err);
    });

    const updated = await prisma.image.update({
        where: { id: imageId },
        data: { filename: newFilename, mimetype: fileData.mimetype, byteSize: stats.size },
    });

    const full = await prisma.image.findUnique({ where: { id: updated.id } });
    return formatImage(full);
}

async function deleteImage(imageId) {
    const image = await prisma.image.findUnique({ where: { id: imageId } });
    if (!image) throw Object.assign(new Error('Image introuvable.'), { statusCode: 404 });

    fs.unlink(path.join(UPLOADS_DIR, image.filename), (err) => {
        if (err) console.error('[admin.images] suppression fichier:', err);
    });

    await prisma.image.delete({ where: { id: imageId } });
}

async function convertToWebP(imageId) {
    const image = await prisma.image.findUnique({ where: { id: imageId } });
    if (!image) throw Object.assign(new Error('Image introuvable.'), { statusCode: 404 });
    if (image.mimetype === 'image/webp') {
        throw Object.assign(new Error('Image déjà en WebP.'), { statusCode: 400 });
    }

    const oldPath = path.join(UPLOADS_DIR, image.filename);
    const newFilename = `${crypto.randomBytes(16).toString('hex')}.webp`;
    const newPath = path.join(UPLOADS_DIR, newFilename);

    const info = await sharp(oldPath).webp({ quality: 80 }).toFile(newPath);

    fs.unlink(oldPath, (err) => {
        if (err) console.error('[admin.images] convert unlink:', err);
    });

    const updated = await prisma.image.update({
        where: { id: imageId },
        data: { filename: newFilename, mimetype: 'image/webp', byteSize: info.size },
    });

    const full = await prisma.image.findUnique({ where: { id: updated.id } });
    return formatImage(full);
}

module.exports = { listImages, uploadAdminImage, getImage, replaceImage, deleteImage, convertToWebP };
