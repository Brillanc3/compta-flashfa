// /backend/src/modules/regie/regie.service.js
'use strict';

const NodeMediaServer = require('node-media-server');
const Context = require('node-media-server/src/core/context');
const prisma = require('../../db');
const { CH, xadd } = require('../../lib/sse/streams');
const { redis } = require('../../shards/redisClient');
const crypto = require('crypto');

let nms = null;
let activeCompanyId = null;

// Cache local des cles pour validation synchrone ultra-rapide
let localKeyCache = new Map(); // key -> expiresAt (Date)

/**
 * Met a jour le cache local des cles
 */
async function updateLocalKeyCache(companyId) {
    if (!companyId) return;
    const keys = await prisma.streamerKey.findMany({
        where: { companyId }
    });
    const now = new Map();
    keys.forEach(k => {
        now.set(k.key, k.expiresAt);
    });
    localKeyCache = now;
}

/**
 * Configure et démarre le serveur RTMP
 */
async function startRTMP(companyId) {
    if (nms) return { status: 'already_running' };
    activeCompanyId = companyId;

    // Initialisation du cache avant de demarrer le serveur
    await updateLocalKeyCache(companyId);

    const config = {
        rtmp: {
            port: parseInt(process.env.RTMP_PORT || 1935),
            host: '0.0.0.0',
            chunk_size: 60000,
            gop_cache: true,
            ping: 30,
            ping_timeout: 60
        },
        http: {
            port: parseInt(process.env.RTMP_HTTP_PORT || 8000),
            allow_origin: '*'
        },
        auth: {
            publish: false,
            secret: process.env.RTMP_SECRET || 'regie_secret_default'
        }
    };

    nms = new NodeMediaServer(config);

    // Logs de connexion de bas niveau
    nms.on('preConnect', (id, args) => {
        console.log(`[RTMP] [INFO] Tentative de connexion (ID: ${id})`, args);
    });

    nms.on('postConnect', (id, args) => {
        console.log(`[RTMP] [OK] Connecté (ID: ${id})`);
    });

    nms.on('doneConnect', (id, args) => {
        console.log(`[RTMP] [QUIT] Déconnecté (ID: ${id})`);
    });

    // Hook validation de cle (prePublish) - SYNCHRONE
    nms.on('prePublish', (session, StreamPath, args) => {
        const s = session || {};
        const path = s.streamPath || StreamPath || '';
        const id = s.id || 'unknown';
        const streamKey = s.streamName || path.split('/').pop();

        console.log(`[RTMP] [INFO] Tentative de stream - Session: ${id}, Key: ${streamKey}`);

        // Validation via cache local (INSTANTANE)
        const expiry = localKeyCache.get(streamKey);
        const exists = localKeyCache.has(streamKey);
        const isExpired = exists && expiry && new Date(expiry) < new Date();

        if (!exists || isExpired) {
            const reason = !exists ? 'Cle inconnue' : 'Cle expiree';
            console.log(`[RTMP] [REJECT] ${reason} : ${streamKey}`);

            // Rejet immédiat
            if (s.reject) s.reject();
            if (s.socket && s.socket.destroy) s.socket.destroy();
            return;
        }

        console.log(`[RTMP] [OK] Stream autorise : ${streamKey}`);
    });

    nms.run();
    console.log(`[Regie] [INFO] Serveur RTMP demarre sur le port ${config.rtmp.port}`);
    return { status: 'started', port: config.rtmp.port };
}

/**
 * Arrête le serveur RTMP
 */
