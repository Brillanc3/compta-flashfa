// /backend/src/modules/tickets/tickets.controller.js

const service = require('./tickets.service');

function _safeInt(value, fallback = null) {
    const n = parseInt(value, 10);
    return Number.isInteger(n) ? n : fallback;
}

function _safeCompanyId(request) {
    const raw = request?.headers?.['x-company-id'];
    const n = parseInt(raw, 10);
    return Number.isInteger(n) && n > 0 ? n : null;
}


function _safeTicketId(request) {
    // Compat: certains handlers utilisaient :id avant, le routing actuel utilise :ticketId
    const raw = request?.params?.ticketId ?? request?.params?.id;
    return _safeInt(raw);
}



function _sendError(reply, error, defaultMessage) {
    const status = error?.statusCode || 500;
    const message = error?.message || defaultMessage || 'Erreur serveur.';
    return reply.code(status).send({ message });
}

/* -------------------------------------------------------------------------- */
/* USER                                                                        */
/* -------------------------------------------------------------------------- */

const listMyTickets = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const result = await service.listMyTickets(userId, request.query);
        return reply.send(result);
    } catch (error) {
        return _sendError(reply, error, "Erreur lors de la récupération des tickets.");
    }
};

const createMyTicket = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const result = await service.createMyTicket(userId, request.body);
        return reply.send(result);
    } catch (error) {
        return _sendError(reply, error, "Erreur lors de la création du ticket.");
    }
};

const getMyTicket = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const ticketId = _safeTicketId(request);
        if (!ticketId) return reply.code(400).send({ message: "ID ticket invalide." });

        const ticket = await service.getMyTicket(userId, ticketId);
        return reply.send(ticket);
    } catch (error) {
        return _sendError(reply, error, "Erreur lors de la récupération du ticket.");
    }
};

const listMyTicketMessages = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const ticketId = _safeTicketId(request);
        if (!ticketId) return reply.code(400).send({ message: "ID ticket invalide." });

        const result = await service.listMyTicketMessages(userId, ticketId, request.query);
        return reply.send(result);
    } catch (error) {
        return _sendError(reply, error, "Erreur lors de la récupération des messages.");
    }
};

const postMyTicketMessage = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const ticketId = _safeTicketId(request);
        if (!ticketId) return reply.code(400).send({ message: "ID ticket invalide." });

        const result = await service.postMyTicketMessage(userId, ticketId, request.body);
        return reply.send(result);
    } catch (error) {
        return _sendError(reply, error, "Erreur lors de l'envoi du message.");
    }
};

const closeMyTicket = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const ticketId = _safeTicketId(request);
        if (!ticketId) return reply.code(400).send({ message: "ID ticket invalide." });

        const ticket = await service.closeMyTicket(userId, ticketId);
        return reply.send(ticket);
    } catch (error) {
        return _sendError(reply, error, "Erreur lors de la clôture du ticket.");
    }
};

const reopenMyTicket = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const ticketId = _safeTicketId(request);
        if (!ticketId) return reply.code(400).send({ message: "ID ticket invalide." });

        const ticket = await service.reopenMyTicket(userId, ticketId);
        return reply.send(ticket);
    } catch (error) {
        return _sendError(reply, error, "Erreur lors de la réouverture du ticket.");
    }
};

/* -------------------------------------------------------------------------- */
/* ADMIN                                                                       */
/* -------------------------------------------------------------------------- */

const listAdminTickets = async (request, reply) => {
    try {
        const adminId = request.user.userId;
        const companyId = _safeCompanyId(request);
        const result = await service.listAdminTickets(adminId, companyId, request.query);
        return reply.send(result);
    } catch (error) {
        return _sendError(reply, error, "Erreur lors de la récupération des tickets (admin).");
    }
};

const getAdminTicket = async (request, reply) => {
    try {
        const adminId = request.user.userId;
        const ticketId = _safeTicketId(request);
        if (!ticketId) return reply.code(400).send({ message: "ID ticket invalide." });

        const companyId = _safeCompanyId(request);
        const ticket = await service.getAdminTicket(adminId, companyId, ticketId);
        return reply.send(ticket);
    } catch (error) {
        return _sendError(reply, error, "Erreur lors de la récupération du ticket (admin).");
    }
};


