// /backend/src/modules/customization/customization.controller.js
const prisma = require('../../db');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Utiliser le même dossier que image.service si on veut, ou un dédié
const UPLOADS_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'images');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Convert HEX string to "R G B" format
function hexToRgb(hex) {
    let raw = hex.replace('#', '');
    if (raw.length === 3) raw = raw.split('').map(c => c + c).join('');
    if (raw.length !== 6) return null;
    const r = parseInt(raw.substring(0, 2), 16);
    const g = parseInt(raw.substring(2, 4), 16);
    const b = parseInt(raw.substring(4, 6), 16);
    return `${r} ${g} ${b}`;
}

async function getThemeCss(req, reply) {
    const companyId = parseInt(req.params.companyId, 10);
    if (isNaN(companyId)) {
        return reply.code(400).send({ message: "Invalid companyId" });
    }

    try {
        const settingsRecord = await prisma.companySettings.findUnique({
            where: { companyId }
        });

        if (!settingsRecord) {
            reply.header('Content-Type', 'text/css');
            return reply.send("/* No custom theme */");
        }

        const settings = typeof settingsRecord.settings === 'string'
            ? JSON.parse(settingsRecord.settings)
            : (settingsRecord.settings || {});

        const customTheme = settings.customTheme || {};

        let cssOutput = `/* Custom theme for company ${companyId} */\n`;
        
        cssOutput += `:root, [data-theme="light"], [data-theme="dark"] {\n`;
        // Inject RGB maps and generic
        const mappingKeys = [
            'bg-base', 'bg-surface', 'text-primary', 'text-secondary', 
            'border-color', 'brand-primary', 'brand-light', 'brand-dark'
        ];

        for (const key of mappingKeys) {
            if (customTheme[key]) {
                const rgb = hexToRgb(customTheme[key]);
                if (rgb) {
                    cssOutput += `  --${key}-rgb: ${rgb} !important;\n`;
                }
            }
        }
        
        if (customTheme.logoUrl) {
             cssOutput += `  --company-logo-url: url("${customTheme.logoUrl}");\n`;
        }

        cssOutput += `}\n`;

        reply.header('Content-Type', 'text/css');
        return reply.send(cssOutput);
    } catch (e) {
        console.error("Erreur gènèration CSS:", e);
        reply.header('Content-Type', 'text/css');
        return reply.send("/* Error generating theme */");
    }
}

async function getThemeConfig(req, reply) {
    const companyId = parseInt(req.params.companyId, 10);
    if (isNaN(companyId)) {
        return reply.code(400).send({ message: "Invalid companyId" });
    }

    try {
        const settingsRecord = await prisma.companySettings.findUnique({
            where: { companyId }
        });

        if (!settingsRecord) {
            return reply.send({ customTheme: {} });
        }
        
        const settings = typeof settingsRecord.settings === 'string'
            ? JSON.parse(settingsRecord.settings)
            : (settingsRecord.settings || {});
            
        return reply.send({ customTheme: settings.customTheme || {} });
    } catch (e) {
        console.error(e);
        return reply.code(500).send({ message: "Erreur fetching config" });
    }
}

async function updateThemeConfig(req, reply) {
    const companyId = parseInt(req.params.companyId, 10);
    if (isNaN(companyId)) {
        return reply.code(400).send({ message: "Invalid companyId" });
    }
    
    const { customTheme } = req.body;
    if (!customTheme || typeof customTheme !== 'object') {
        return reply.code(400).send({ message: "Payload invalide" });
    }

    try {
        let settingsRecord = await prisma.companySettings.findUnique({ where: { companyId } });
        let currentSettings = {};

        if (settingsRecord) {
            currentSettings = typeof settingsRecord.settings === 'string'
                ? JSON.parse(settingsRecord.settings)
                : (settingsRecord.settings || {});
        }

        currentSettings.customTheme = {
            ...currentSettings.customTheme,
            ...customTheme,
            version: Date.now()
        };

        await prisma.companySettings.upsert({
            where: { companyId },
            update: { settings: currentSettings },
            create: { companyId, settings: currentSettings }
        });

        return reply.send({ message: "Theme mis a jour", customTheme: currentSettings.customTheme });
    } catch (e) {
        console.error(e);
        return reply.code(500).send({ message: "Erreur enregistrement config" });
    }
}

const IMAGE_TYPE_MAP = {
    loading: { ownerType: 'COMPANY_LOADING', themeKey: 'loadingUrl', width: 400, height: 400 },
    banner:  { ownerType: 'COMPANY_BANNER',  themeKey: 'bannerUrl',  width: 240, height: 80  },
    icon:    { ownerType: 'COMPANY_ICON',    themeKey: 'iconUrl',    width: 64,  height: 64  },
};

