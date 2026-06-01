'use strict';

// Shim : ré-exporte le singleton Prisma sous forme { prisma }
const prisma = require('../db');

module.exports = { prisma };
