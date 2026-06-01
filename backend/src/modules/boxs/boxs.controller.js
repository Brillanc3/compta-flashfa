// /backend/src/modules/boxs/boxs.controller.js

const service = require('./boxs.service');

const getCartonSales = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const result = await service.getCartonSales(companyId, request.query || {});
        reply.send(result);
    } catch (error) {
        reply.code(500).send({ message: error.message || "Erreur serveur." });
    }
};

const getCartonSalesSummary = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const result = await service.getCartonSalesSummary(companyId, request.query || {});
        reply.send(result);
    } catch (error) {
        reply.code(500).send({ message: error.message || "Erreur serveur." });
    }
};

const updateCartonSale = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const cartonSaleId = parseInt(request.params.cartonSaleId, 10);

        const updated = await service.updateCartonSale(companyId, cartonSaleId, request.body || {});
        reply.send(updated);
    } catch (error) {
        reply.code(error?.status || 400).send({ message: error.message || "Erreur serveur." });
    }
};

module.exports = {
    getCartonSales,
    getCartonSalesSummary,
    updateCartonSale,
};
