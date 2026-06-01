// backend/src/controllers/clientController.js

const prisma = require('../db');

/**
 * Récupère la liste de tous les clients pour une entreprise donnée.
 */
const listClients = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const clients = await prisma.client.findMany({
            where: { companyId },
            orderBy: { name: 'asc' },
        });
        reply.send(clients);
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la récupération des clients.", error: error.message });
    }
};

/**
 * Met à jour les informations d'un client (nom, téléphone, adresse).
 */
const updateClient = async (request, reply) => {
    try {
        const clientId = parseInt(request.params.clientId, 10);
        const { name, phoneNumber, address } = request.body;

        // On vérifie que le client existe et appartient à la bonne entreprise
        // (La permission le fait déjà, mais c'est une double sécurité)
        const client = await prisma.client.findFirst({
            where: {
                id: clientId,
                companyId: parseInt(request.params.id, 10),
            }
        });

        if (!client) {
            return reply.code(404).send({ message: "Client non trouvé." });
        }

        const updatedClient = await prisma.client.update({
            where: { id: clientId },
            data: {
                name,
                phoneNumber,
                address,
            },
        });
        reply.send(updatedClient);
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la mise à jour du client.", error: error.message });
    }
};

/**
 * Récupère les détails d'un client spécifique, y compris son historique de factures.
 * Les factures avec un statut "annulé" (ou autre statut à exclure) ne sont pas incluses.
 */
const getClientDetails = async (request, reply) => {
    try {
        const { id, clientId } = request.params;
        const companyId = parseInt(id, 10);
        const client_id = parseInt(clientId, 10);

        const client = await prisma.client.findFirst({
            where: {
                id: client_id,
                companyId: companyId, // Sécurité : on s'assure que le client appartient à la bonne entreprise
            },
            include: {
                bills: {
                    // On filtre les factures pour exclure celles qui sont annulées
                    where: {
                        NOT: {
                            status: 'CANCELED', // Adaptez ce statut si le vôtre est différent
                        },
                    },
                    orderBy: {
                        date: 'desc', // On trie les factures de la plus récente à la plus ancienne
                    },
                },
                card: true, // On inclut aussi les infos de la carte de fidélité
            },
        });

        if (!client) {
            return reply.code(404).send({ message: "Client non trouvé." });
        }

        reply.send(client);
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la récupération des détails du client.", error: error.message });
    }
};

module.exports = {
    listClients,
    getClientDetails,
    updateClient
};