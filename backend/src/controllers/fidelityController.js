// backend/src/controllers/fidelityController.js

const prisma = require('../db');
const crypto = require('crypto');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const util = require('util');
const { pipeline } = require('stream');
const pump = util.promisify(pipeline); // Utilitaire pour gérer les flux
const { hasWildcardPermission } = require('../middleware/auth');
const { createOrResetFidelityCard } = require("../services/fidelityService");


// On suppose que vos images sont stockées ici, comme configuré précédemment
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'images');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Récupère le modèle de carte de fidélité actif pour une entreprise.
 */
const getFidelityTemplate = async (request, reply) => {
    const companyId = parseInt(request.params.id, 10);
    try {
        const template = await prisma.fidelityCardTemplate.findFirst({
            where: { companyId, isActive: true },
            include: { stampZones: { orderBy: { order: 'asc' } } }
        });
        if (!template) {
            return reply.code(404).send({ message: "Aucun modèle de carte de fidélité n'est configuré pour cette entreprise." });
        }
        reply.send(template);
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la récupération du modèle de carte.", error: error.message });
    }
};

/**
 * Configure le modèle de carte de fidélité (upload des images et des zones).
 */
const setupFidelityTemplate = async (request, reply) => {
    console.log('[FidelityController] Début de la configuration du template.');
    const companyId = parseInt(request.params.id, 10);
    let setupData;
    let baseImageRecord, stampImageRecord;

    try {
        const parts = request.parts();
        for await (const part of parts) {
            if (part.type === 'file' && (part.fieldname === 'baseImage' || part.fieldname === 'stampImage')) {
                console.log(`[FidelityController] Réception du fichier : ${part.fieldname}`);

                const fileExtension = path.extname(part.filename);
                const uniqueFilename = `${crypto.randomBytes(16).toString('hex')}${fileExtension}`;
                const filePath = path.join(UPLOADS_DIR, uniqueFilename);

                console.log(`[FidelityController] Écriture du fichier sur le disque à : ${filePath}`);
                await pump(part.file, fs.createWriteStream(filePath));
                console.log(`[FidelityController] Fichier ${uniqueFilename} sauvegardé.`);

                const newImage = await prisma.image.create({
                    data: {
                        filename: uniqueFilename,
                        mimetype: part.mimetype,
                        ownerType: 'COMPANY',
                        ownerId: companyId,
                    }
                });
                console.log(`[FidelityController] Enregistrement de l'image ID ${newImage.id} dans la base de données.`);

                if (part.fieldname === 'baseImage') {
                    baseImageRecord = newImage;
                } else {
                    stampImageRecord = newImage;
                }

            } else if (part.fieldname === 'setupData') {
                setupData = JSON.parse(part.value);
                console.log('[FidelityController] Données de configuration reçues:', setupData);
            }
        }

        if (!setupData || !baseImageRecord || !stampImageRecord) {
            console.error('[FidelityController] Données manquantes :', { setupData, baseImageRecord, stampImageRecord });
            return reply.code(400).send({ message: "Données incomplètes. Assurez-vous de fournir les deux images et les données de configuration." });
        }

        console.log('[FidelityController] Début de la transaction Prisma...');
        const newTemplate = await prisma.$transaction(async (tx) => {
            await tx.fidelityCardTemplate.updateMany({ where: { companyId }, data: { isActive: false } });
            console.log('[FidelityController] Anciens templates désactivés.');

            const createdTemplate = await tx.fidelityCardTemplate.create({
                data: {
                    companyId,
                    name: setupData.name,
                    baseImageId: baseImageRecord.publicId,
                    stampImageId: stampImageRecord.publicId,
                    stampZones: {
                        create: setupData.zones.map(zone => ({ x: zone.x, y: zone.y, order: zone.order }))
                    }
                }
            });
            console.log(`[FidelityController] Nouveau template ID ${createdTemplate.id} créé.`);
            return createdTemplate;
        });

        console.log('[FidelityController] Configuration terminée avec succès.');
        reply.code(201).send(newTemplate);

    } catch (error) {
        console.error('[FidelityController] Erreur critique lors de la configuration de la carte:', error);
        reply.code(500).send({ message: "Erreur lors de la configuration de la carte.", error: error.message });
    }
};




/**
 * Affiche l'image de la carte de fidélité d'un client avec les tampons.
 */
