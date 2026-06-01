// backend/src/db.js

const { PrismaClient } = require('@prisma/client');

// Cette astuce garantit qu'en développement, on ne crée pas une nouvelle connexion
// à chaque rechargement de fichier (hot-reloading).
const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient({
    log: ['info', 'warn', 'error'],
});

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

module.exports = prisma;