const listAdminTicketMessages = async (request, reply) => {
    try {
        const adminId = request.user.userId;
        const companyId = _safeCompanyId(request);
        const ticketId = _safeTicketId(request);
        if (!ticketId) return reply.code(400).send({ message: 'ticketId invalide.' });

        const result = await service.listAdminTicketMessages(adminId, companyId, ticketId, request.query);
        return reply.send(result);
    } catch (error) {
        return _sendError(reply, error, "Erreur lors de la récupération des messages (admin).");
    }
};


const takeTicket = async (request, reply) => {
    try {
        const adminId = request.user.userId;
        const ticketId = _safeTicketId(request);
        if (!ticketId) return reply.code(400).send({ message: "ID ticket invalide." });

        const companyId = _safeCompanyId(request);
        const ticket = await service.takeTicket(adminId, companyId, ticketId);
        return reply.send(ticket);
    } catch (error) {
        return _sendError(reply, error, "Erreur lors de la prise en charge du ticket.");
    }
};

const joinTicket = async (request, reply) => {
    try {
        const adminId = request.user.userId;
        const ticketId = _safeTicketId(request);
        if (!ticketId) return reply.code(400).send({ message: "ID ticket invalide." });

        const companyId = _safeCompanyId(request);
        const ticket = await service.joinTicket(adminId, companyId, ticketId);
        return reply.send(ticket);
    } catch (error) {
        return _sendError(reply, error, "Erreur lors du join du ticket.");
    }
};

const postAdminTicketMessage = async (request, reply) => {
    try {
        const adminId = request.user.userId;
        const ticketId = _safeTicketId(request);
        if (!ticketId) return reply.code(400).send({ message: "ID ticket invalide." });

        const companyId = _safeCompanyId(request);
        const result = await service.postAdminTicketMessage(adminId, companyId, ticketId, request.body);
        return reply.send(result);
    } catch (error) {
        return _sendError(reply, error, "Erreur lors de l'envoi du message (admin).");
    }
};

const forceAssignTicket = async (request, reply) => {
    try {
        const adminId = request.user.userId;
        const ticketId = _safeTicketId(request);
        if (!ticketId) return reply.code(400).send({ message: "ID ticket invalide." });

        const companyId = _safeCompanyId(request);
        const ticket = await service.forceAssignTicket(adminId, companyId, ticketId, request.body);
        return reply.send(ticket);
    } catch (error) {
        return _sendError(reply, error, "Erreur lors de l'assignement forcé.");
    }
};

const closeAdminTicket = async (request, reply) => {
    try {
        const adminId = request.user.userId;
        const ticketId = _safeTicketId(request);
        if (!ticketId) return reply.code(400).send({ message: "ID ticket invalide." });

        const companyId = _safeCompanyId(request);
        const ticket = await service.closeAdminTicket(adminId, companyId, ticketId);
        return reply.send(ticket);
    } catch (error) {
        return _sendError(reply, error, "Erreur lors de la fermeture du ticket.");
    }
};

const requestClosure = async (request, reply) => {
    try {
        const adminId = request.user.userId;
        const ticketId = _safeTicketId(request);
        if (!ticketId) return reply.code(400).send({ message: "ID ticket invalide." });

        const companyId = _safeCompanyId(request);
        const ticket = await service.requestClosure(adminId, companyId, ticketId);
        return reply.send(ticket);
    } catch (error) {
        return _sendError(reply, error, "Erreur lors de la demande de clôture.");
    }
};

const getRequesterProfile = async (request, reply) => {
    try {
        const adminId = request.user.userId;
        const ticketId = _safeTicketId(request);
        if (!ticketId) return reply.code(400).send({ message: "ID ticket invalide." });

        const companyId = _safeCompanyId(request);
        const user = await service.getRequesterProfile(adminId, companyId, ticketId);
        return reply.send(user);
    } catch (error) {
        return _sendError(reply, error, "Erreur lors de la récupération du profil.");
    }
};

module.exports = {
    // user
    listMyTickets,
    createMyTicket,
    getMyTicket,
    listMyTicketMessages,
    postMyTicketMessage,
    closeMyTicket,
    reopenMyTicket,

    // admin
    listAdminTickets,
    getAdminTicket,
    listAdminTicketMessages,
    takeTicket,
    joinTicket,
    postAdminTicketMessage,
    forceAssignTicket,
    requestClosure,
    closeAdminTicket,
    getRequesterProfile,
};
