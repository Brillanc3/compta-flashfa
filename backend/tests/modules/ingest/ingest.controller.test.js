// backend/tests/modules/ingest/ingest.controller.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '../../../src');

// Dépendances CJS remplacées via le cache de require (db, file Redis, client Redis).
const prisma = { company: { findFirst: vi.fn() } };
const ingestQueue = { enqueueAndCreateLog: vi.fn() };
const redis = { set: vi.fn() };
function stub(rel, exports) {
  const file = _req.resolve(path.join(ROOT, rel));
  _req.cache[file] = { id: file, filename: file, loaded: true, exports };
}
stub('db', prisma);
stub('lib/ingestQueueRedis', ingestQueue);
stub('shards/redisClient', { redis });
stub('modules/ingest/ingest.service', { process: vi.fn() });

const { handleIngestion } = _req(path.join(ROOT, 'modules/ingest/ingest.controller'));
const { ingestKeyData, hashApiKey } = _req(path.join(ROOT, 'lib/apiKeyHash'));

function makeReply() {
  const r = { _status: null, _body: null };
  r.code = vi.fn((n) => { r._status = n; return r; });
  r.send = vi.fn((b) => { r._body = b; return r; });
  return r;
}

const RAW_KEY = 'a'.repeat(8) + crypto.randomBytes(16).toString('hex') + 'zzzz';
const request = (apiKey = RAW_KEY) => ({
  params: { companyId: '7', apiKey },
  body: { logType: 'test', data: {} },
  query: {},
  headers: {},
  log: { error: vi.fn() },
});

describe('ingestKeyData', () => {
  it('stocke le hash SHA-256 et un indice, jamais la clé', () => {
    const data = ingestKeyData(RAW_KEY);
    expect(data.apiKeyHash).toBe(crypto.createHash('sha256').update(RAW_KEY).digest('hex'));
    expect(data.apiKeyHint).toBe(`aaaaaaaa...zzzz`);
    expect(JSON.stringify(data)).not.toContain(RAW_KEY);
  });
});

describe('handleIngestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redis.set.mockResolvedValue('OK');
    ingestQueue.enqueueAndCreateLog.mockResolvedValue({ jobId: 'j1', logId: 1 });
  });

  it('cherche l\'entreprise par hash de la clé reçue', async () => {
    prisma.company.findFirst.mockResolvedValue({ id: 7, isApiActive: true });
    const reply = makeReply();
    await handleIngestion(request(), reply);

    expect(prisma.company.findFirst).toHaveBeenCalledWith({
      where: { id: 7, apiKeyHash: hashApiKey(RAW_KEY) },
    });
    expect(reply._body).toMatchObject({ success: true, jobId: 'j1' });
  });

  it('refuse une clé inconnue', async () => {
    prisma.company.findFirst.mockResolvedValue(null);
    const reply = makeReply();
    await handleIngestion(request('mauvaise-cle'), reply);

    expect(reply._body).toMatchObject({ success: false });
    expect(ingestQueue.enqueueAndCreateLog).not.toHaveBeenCalled();
  });
});