const serveCardImage = async (request, reply) => {
    const { publicLink } = request.params;
    try {
        const card = await prisma.fidelityCard.findUnique({
            where: { publicLink },
            include: { client: { include: { company: { include: { fidelityCardTemplates: { where: { isActive: true }, include: { stampZones: { orderBy: { order: 'asc' } } } } } } } } }
        });

        if (!card) return reply.code(404).send("Carte non trouvée.");

        const template = card.client.company.fidelityCardTemplates[0];
        if (!template) return reply.code(500).send("Aucun modèle de carte actif.");

        const baseImage = await prisma.image.findUnique({ where: { publicId: template.baseImageId } });
        const stampImage = await prisma.image.findUnique({ where: { publicId: template.stampImageId } });

        const basePath = path.join(UPLOADS_DIR, baseImage.filename);
        const stampPath = path.join(UPLOADS_DIR, stampImage.filename);
        const STAMP_SIZE = 50;

        const resizedStampBuffer = await sharp(stampPath)
            .resize(50, 50) // Vous pouvez ajuster cette taille
            .toBuffer();

        const composites = [];
        for (let i = 0; i < card.stampCount; i++) {
            const zone = template.stampZones[i];
            if (zone) {
                composites.push({
                    input: resizedStampBuffer,
                    top: Math.round(zone.y - (STAMP_SIZE / 2)),
                    left: Math.round(zone.x - (STAMP_SIZE / 2)),
                });
            }
        }

        const finalImageBuffer = await sharp(basePath)
            .composite(composites)
            .png()
            .toBuffer();

        reply
            .header("Content-Type", "image/png")
            .header("Content-Disposition", 'inline; filename="card.png"')
            .header("Cache-Control", "public, max-age=1, immutable")
            .header("Access-Control-Allow-Origin", "*") // sécurité FiveM
            .send(finalImageBuffer);

    } catch (error) {
        console.error(error);
        reply.code(500).send({ message: "Erreur lors de la génération de l'image.", error: error.message });
    }
};

/**
 * Ajoute un tampon (incrémente le compteur) à une carte de fidélité.
 */
const addStamp = async (request, reply) => {
    const { publicLink } = request.params;
    const userId = request.user.userId; // L'ID de l'employé qui veut tamponner

    try {
        // Étape 1 : Trouver la carte et, à travers elle, l'ID de l'entreprise
        const card = await prisma.fidelityCard.findUnique({
            where: { publicLink },
            include: { client: true } // On inclut le client pour trouver la companyId
        });

        if (!card) {
            return reply.code(404).send({ message: "Carte de fidélité non trouvée." });
        }
        const companyId = card.client.companyId;

        // Étape 2 : Vérifier manuellement la permission de l'employé
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { roles: { include: { permissions: true } }, permissions: true }
        });

        const userPermissions = new Set();
        user.roles.forEach(r => r.permissions.forEach(p => userPermissions.add(p.action)));
        user.permissions.forEach(p => userPermissions.add(p.action));

        // On utilise une permission "MANAGE" pour l'action de tamponner
        const requiredPermission = `COMPANY.${companyId}.FIDELITY.CLIENTS.STAMPED`;
        if (!hasWildcardPermission(userPermissions, requiredPermission)) {
            return reply.code(403).send({ message: `Accès interdit: Permission '${requiredPermission}' requise.` });
        }

        // Étape 3 : Si la permission est validée, on ajoute le tampon
        const updatedCard = await prisma.fidelityCard.update({
            where: { publicLink },
            data: { stampCount: { increment: 1 } }
        });
        reply.send(updatedCard);

    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de l'ajout du tampon.", error: error.message });
    }
};

/**
 * Crée une nouvelle carte de fidélité pour un client EXISTANT.
 * Remplace l'ancienne fonction "createClientAndCard".
 */
const createCardForClient = async (request, reply) => {
    const companyId = parseInt(request.params.id, 10);
    const { clientId } = request.body; // On reçoit l'ID d'un client existant

    try {
        // On vérifie que le client n'a pas déjà une carte
        const existingCard = await prisma.fidelityCard.findUnique({
            where: { clientId: clientId }
        });

        if (existingCard) {
            return reply.code(409).send({ message: "Ce client a déjà une carte de fidélité." });
        }

        const newCard = await prisma.fidelityCard.create({
            data: {
                clientId: clientId,
                publicLink: crypto.randomBytes(6).toString('hex')
            }
        });
        reply.code(201).send(newCard);
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la création de la carte.", error: error.message });
    }
};

/**
 * Gère la création ou la réinitialisation d'une carte de fidélité pour un client.
 */
const createOrResetCard = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.companyId, 10);
        const clientId = parseInt(request.params.clientId, 10);

        const newCard = await createOrResetFidelityCard(companyId, clientId);

        // On renvoie le client mis à jour avec sa nouvelle carte
        const updatedClient = await prisma.client.findUnique({
            where: { id: clientId },
            include: { card: true }
        });

        reply.code(201).send(updatedClient);
    } catch (error) {
        // On renvoie le message d'erreur du service (ex: "carte pas pleine")
        reply.code(400).send({ message: error.message || "Erreur lors de la gestion de la carte." });
    }
};

module.exports = {
    getFidelityTemplate,
    setupFidelityTemplate,
    serveCardImage,
    addStamp,
    createCardForClient,
    createOrResetCard
};