async function stopRTMP() {
    if (!nms) return { status: 'not_running' };

    try {
        console.log('[Regie] 🛑 Tentative d\'arrêt du serveur RTMP...');
        
        if (typeof nms.stop === 'function') {
            nms.stop();
        } else {
            // Arrêt manuel pour Node-Media-Server v4.x (qui n'a pas de méthode .stop())
            if (nms.rtmpServer) {
                if (nms.rtmpServer.tcpServer) nms.rtmpServer.tcpServer.close();
                if (nms.rtmpServer.tlsServer) nms.rtmpServer.tlsServer.close();
            }
            if (nms.httpServer) {
                if (nms.httpServer.httpServer) nms.httpServer.httpServer.close();
                if (nms.httpServer.httpsServer) nms.httpServer.httpsServer.close();
            }

            // Fermeture de toutes les sessions actives via le contexte interne
            if (Context && Context.sessions) {
                Context.sessions.forEach((session, id) => {
                    console.log(`[Regie] Fermeture forcée de la session : ${id}`);
                    if (session.reject) session.reject();
                    if (session.socket && session.socket.destroy) session.socket.destroy();
                });
            }
        }
        
        console.log('[Regie] ✅ Serveur RTMP arrêté avec succès');
    } catch (error) {
        console.error('[Regie] ❌ Erreur lors de l\'arrêt du serveur RTMP :', error);
    } finally {
        nms = null;
        activeCompanyId = null;
    }

    return { status: 'stopped' };
}

/**
 * État du serveur
 */
function getServerStatus() {
    return nms ? 'running' : 'stopped';
}

/**
 * Gestion des clés de streaming
 */
async function listKeys(companyId) {
    return prisma.streamerKey.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' }
    });
}

async function generateKey(companyId, label, expiresAt = null) {
    const key = crypto.randomBytes(16).toString('hex');
    const result = await prisma.streamerKey.create({
        data: {
            key,
            label,
            companyId,
            expiresAt: expiresAt ? new Date(expiresAt) : null
        }
    });

    // Mise a jour cache
    await updateLocalKeyCache(companyId);
    return result;
}

async function deleteKey(companyId, keyId) {
    // 1. Recuperation de la cle avant suppression pour pouvoir la couper si elle est active
    const targetKey = await prisma.streamerKey.findFirst({
        where: { id: parseInt(keyId), companyId }
    });

    if (!targetKey) return;

    // 2. Suppression en base de donnees
    await prisma.streamerKey.delete({
        where: { id: targetKey.id }
    });

    console.log(`[Regie] Suppression de la cle : ${targetKey.key}`);

    // 3. Mise a jour cache (SYNCHRONE)
    await updateLocalKeyCache(companyId);

    // 4. Deconnexion forcee des flux actifs utilisant cette cle
    // On utilise Context.sessions car nms.sessions n'est pas exporté dans cette version
    if (Context && Context.sessions) {
        Context.sessions.forEach((session, id) => {
            if (session.streamName === targetKey.key || (session.streamPath && session.streamPath.endsWith(targetKey.key))) {
                console.log(`[Regie] Deconnexion forcee du flux actif : ${id}`);
                if (session.reject) session.reject();
                if (session.socket && session.socket.destroy) session.socket.destroy();
            }
        });
    }

    return true;
}

/**
 * Contrôle d'urgence (TV)
 */
async function toggleEmergency(companyId, keyId, status) {
    const record = await prisma.streamerKey.findFirst({
        where: { id: parseInt(keyId), companyId }
    });

    if (!record) throw new Error("Clé introuvable");

    const updated = await prisma.streamerKey.update({
        where: { id: record.id },
        data: { isEmergency: !!status }
    });

    // Notifier via SSE (Redis Stream)
    // On notifie le stream de la company
    await xadd(redis, CH.company(companyId), 'regie:emergency', {
        key: record.key,
        isEmergency: !!status
    });

    return updated;
}

async function getKeyStatus(key) {
    return prisma.streamerKey.findUnique({
        where: { key },
        select: { key: true, companyId: true, isEmergency: true, label: true }
    });
}

module.exports = {
    startRTMP,
    stopRTMP,
    getServerStatus,
    listKeys,
    generateKey,
    deleteKey,
    toggleEmergency,
    getKeyStatus
};
