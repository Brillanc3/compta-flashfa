// /backend/src/modules/clients/clients.controller.js

const service = require('./clients.service');
const prisma = require('../../db');
const path = require('path');
const fs = require('fs');
const util = require('util');
const { pipeline } = require('stream');
const pump = util.promisify(pipeline);
const crypto = require('crypto');
const sharp = require('sharp');

const UPLOADS_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'images');

/* -----------------------------------------------------------
 *   CLIENTS
 * ----------------------------------------------------------- */

const listClients = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const result = await service.listClients(companyId, request.query);
        reply.send(result);
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la récupération des clients.", error: error.message });
    }
};

const createClient = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const newClient = await service.createClient(companyId, request.body);
        reply.code(201).send(newClient);
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la création du client.", error: error.message });
    }
};

const getClientDetails = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const clientId = parseInt(request.params.clientId, 10);
        const client = await service.getClientDetails(clientId, companyId);
        reply.send(client);
    } catch (error) {
        reply.code(404).send({ message: error.message });
    }
};

const updateClient = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const clientId = parseInt(request.params.clientId, 10);
        const updatedClient = await service.updateClient(clientId, companyId, request.body);
        reply.send(updatedClient);
    } catch (error) {
        reply.code(404).send({ message: error.message });
    }
};

/* -----------------------------------------------------------
 *   FIDÉLITÉ — TEMPLATES
 * ----------------------------------------------------------- */

const getFidelityTemplate = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const template = await service.getFidelityTemplate(companyId);
        reply.send(template);
    } catch (error) {
        reply.code(404).send({ message: error.message });
    }
};

const getAllFidelityTemplates = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const templates = await prisma.fidelityCardTemplate.findMany({
            where: { companyId },
            include: { stampZones: true }
        });
        reply.send(templates);
    } catch (error) {
        reply.code(500).send({ message: error.message });
    }
};

const setupFidelityTemplate = async (request, reply) => {
    const companyId = parseInt(request.headers['x-company-id'], 10);

    let setupData;
    const images = {};

    try {
        for await (const part of request.parts()) {
            if (part.type === 'file') {
                const uniqueFilename = `${Date.now()}-${part.filename}`;
                await pump(part.file, fs.createWriteStream(path.join(UPLOADS_DIR, uniqueFilename)));

                images[part.fieldname] = await prisma.image.create({
                    data: {
                        filename: uniqueFilename,
                        mimetype: part.mimetype,
                        ownerType: 'COMPANY',
                        ownerId: companyId,
                    }
                });
            } else {
                setupData = JSON.parse(part.value);
            }
        }

        const newTemplate = await service.setupFidelityTemplate(companyId, setupData, images);
        reply.code(201).send(newTemplate);

    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la configuration du modèle", error: error.message });
    }
};

const setTemplateActive = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const templateId = parseInt(request.params.templateId, 10);
        const { isActive } = request.body;

        const template = await service.setTemplateActive(companyId, templateId, isActive);
        reply.send(template);
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

/* -----------------------------------------------------------
 *   FIDÉLITÉ — CARTES
 * ----------------------------------------------------------- */

const createCardForClient = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const clientId = parseInt(request.params.clientId, 10);
        const { templateId } = request.body;

        const performedByUserId = request.user.userId;

        const newCard = await service.createCardForClient({
            companyId,
            clientId,
            templateId,
            performedByUserId
        });

        reply.code(201).send(newCard);
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

const addStamp = async (request, reply) => {
    try {
        const { publicLink } = request.params;
        const performedByUserId = request.user.userId;

        const result = await service.addStampToCard({
            publicLink,
            performedByUserId
        });

        reply.send(result);

    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de l'ajout du tampon.", error: error.message });
    }
};

const deleteFidelityCard = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const cardId = parseInt(request.params.cardId, 10);
        const performedByUserId = request.user.userId;

        await service.deleteFidelityCard(cardId, companyId, performedByUserId);

        reply.send({ message: "Carte de fidélité supprimée avec succès." });
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

