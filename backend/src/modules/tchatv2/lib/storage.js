'use strict';

const { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const MINIO_ENDPOINT   = process.env.MINIO_ENDPOINT;
const MINIO_BUCKET     = process.env.MINIO_BUCKET;
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY_ID;
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_ACCESS_KEY;
const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL;

const client = new S3Client({
    region:          'us-east-1',
    endpoint:        MINIO_ENDPOINT,
    forcePathStyle:  true,
    credentials: {
        accessKeyId:     MINIO_ACCESS_KEY,
        secretAccessKey: MINIO_SECRET_KEY,
    },
});

async function putObject(key, buffer, contentType) {
    await client.send(new PutObjectCommand({
        Bucket:        MINIO_BUCKET,
        Key:           key,
        Body:          buffer,
        ContentType:   contentType,
        ContentLength: buffer.length,
    }));
}

async function deleteObject(key) {
    await client.send(new DeleteObjectCommand({ Bucket: MINIO_BUCKET, Key: key }));
}

async function objectExists(key) {
    try {
        await client.send(new HeadObjectCommand({ Bucket: MINIO_BUCKET, Key: key }));
        return true;
    } catch {
        return false;
    }
}

function publicUrl(key) {
    return `${MINIO_PUBLIC_URL}/${key}`;
}

module.exports = { putObject, deleteObject, objectExists, publicUrl };
