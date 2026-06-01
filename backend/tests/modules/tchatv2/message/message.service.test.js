import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req      = createRequire(import.meta.url);
const ROOT      = path.resolve(__dirname, '../../../../src');
const res       = (rel) => _req.resolve(path.join(ROOT, rel));

const GUILD_ID   = '184114209219497984';
const CHANNEL_ID = '184114209219497985';

// Auteur : user 10, companyEmployee de company 1
const AUTHOR = {
    id:       10,
    username: 'auteur_test',
    companyEmployee: { companyId: 1 },
};

// User mentionné
const MENTIONED_USER_ID = 4;

let mockPrisma;
let mockTx;
let mockEmitter;
let mockRepo;
let mockSnow;
let createMessage;

beforeEach(() => {
    mockTx = {
        v2Attachment:      { findMany: vi.fn().mockResolvedValue([]) },
        v2Message:         { create: vi.fn() },
        v2MessageMention:  { createMany: vi.fn().mockResolvedValue({}) },
        v2Channel:         { update: vi.fn().mockResolvedValue({}), findUnique: vi.fn().mockResolvedValue({ threadMetadata: null }) },
    };

    const createdMsg = {
        id:               BigInt('999000000000000001'),
        channelId:        BigInt(CHANNEL_ID),
        authorId:         AUTHOR.id,
        authorUsername:   AUTHOR.username,
        authorAvatarHash: null,
        authorNickname:   null,
        type:             0,
        content:          `Bonjour <@${MENTIONED_USER_ID}>`,
        editedAt:         null,
        pinned:           false,
        tts:              false,
        nonce:            null,
        flags:            0,
        referencedMessageId: null,
        mentionsJson:     `{"users":[${MENTIONED_USER_ID}],"roles":[],"channels":[],"everyone":false,"here":false}`,
        reactionsSummary: null,
        createdAt:        new Date(),
        attachments:      [],
        embeds:           [],
    };

    mockTx.v2Message.create.mockResolvedValue(createdMsg);

    mockPrisma = {
        v2Member: {
            // isTimedOut + getMemberSnapshot
            findUnique: vi.fn().mockImplementation(({ where }) => {
                const uid = where?.guildId_userId?.userId ?? where?.userId;
                if (Number(uid) === AUTHOR.id) {
                    return Promise.resolve({
                        timeoutUntil: null,
                        nickname:     null,
                        avatarHash:   null,
                        user:         { username: AUTHOR.username },
                    });
                }
                return Promise.resolve(null);
            }),
        },
        v2Channel: {
            findUnique: vi.fn().mockResolvedValue({ threadMetadata: null }),
        },
        $transaction: vi.fn((fn) => fn(mockTx)),
    };

    mockEmitter = {
        messageCreate: vi.fn(),
    };

    mockRepo = {
        MESSAGE_SELECT:       {},
        invalidateLastMsgCache: vi.fn(),
        hydrateOne:           vi.fn().mockResolvedValue({ id: '999000000000000001' }),
    };

    mockSnow = { nextV2: vi.fn().mockReturnValue(BigInt('999000000000000001')) };

    const dbPath      = res('shards/database');
    const repoPath    = res('modules/tchatv2/message/message.repository');
    const snowPath    = res('modules/tchatv2/lib/snowflake');
    const cachePath   = res('modules/tchatv2/lib/cache');
    const emitterPath = res('modules/tchatv2/sockets/socket.emitter');
    const embedPath   = res('modules/tchatv2/message/embed.service');
    const auditPath   = res('modules/tchatv2/moderation/audit.service');
    const permPath    = res('modules/tchatv2/permissions/permission.cache');
    const mentionPath = res('modules/tchatv2/message/mention.service');
    const svcPath     = res('modules/tchatv2/message/message.service');

    _req.cache[dbPath]      = { id: dbPath,      filename: dbPath,      loaded: true, exports: { prisma: mockPrisma } };
    _req.cache[repoPath]    = { id: repoPath,     filename: repoPath,    loaded: true, exports: mockRepo };
    _req.cache[snowPath]    = { id: snowPath,     filename: snowPath,    loaded: true, exports: mockSnow };
    _req.cache[cachePath]   = { id: cachePath,    filename: cachePath,   loaded: true, exports: { delPattern: vi.fn(), key: (...a) => a.join(':'), get: vi.fn().mockResolvedValue(null), set: vi.fn() } };
    _req.cache[emitterPath] = { id: emitterPath,  filename: emitterPath, loaded: true, exports: mockEmitter };
    _req.cache[embedPath]   = { id: embedPath,    filename: embedPath,   loaded: true, exports: { enqueueEmbeds: vi.fn().mockResolvedValue(undefined) } };
    _req.cache[auditPath]   = { id: auditPath,    filename: auditPath,   loaded: true, exports: { log: vi.fn() } };
    _req.cache[permPath]    = { id: permPath,     filename: permPath,    loaded: true, exports: { getChannelPermissions: vi.fn().mockResolvedValue(0n) } };
    // parseMentions retourne des BigInts — JSON.stringify échoue sur BigInt,
    // on mock pour retourner des numbers afin de tester le flux du service.
    _req.cache[mentionPath] = { id: mentionPath, filename: mentionPath, loaded: true, exports: {
        parseMentions: vi.fn().mockReturnValue({ users: [MENTIONED_USER_ID], roles: [], channels: [], everyone: false, here: false }),
    }};
    delete _req.cache[svcPath];

    ({ createMessage } = _req(path.join(ROOT, 'modules/tchatv2/message/message.service')));
});