const getCardLastHistory = async (request, reply) => {
    try {
        const cardId = parseInt(request.params.cardId, 10);
        const history = await service.getCardLastHistory(cardId);
        reply.send(history);
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

const renewCard = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const cardId = parseInt(request.params.cardId, 10);
        const performedByUserId = request.user.id;

        const updated = await service.renewFidelityCard(cardId, companyId, performedByUserId);
        reply.send(updated);
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

const setFidelityCardStatus = async (request, reply) => {
    try {
        const cardId = parseInt(request.params.cardId, 10);
        const { newStatus, comment } = request.body;
        const performedByUserId = request.user.userId;

        const card = await service.setCardStatus({ cardId, newStatus, performedByUserId, comment });

        reply.send(card);

    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

const setFidelityCardStampCount = async (request, reply) => {
    try {
        const cardId = parseInt(request.params.cardId, 10);
        const { newStampCount, comment } = request.body;
        const performedByUserId = request.user.userId;

        const card = await service.setCardStampCount({
            cardId,
            newStampCount,
            performedByUserId,
            comment,
        });

        reply.send(card);

    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

/* -----------------------------------------------------------
 *   FIDÉLITÉ — IMAGE PUBLIQUE
 * ----------------------------------------------------------- */

const serveCardImage = async (request, reply) => {
    try {
        const { publicLink } = request.params;

        const imageBuffer = await service.serveCardImage(publicLink);
        reply.type('image/png').send(imageBuffer);

    } catch (error) {
        reply.code(404).send({ message: error.message });
    }
};

/* -----------------------------------------------------------
 *   VARIABLES — CRUD
 * ----------------------------------------------------------- */

const listVariables = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const variables = await service.listVariables(companyId);
        reply.send(variables);
    } catch (error) {
        reply.code(500).send({ message: error.message });
    }
};

const createVariable = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const variable = await service.createVariable(companyId, request.body);
        reply.code(201).send(variable);
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

const updateVariable = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const variableId = parseInt(request.params.variableId, 10);
        const variable = await service.updateVariable(companyId, variableId, request.body);
        reply.send(variable);
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

const deleteVariable = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const variableId = parseInt(request.params.variableId, 10);
        await service.deleteVariable(companyId, variableId);
        reply.send({ message: 'Variable supprimée.' });
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

const updateVariableAccess = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const variableId = parseInt(request.params.variableId, 10);
        const variable = await service.updateVariableAccess(companyId, variableId, request.body);
        reply.send(variable);
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

const getClientVariableValues = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const clientId = parseInt(request.params.clientId, 10);
        const values = await service.getClientVariableValues(companyId, clientId);
        reply.send(values);
    } catch (error) {
        reply.code(500).send({ message: error.message });
    }
};

const setClientVariableValue = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const clientId = parseInt(request.params.clientId, 10);
        const variableId = parseInt(request.params.variableId, 10);
        const { value } = request.body;
        const performedByUserId = request.user.userId;

        const result = await service.setClientVariableValue(companyId, clientId, variableId, value, performedByUserId);
        reply.send(result);
    } catch (error) {
        const status = error.message === 'Permission refusée pour modifier cette variable.' ? 403 : 400;
        reply.code(status).send({ message: error.message });
    }
};

const getVariableRanks = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const ranks = await service.getRanksForCompany(companyId);
        reply.send(ranks);
    } catch (error) {
        reply.code(500).send({ message: error.message });
    }
};

const getMyPerks = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const perks = await service.getMyPerks(userId);
        reply.send(perks);
    } catch (error) {
        reply.code(500).send({ message: error.message });
    }
};

const getPerksCatalog = async (request, reply) => {
    try {
        const catalog = await service.getAllPerksCatalog();
        reply.send(catalog);
    } catch (error) {
        reply.code(500).send({ message: error.message });
    }
};

const uploadVariableIcon = async (request, reply) => {
    try {
        const companyId = request.user.companyId;
        const variableId = parseInt(request.params.variableId, 10);
        
        if (isNaN(variableId)) {
            return reply.code(400).send({ message: "ID de variable invalide." });
        }

        const data = await request.file();
        if (!data) {
            return reply.code(400).send({ message: "Aucun fichier fourni." });
        }

        // Vérification du mime type (refuser GIF)
        if (data.mimetype === 'image/gif') {
            return reply.code(400).send({ message: "Les images GIF ne sont pas autorisées." });
        }
        
        if (!data.mimetype.startsWith('image/')) {
            return reply.code(400).send({ message: "Le fichier doit être une image." });
        }

        // Vérifier l'existence de la variable
        const variable = await prisma.clientVariable.findFirst({
            where: { id: variableId, companyId }
        });

        if (!variable) {
            return reply.code(404).send({ message: "Variable introuvable." });
        }

        const buffer = await data.toBuffer();
        const newFilename = `${crypto.randomBytes(16).toString('hex')}.webp`;
        const filePath = path.join(UPLOADS_DIR, newFilename);

        // Traitement avec sharp : redimensionnement (max 256x256) et conversion en webp
        await sharp(buffer)
            .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
            .webp()
            .toFile(filePath);

        // Enregistrer l'image dans la DB
        const savedImage = await prisma.image.create({
            data: {
                filename: newFilename,
                mimetype: 'image/webp',
                ownerType: 'CLIENT_VARIABLE',
                ownerId: variableId
            }
        });

        const imageUrl = `/api/images/${savedImage.publicId}`;

        // Mettre à jour la variable client
        await prisma.clientVariable.update({
            where: { id: variableId },
            data: { perksIconUrl: imageUrl }
        });

        reply.send({ imageUrl });
    } catch (error) {
        console.error(error);
        reply.code(500).send({ message: error.message });
    }
};

module.exports = {
    // Clients
    listClients,
    createClient,
    getClientDetails,
    updateClient,

    // Templates
    getFidelityTemplate,
    getAllFidelityTemplates,
    setupFidelityTemplate,
    setTemplateActive,

    // Cartes
    createCardForClient,
    addStamp,
    setFidelityCardStatus,
    setFidelityCardStampCount,
    deleteFidelityCard,
    getCardLastHistory,
    renewCard,

    // Image
    serveCardImage,

    // Variables
    listVariables,
    createVariable,
    updateVariable,
    deleteVariable,
    updateVariableAccess,
    getClientVariableValues,
    setClientVariableValue,
    getVariableRanks,
    uploadVariableIcon,
    // Perks
    getMyPerks,
    getPerksCatalog,
};
