// /backend/src/services/webSocket.service.js

// Map(userId, connection)
const connections = new Map();

/**
 * Enregistre la connexion d'un utilisateur authentifié.
 * @param {number} userId - L'ID de l'utilisateur.
 * @param {object} connection - L'instance de connexion WebSocket.
 */
function addUserConnection(userId, connection) {
    // console.log(`[WebSocketService] Connexion établie pour l'utilisateur ${userId}`);
    // S'il y a déjà une connexion pour cet utilisateur, fermer l'ancienne
    if (connections.has(userId)) {
        console.warn(`[WebSocketService] Fermeture de la connexion existante pour l'utilisateur ${userId} lors d'une nouvelle connexion.`);
        connections.get(userId).close(1001, "Nouvelle connexion établie"); // 1001 = Going Away
    }
    connections.set(userId, connection);
}

/**
 * Supprime la connexion d'un utilisateur lors de sa déconnexion.
 * @param {number} userId - L'ID de l'utilisateur.
 */
function removeUserConnection(userId) {
    if (connections.has(userId)) {
        // console.log(`[WebSocketService] Connexion fermée pour l'utilisateur ${userId}`);
        connections.delete(userId);
    }
}

/**
 * Envoie un message à une liste spécifique d'utilisateurs connectés.
 * @param {number[]} userIds - Un tableau des IDs des utilisateurs destinataires.
 * @param {object} message - L'objet (événement + payload) à envoyer.
 */
function sendMessageToUsers(userIds, message) {
    const messageString = JSON.stringify(message);
    // Assurer que userIds est toujours un tableau
    const targetUserIds = Array.isArray(userIds) ? userIds : [userIds];

    targetUserIds.forEach(userId => {
        const connection = connections.get(userId);
        // Vérifier si la connexion existe et est ouverte (readyState 1)
        if (connection && connection.readyState === 1) { // 1 = WebSocket.OPEN
            try {
                // console.log(`[WebSocketService] Envoi à ${userId}: Event=${message.event}`); // Log l'envoi
                connection.send(messageString);
            } catch (error) {
                console.error(`[WebSocketService] Erreur d'envoi à ${userId}:`, error);
                // Si une erreur survient (ex: connexion interrompue brutalement), nettoyer
                removeUserConnection(userId);
            }
        } else {
            // console.log(`[WebSocketService] Utilisateur ${userId} non trouvé ou connexion non ouverte (readyState: ${connection?.readyState}). Message non envoyé.`);
        }
    });
}

/**
 * NOUVEAU: Vérifie si un utilisateur a une connexion active enregistrée.
 * @param {number} userId - L'ID de l'utilisateur.
 * @returns {boolean} - Vrai si l'utilisateur est connecté, faux sinon.
 */
function isUserConnected(userId) {
    const connection = connections.get(userId);
    return !!connection && connection.readyState === 1; // Vérifie existence ET état ouvert
}


module.exports = {
    addUserConnection,
    removeUserConnection,
    sendMessageToUsers,
    isUserConnected,
};