afterEach(() => {
    [
        'shards/database',
        'modules/tchatv2/message/message.repository',
        'modules/tchatv2/lib/snowflake',
        'modules/tchatv2/lib/cache',
        'modules/tchatv2/sockets/socket.emitter',
        'modules/tchatv2/message/embed.service',
        'modules/tchatv2/moderation/audit.service',
        'modules/tchatv2/permissions/permission.cache',
        'modules/tchatv2/message/mention.service',
        'modules/tchatv2/message/message.service',
    ].forEach(p => delete _req.cache[res(p)]);
});

describe('createMessage — mention user <@4>', () => {
    it('crée le message avec ping <@4> dans le channel 184114209219497985', async () => {
        const content = `Bonjour <@${MENTIONED_USER_ID}>`;

        await createMessage({
            channelId: CHANNEL_ID,
            guildId:   GUILD_ID,
            authorId:  AUTHOR.id,
            content,
        });

        // Message inséré en base
        expect(mockTx.v2Message.create).toHaveBeenCalledOnce();
        const createArgs = mockTx.v2Message.create.mock.calls[0][0].data;
        expect(createArgs.content).toBe(content);
        expect(createArgs.channelId).toBe(BigInt(CHANNEL_ID));
        expect(createArgs.authorId).toBe(AUTHOR.id);

        // Ligne de mention pour userId 4
        expect(mockTx.v2MessageMention.createMany).toHaveBeenCalledOnce();
        const mentionData = mockTx.v2MessageMention.createMany.mock.calls[0][0].data;
        expect(mentionData.some(r => r.targetId === MENTIONED_USER_ID)).toBe(true);

        // Broadcast socket
        expect(mockEmitter.messageCreate).toHaveBeenCalledWith(
            CHANNEL_ID,
            GUILD_ID,
            expect.anything(),
        );
    });

    it('auteur non timeout peut envoyer', async () => {
        await expect(
            createMessage({
                channelId: CHANNEL_ID,
                guildId:   GUILD_ID,
                authorId:  AUTHOR.id,
                content:   'Simple message',
            })
        ).resolves.toBeDefined();
    });

    it('auteur timeout est rejeté (403)', async () => {
        // Simule un membre avec timeout actif
        mockPrisma.v2Member.findUnique.mockResolvedValue({
            timeoutUntil: new Date(Date.now() + 60_000),
        });

        await expect(
            createMessage({
                channelId: CHANNEL_ID,
                guildId:   GUILD_ID,
                authorId:  AUTHOR.id,
                content:   `Bonjour <@${MENTIONED_USER_ID}>`,
            })
        ).rejects.toMatchObject({ statusCode: 403 });
    });
});
