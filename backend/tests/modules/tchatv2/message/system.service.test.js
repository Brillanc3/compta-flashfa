// backend/tests/modules/tchatv2/message/system.service.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '../../../../src');
const res = (rel) => _req.resolve(path.join(ROOT, rel));

let mockPrisma, mockEmitter, mockRepo, sendSystemMessage;

beforeEach(() => {
  mockPrisma = {
    v2Channel: {
      findUnique: vi.fn().mockResolvedValue({ id: 10n, guildId: 99n }),
      update: vi.fn().mockResolvedValue({}),
    },
    v2Guild: { findUnique: vi.fn().mockResolvedValue({ ownerId: 7 }) },
    v2Message: { create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data })) },
  };
  mockEmitter = { messageCreate: vi.fn() };
  mockRepo = {
    MESSAGE_SELECT: {},
    hydrateOne: vi.fn().mockImplementation((m) => Promise.resolve(m)),
    invalidateLastMsgCache: vi.fn(),
  };

  const dbPath = res('shards/database');
  const emPath = res('modules/tchatv2/sockets/socket.emitter');
  const rpPath = res('modules/tchatv2/message/message.repository');
  const svPath = res('modules/tchatv2/message/system.service');

  _req.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { prisma: mockPrisma } };
  _req.cache[emPath] = { id: emPath, filename: emPath, loaded: true, exports: mockEmitter };
  _req.cache[rpPath] = { id: rpPath, filename: rpPath, loaded: true, exports: mockRepo };
  delete _req.cache[svPath];

  ({ sendSystemMessage } = _req(path.join(ROOT, 'modules/tchatv2/message/system.service')));
});

describe('sendSystemMessage', () => {
  it('crée un message système avec WEBHOOK_FLAG et auteur = ownerId du guild', async () => {
    await sendSystemMessage({ channelId: '10', content: 'Stock bas !' });
    const data = mockPrisma.v2Message.create.mock.calls[0][0].data;
    expect(data.authorId).toBe(7);
    expect(data.authorUsername).toBe('Automation');
    expect(data.flags).toBe(64);
    expect(data.content).toBe('Stock bas !');
    expect(data.channelId).toBe(10n);
  });

  it('met à jour lastMessageId et diffuse messageCreate', async () => {
    await sendSystemMessage({ channelId: '10', content: 'x' });
    expect(mockPrisma.v2Channel.update).toHaveBeenCalled();
    expect(mockEmitter.messageCreate).toHaveBeenCalledWith('10', '99', expect.anything());
  });

  it('lève si le salon est introuvable', async () => {
    mockPrisma.v2Channel.findUnique.mockResolvedValue(null);
    await expect(sendSystemMessage({ channelId: '404', content: 'x' })).rejects.toThrow();
  });
});
