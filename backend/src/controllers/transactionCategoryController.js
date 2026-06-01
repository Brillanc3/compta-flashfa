// backend/src/controllers/transactionCategoryController.js
const prisma = require('../db');

const getAll = async (request, reply) => {
    try {
        const categories = await prisma.transactionCategory.findMany({
            orderBy: {
                name: 'asc'
            }
        });
        reply.send(categories);
    } catch (error) {
        request.log.error("Erreur lors de la récupération des catégories de transaction:", error);
        reply.code(500).send({ message: "Erreur serveur." });
    }
};

module.exports = {
    getAll,
};