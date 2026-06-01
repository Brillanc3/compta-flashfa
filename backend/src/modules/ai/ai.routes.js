// backend/src/modules/ai/ai.routes.js
'use strict';

const assert = require('node:assert');
const prisma = require('../../db');

async function aiRoutes(fastify, options) {
    const authenticate = fastify.authenticate || ((req, _res, done) => done());
    const AI_URL = process.env.AI_LOCAL_URL || 'http://127.0.0.1:11434/ask';
    const INTERNAL_TOKEN = process.env.AI_INTERNAL_TOKEN || process.env.AI_BOT_TOKEN || '';

    fastify.post('/ask', { preHandler: authenticate }, async (req, reply) => {
        try {
            const userId = req.user.userId; // récupéré depuis le token JWT
            const companyIdHeader = req.headers['x-company-id'];
            const companyId = companyIdHeader ? parseInt(companyIdHeader, 10) : null;

            if (!userId) {
                return reply.code(401).send({ message: 'Unauthorized' });
            }
            if (!companyId) {
                return reply.code(403).send({ message: 'Company required' });
            }

            const question = String(req.body?.question ?? '').trim();
            if (!question) {
                return reply.code(400).send({ message: 'Question manquante' });
            }

            if (!INTERNAL_TOKEN) {
                req.log?.warn('[ai.routes] AI_INTERNAL_TOKEN manquant côté backend');
                return reply.code(500).send({ message: 'AI backend not configured' });
            }

            // Vérifie que l'utilisateur appartient à l’entreprise (si Prisma est décoré)
            if (prisma) {
                const isEmployee = await prisma.companyEmployee.count({
                    where: { userId: Number(userId), companyId: Number(companyId) }
                });
                if (!isEmployee) {
                    return reply.code(403).send({ message: 'Forbidden' });
                }
            }

            const r = await fetch(AI_URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-internal-token': INTERNAL_TOKEN
                },
                body: JSON.stringify({ question })
            });

            const raw = await r.text();
            // Passe-plat : si c’est du JSON on relaie tel quel, sinon on wrap
            try {
                const json = JSON.parse(raw);
                return reply.send(json);
            } catch {
                return reply.send({ answer: raw });
            }
        } catch (e) {
            req.log?.error(e);
            return reply.code(502).send({ message: 'AI backend unreachable' });
        }
    });
};

module.exports = { name: 'ai', routes: aiRoutes };
