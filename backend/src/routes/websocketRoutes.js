// backend/src/routes/websocketRoutes.js

const jwt = require('jsonwebtoken');
const { URLSearchParams } = require('url');
const { addUserConnection, removeUserConnection } = require('../services/webSocket.service');
const { addMessage } = require('../services/chatService');

const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_par_defaut';

async function websocketRoutes(fastify, options) {
    fastify.get('/ws', { websocket: true }, (connection, request) => {
        let userId = null;

        try {
            const urlParams = new URLSearchParams(request.url.split('?')[1]);
            const token = urlParams.get('token');
            if (!token) {
                // CORRIGÉ : On utilise connection.close()
                connection.close(1008, 'Token manquant');
                return;
            }
            const decoded = jwt.verify(token, JWT_SECRET);
            userId = decoded.userId;
            addUserConnection(userId, connection);

        } catch (error) {
            console.log('[WebSocket] Token invalide. Fermeture.', error.message);
            // CORRIGÉ : On utilise connection.close()
            connection.close(1008, 'Token invalide');
            return;
        }

        // CORRIGÉ : On utilise connection.on()
        connection.on('message', async (message) => {
            try {
                const { event, payload } = JSON.parse(message.toString());
                if (!userId) return;
                switch (event) {
                    case 'SEND_MESSAGE':
                        await addMessage({ ...payload, senderId: userId });
                        break;
                    default:
                        console.log(`[WebSocket] Événement inconnu reçu: ${event}`);
                }
            } catch (error) {
                console.error(`[WebSocket] Erreur de message de l'utilisateur ${userId}:`, error);
            }
        });

        // CORRIGÉ : On utilise connection.on()
        connection.on('close', () => {
            if (userId) {
                removeUserConnection(userId);
            }
        });
    });
}

module.exports = websocketRoutes;