'use strict';

const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutObjectCommand } = require('@aws-sdk/client-s3');

const R2_BUCKET      = process.env.R2_BUCKET;
const R2_ACCOUNT_ID  = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY  = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY  = process.env.R2_SECRET_ACCESS_KEY;
const R2_PUBLIC_URL  = process.env.R2_PUBLIC_URL; // ex: https://<bucket>.<account>.r2.dev

const client = new S3Client({
    region:   'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId:     R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET_KEY,
    },
});

/**
 * Génère une presigned PUT URL.
 * P0.5 — ContentType + ContentLength obligatoires, signés ; TTL réduit à 5 min.
 *
 * @param {string} key
 * @param {string} contentType
 * @param {number} contentLength taille exacte en octets (signée, le client doit l'envoyer telle quelle)
 * @param {number} [expiresIn=300] TTL en secondes
 * @returns {Promise<string>}
 */
async function presignedPutUrl(key, contentType, contentLength, expiresIn = 300) {
    const cmd = new PutObjectCommand({
        Bucket:        R2_BUCKET,
        Key:           key,
        ContentType:   contentType,
        ContentLength: contentLength,
    });
    return getSignedUrl(client, cmd, {
        expiresIn,
        signableHeaders: new Set(['content-type', 'content-length']),
    });
}

/**
 * Vérifie qu'un objet existe en R2 (HeadObject).
 * @param {string} key
 * @returns {Promise<boolean>}
 */
async function objectExists(key) {
    try {
        await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
        return true;
    } catch {
        return false;
    }
}

/**
 * Construit l'URL publique d'un objet R2.
 * @param {string} key
 * @returns {string}
 */
function publicUrl(key) {
    return `${R2_PUBLIC_URL}/${key}`;
}

module.exports = { presignedPutUrl, objectExists, publicUrl, client, R2_BUCKET };