function isSvgAnimated(svgBuffer) {
    const content = svgBuffer.toString('utf8');
    return /<animate[\s>]|<animateTransform[\s>]|<animateMotion[\s>]|<set[\s>]/.test(content);
}

async function uploadThemeImage(req, reply) {
    const companyId = parseInt(req.params.companyId, 10);
    if (isNaN(companyId)) return reply.code(400).send({ message: "Invalid companyId" });

    const imageType = req.params.imageType;
    const typeConfig = IMAGE_TYPE_MAP[imageType];
    if (!typeConfig) return reply.code(400).send({ message: "Type invalide. Utiliser: loading, banner, icon" });

    const data = await req.file();
    if (!data) return reply.code(400).send({ message: "Aucun fichier." });

    const mime = data.mimetype;
    if (!['image/svg+xml', 'image/png'].includes(mime)) {
        return reply.code(400).send({ message: "Format accepté : SVG ou PNG uniquement." });
    }

    try {
        const buffer = await data.toBuffer();
        const newFilename = `${crypto.randomBytes(16).toString('hex')}.webp`;
        const filePath = path.join(UPLOADS_DIR, newFilename);

        if (mime === 'image/svg+xml' && isSvgAnimated(buffer)) {
            // SVG animé : on garde le SVG tel quel (les navigateurs supportent SVG animé nativement)
            const svgFilename = `${crypto.randomBytes(16).toString('hex')}.svg`;
            const svgFilePath = path.join(UPLOADS_DIR, svgFilename);
            fs.writeFileSync(svgFilePath, buffer);

            let existingImage = await prisma.image.findFirst({ where: { ownerId: companyId, ownerType: typeConfig.ownerType } });
            let savedImage;
            if (existingImage) {
                fs.unlink(path.join(UPLOADS_DIR, existingImage.filename), () => {});
                savedImage = await prisma.image.update({ where: { id: existingImage.id }, data: { filename: svgFilename, mimetype: 'image/svg+xml' } });
            } else {
                savedImage = await prisma.image.create({ data: { filename: svgFilename, mimetype: 'image/svg+xml', ownerType: typeConfig.ownerType, ownerId: companyId } });
            }

            const fullImage = await prisma.image.findUnique({ where: { id: savedImage.id } });
            const imageUrl = `/api/images/${fullImage.publicId}?v=${fullImage.updatedAt.getTime()}`;
            await _saveImageUrlToTheme(companyId, typeConfig.themeKey, imageUrl);
            return reply.code(200).send({ message: "Image mise à jour", imageUrl });
        }

        await sharp(buffer)
            .resize(typeConfig.width, typeConfig.height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .webp()
            .toFile(filePath);

        let existingImage = await prisma.image.findFirst({ where: { ownerId: companyId, ownerType: typeConfig.ownerType } });
        let savedImage;
        if (existingImage) {
            fs.unlink(path.join(UPLOADS_DIR, existingImage.filename), () => {});
            savedImage = await prisma.image.update({ where: { id: existingImage.id }, data: { filename: newFilename, mimetype: 'image/webp' } });
        } else {
            savedImage = await prisma.image.create({ data: { filename: newFilename, mimetype: 'image/webp', ownerType: typeConfig.ownerType, ownerId: companyId } });
        }

        const fullImage = await prisma.image.findUnique({ where: { id: savedImage.id } });
        const imageUrl = `/api/images/${fullImage.publicId}?v=${fullImage.updatedAt.getTime()}`;
        await _saveImageUrlToTheme(companyId, typeConfig.themeKey, imageUrl);
        return reply.code(200).send({ message: "Image mise à jour", imageUrl });
    } catch (e) {
        console.error(e);
        return reply.code(500).send({ message: "Erreur enregistrement image" });
    }
}

async function _saveImageUrlToTheme(companyId, themeKey, imageUrl) {
    let settingsRecord = await prisma.companySettings.findUnique({ where: { companyId } });
    let currentSettings = settingsRecord
        ? (typeof settingsRecord.settings === 'string' ? JSON.parse(settingsRecord.settings) : (settingsRecord.settings || {}))
        : {};
    if (!currentSettings.customTheme) currentSettings.customTheme = {};
    currentSettings.customTheme[themeKey] = imageUrl;
    currentSettings.customTheme.version = Date.now();
    await prisma.companySettings.upsert({
        where: { companyId },
        update: { settings: currentSettings },
        create: { companyId, settings: currentSettings }
    });
}

module.exports = {
    getThemeCss,
    getThemeConfig,
    updateThemeConfig,
    uploadThemeImage,
};
