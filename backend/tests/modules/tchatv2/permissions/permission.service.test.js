import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { resolveGuildPermissions, resolveChannelPermissions } = require('../../../../src/modules/tchatv2/permissions/permission.service');
const { Permission } = require('../../../../src/modules/tchatv2/tchatv2.constants');

const GUILD_ID    = 1000n;
const EVERYONE_ID = GUILD_ID;
const ROLE_A      = 1001n;
const ROLE_B      = 1002n;
const USER_ID     = 42n;

function roleMap(entries) {
    return new Map(entries.map(([id, p]) => [id, p]));
}

// ─── resolveGuildPermissions ─────────────────────────────────────────────────

describe('resolveGuildPermissions', () => {
    it('owner → toutes permissions', () => {
        expect(resolveGuildPermissions({
            isOwner: true, memberRoleIds: [], everyoneRoleId: EVERYONE_ID,
            rolePermissions: roleMap([[EVERYONE_ID, 0n]]),
        })).toBe(~0n);
    });

    it('@everyone ADMINISTRATOR → toutes permissions', () => {
        expect(resolveGuildPermissions({
            isOwner: false, memberRoleIds: [EVERYONE_ID], everyoneRoleId: EVERYONE_ID,
            rolePermissions: roleMap([[EVERYONE_ID, Permission.ADMINISTRATOR]]),
        })).toBe(~0n);
    });

    it('rôle ADMINISTRATOR → toutes permissions', () => {
        expect(resolveGuildPermissions({
            isOwner: false, memberRoleIds: [EVERYONE_ID, ROLE_A], everyoneRoleId: EVERYONE_ID,
            rolePermissions: roleMap([[EVERYONE_ID, 0n], [ROLE_A, Permission.ADMINISTRATOR]]),
        })).toBe(~0n);
    });

    it('accumulation rôles sans admin', () => {
        const p = resolveGuildPermissions({
            isOwner: false, memberRoleIds: [EVERYONE_ID, ROLE_A, ROLE_B], everyoneRoleId: EVERYONE_ID,
            rolePermissions: roleMap([
                [EVERYONE_ID, Permission.VIEW_CHANNEL],
                [ROLE_A, Permission.SEND_MESSAGES],
                [ROLE_B, Permission.READ_MESSAGE_HISTORY],
            ]),
        });
        expect(p).toBe(Permission.VIEW_CHANNEL | Permission.SEND_MESSAGES | Permission.READ_MESSAGE_HISTORY);
    });

    it('user sans rôle extra → seulement @everyone', () => {
        const evBase = Permission.VIEW_CHANNEL | Permission.READ_MESSAGE_HISTORY;
        expect(resolveGuildPermissions({
            isOwner: false, memberRoleIds: [EVERYONE_ID], everyoneRoleId: EVERYONE_ID,
            rolePermissions: roleMap([[EVERYONE_ID, evBase], [ROLE_A, Permission.SEND_MESSAGES]]),
        })).toBe(evBase);
    });

    it('aucune permission', () => {
        expect(resolveGuildPermissions({
            isOwner: false, memberRoleIds: [], everyoneRoleId: EVERYONE_ID,
            rolePermissions: roleMap([[EVERYONE_ID, 0n]]),
        })).toBe(0n);
    });
});

// ─── resolveChannelPermissions ───────────────────────────────────────────────

const basePerms = roleMap([
    [EVERYONE_ID, Permission.VIEW_CHANNEL | Permission.SEND_MESSAGES | Permission.READ_MESSAGE_HISTORY],
    [ROLE_A, Permission.MANAGE_MESSAGES],
]);

const base = {
    isOwner: false,
    memberRoleIds: [EVERYONE_ID, ROLE_A],
    rolePermissions: basePerms,
    everyoneRoleId: EVERYONE_ID,
    overwrites: [],
    userId: USER_ID,
};

describe('resolveChannelPermissions', () => {
    it('owner → toutes permissions', () => {
        expect(resolveChannelPermissions({ ...base, isOwner: true })).toBe(~0n);
    });

    it('ADMINISTRATOR bypass overwrites', () => {
        const p = resolveChannelPermissions({
            ...base,
            rolePermissions: roleMap([[EVERYONE_ID, Permission.ADMINISTRATOR], [ROLE_A, 0n]]),
            overwrites: [{ targetId: EVERYONE_ID, type: 0, allow: 0n, deny: Permission.SEND_MESSAGES }],
        });
        expect(p).toBe(~0n);
    });

    it('@everyone deny SEND_MESSAGES bloque tous', () => {
        const p = resolveChannelPermissions({
            ...base,
            overwrites: [{ targetId: EVERYONE_ID, type: 0, allow: 0n, deny: Permission.SEND_MESSAGES }],
        });
        expect(p & Permission.SEND_MESSAGES).toBe(0n);
        expect(p & Permission.VIEW_CHANNEL).not.toBe(0n);
    });

    it('@everyone deny + rôle allow → rôle gagne', () => {
        const p = resolveChannelPermissions({
            ...base,
            overwrites: [
                { targetId: EVERYONE_ID, type: 0, allow: 0n, deny: Permission.SEND_MESSAGES },
                { targetId: ROLE_A,      type: 0, allow: Permission.SEND_MESSAGES, deny: 0n },
            ],
        });
        expect(p & Permission.SEND_MESSAGES).not.toBe(0n);
    });

    it('member overwrite prioritaire sur rôles', () => {
        const p = resolveChannelPermissions({
            ...base,
            overwrites: [
                { targetId: ROLE_A,  type: 0, allow: Permission.SEND_MESSAGES, deny: 0n },
                { targetId: USER_ID, type: 1, allow: 0n, deny: Permission.SEND_MESSAGES },
            ],
        });
        expect(p & Permission.SEND_MESSAGES).toBe(0n);
    });

    it('member allow override deny @everyone', () => {
        const p = resolveChannelPermissions({
            ...base,
            overwrites: [
                { targetId: EVERYONE_ID, type: 0, allow: 0n, deny: Permission.SEND_MESSAGES },
                { targetId: USER_ID,     type: 1, allow: Permission.SEND_MESSAGES, deny: 0n },
            ],
        });
        expect(p & Permission.SEND_MESSAGES).not.toBe(0n);
    });

    it('sans VIEW_CHANNEL → 0n', () => {
        const p = resolveChannelPermissions({
            ...base,
            overwrites: [{ targetId: EVERYONE_ID, type: 0, allow: 0n, deny: Permission.VIEW_CHANNEL }],
        });
        expect(p).toBe(0n);
    });

    it('VIEW_CHANNEL retiré par member overwrite → 0n', () => {
        const p = resolveChannelPermissions({
            ...base,
            overwrites: [{ targetId: USER_ID, type: 1, allow: 0n, deny: Permission.VIEW_CHANNEL }],
        });
        expect(p).toBe(0n);
    });

    it('2 rôles conflictuels — deny accumulé puis allow accumulé', () => {
        const p = resolveChannelPermissions({
            ...base,
            memberRoleIds: [EVERYONE_ID, ROLE_A, ROLE_B],
            rolePermissions: roleMap([
                [EVERYONE_ID, Permission.VIEW_CHANNEL | Permission.SEND_MESSAGES],
                [ROLE_A, 0n], [ROLE_B, 0n],
            ]),
            overwrites: [
                { targetId: ROLE_A, type: 0, allow: 0n, deny: Permission.SEND_MESSAGES },
                { targetId: ROLE_B, type: 0, allow: Permission.SEND_MESSAGES, deny: 0n },
            ],
        });
        expect(p & Permission.SEND_MESSAGES).not.toBe(0n);
    });

    it('sans rôle extra — uniquement @everyone base', () => {
        const p = resolveChannelPermissions({
            ...base,
            memberRoleIds: [EVERYONE_ID],
            rolePermissions: roleMap([
                [EVERYONE_ID, Permission.VIEW_CHANNEL | Permission.READ_MESSAGE_HISTORY],
                [ROLE_A, Permission.SEND_MESSAGES],
            ]),
        });
        expect(p & Permission.SEND_MESSAGES).toBe(0n);
        expect(p & Permission.VIEW_CHANNEL).not.toBe(0n);
    });

    it('overwrites vides (allow=0, deny=0) → aucun effet', () => {
        const p = resolveChannelPermissions({
            ...base,
            overwrites: [
                { targetId: EVERYONE_ID, type: 0, allow: 0n, deny: 0n },
                { targetId: ROLE_A,      type: 0, allow: 0n, deny: 0n },
                { targetId: USER_ID,     type: 1, allow: 0n, deny: 0n },
            ],
        });
        const expected = Permission.VIEW_CHANNEL | Permission.SEND_MESSAGES
                       | Permission.READ_MESSAGE_HISTORY | Permission.MANAGE_MESSAGES;
        expect(p).toBe(expected);
    });

    it('timeout : SEND_MESSAGES + ADD_REACTIONS bloqués via member overwrite', () => {
        const p = resolveChannelPermissions({
            ...base,
            overwrites: [
                { targetId: USER_ID, type: 1, allow: 0n, deny: Permission.SEND_MESSAGES | Permission.ADD_REACTIONS },
            ],
        });
        expect(p & Permission.SEND_MESSAGES).toBe(0n);
        expect(p & Permission.ADD_REACTIONS).toBe(0n);
        expect(p & Permission.VIEW_CHANNEL).not.toBe(0n);
    });

    it('role deny multiple flags', () => {
        const p = resolveChannelPermissions({
            ...base,
            overwrites: [
                { targetId: ROLE_A, type: 0, allow: 0n, deny: Permission.SEND_MESSAGES | Permission.EMBED_LINKS },
            ],
        });
        expect(p & Permission.SEND_MESSAGES).toBe(0n);
        expect(p & Permission.EMBED_LINKS).toBe(0n);
    });

    it('hasPermission false → 0n perms', () => {
        const p = resolveGuildPermissions({
            isOwner: false, memberRoleIds: [], everyoneRoleId: EVERYONE_ID,
            rolePermissions: roleMap([[EVERYONE_ID, 0n]]),
        });
        expect(p).toBe(0n);
    });

    // ── Tests catégorie (parentId overwrites) ────────────────────────────────

    it('catégorie deny SEND_MESSAGES @everyone → bloqué même si guild perm accorde', () => {
        const p = resolveChannelPermissions({
            ...base,
            categoryOverwrites: [{ targetId: EVERYONE_ID, type: 0, allow: 0n, deny: Permission.SEND_MESSAGES }],
            overwrites: [],
        });
        expect(p & Permission.SEND_MESSAGES).toBe(0n);
        expect(p & Permission.VIEW_CHANNEL).not.toBe(0n);
    });

    it("catégorie allow SEND_MESSAGES pour rôle → accordé si global ne l'avait pas", () => {
        const p = resolveChannelPermissions({
            ...base,
            memberRoleIds: [EVERYONE_ID, ROLE_A],
            rolePermissions: roleMap([
                [EVERYONE_ID, Permission.VIEW_CHANNEL | Permission.READ_MESSAGE_HISTORY],
                [ROLE_A, 0n],
            ]),
            categoryOverwrites: [{ targetId: ROLE_A, type: 0, allow: Permission.SEND_MESSAGES, deny: 0n }],
            overwrites: [],
        });
        expect(p & Permission.SEND_MESSAGES).not.toBe(0n);
    });

    it('salon deny surpasse catégorie allow → salon gagne', () => {
        const p = resolveChannelPermissions({
            ...base,
            categoryOverwrites: [{ targetId: EVERYONE_ID, type: 0, allow: Permission.SEND_MESSAGES, deny: 0n }],
            overwrites: [{ targetId: EVERYONE_ID, type: 0, allow: 0n, deny: Permission.SEND_MESSAGES }],
        });
        expect(p & Permission.SEND_MESSAGES).toBe(0n);
    });

    it('catégorie deny mais salon allow → salon gagne', () => {
        const p = resolveChannelPermissions({
            ...base,
            categoryOverwrites: [{ targetId: EVERYONE_ID, type: 0, allow: 0n, deny: Permission.SEND_MESSAGES }],
            overwrites: [{ targetId: EVERYONE_ID, type: 0, allow: Permission.SEND_MESSAGES, deny: 0n }],
        });
        expect(p & Permission.SEND_MESSAGES).not.toBe(0n);
    });

    it('member overwrite surpasse catégorie deny', () => {
        const p = resolveChannelPermissions({
            ...base,
            categoryOverwrites: [{ targetId: EVERYONE_ID, type: 0, allow: 0n, deny: Permission.SEND_MESSAGES }],
            overwrites: [{ targetId: USER_ID, type: 1, allow: Permission.SEND_MESSAGES, deny: 0n }],
        });
        expect(p & Permission.SEND_MESSAGES).not.toBe(0n);
    });

    it('catégorie deny VIEW_CHANNEL → 0n', () => {
        const p = resolveChannelPermissions({
            ...base,
            categoryOverwrites: [{ targetId: EVERYONE_ID, type: 0, allow: 0n, deny: Permission.VIEW_CHANNEL }],
            overwrites: [],
        });
        expect(p).toBe(0n);
    });

    it('catégorie deny VIEW_CHANNEL mais member allow → VIEW_CHANNEL restauré', () => {
        const p = resolveChannelPermissions({
            ...base,
            categoryOverwrites: [{ targetId: EVERYONE_ID, type: 0, allow: 0n, deny: Permission.VIEW_CHANNEL }],
            overwrites: [{ targetId: USER_ID, type: 1, allow: Permission.VIEW_CHANNEL, deny: 0n }],
        });
        expect(p & Permission.VIEW_CHANNEL).not.toBe(0n);
    });

    it('sans categoryOverwrites → comportement inchangé', () => {
        const p = resolveChannelPermissions({
            ...base,
            overwrites: [{ targetId: EVERYONE_ID, type: 0, allow: 0n, deny: Permission.SEND_MESSAGES }],
        });
        expect(p & Permission.SEND_MESSAGES).toBe(0n);
        expect(p & Permission.VIEW_CHANNEL).not.toBe(0n);
    });

    it('catégorie rôle deny puis allow → allow cumulé gagne', () => {
        const p = resolveChannelPermissions({
            ...base,
            memberRoleIds: [EVERYONE_ID, ROLE_A, ROLE_B],
            rolePermissions: roleMap([
                [EVERYONE_ID, Permission.VIEW_CHANNEL | Permission.SEND_MESSAGES],
                [ROLE_A, 0n],
                [ROLE_B, 0n],
            ]),
            categoryOverwrites: [
                { targetId: ROLE_A, type: 0, allow: 0n, deny: Permission.SEND_MESSAGES },
                { targetId: ROLE_B, type: 0, allow: Permission.SEND_MESSAGES, deny: 0n },
            ],
            overwrites: [],
        });
        expect(p & Permission.SEND_MESSAGES).not.toBe(0n);
    });

    it('performance : 100k résolutions < 1s (5 rôles, 3 overwrites)', () => {
        const roles = [EVERYONE_ID, 2n, 3n, 4n, 5n];
        const rp = roleMap([
            [EVERYONE_ID, Permission.VIEW_CHANNEL | Permission.SEND_MESSAGES],
            [2n, Permission.READ_MESSAGE_HISTORY], [3n, Permission.MANAGE_MESSAGES],
            [4n, Permission.EMBED_LINKS], [5n, Permission.ATTACH_FILES],
        ]);
        const ows = [
            { targetId: EVERYONE_ID, type: 0, allow: 0n, deny: Permission.SEND_MESSAGES },
            { targetId: 2n,          type: 0, allow: Permission.SEND_MESSAGES, deny: 0n },
            { targetId: USER_ID,     type: 1, allow: Permission.MENTION_EVERYONE, deny: 0n },
        ];
        const start = Date.now();
        for (let i = 0; i < 100_000; i++) {
            resolveChannelPermissions({ isOwner: false, memberRoleIds: roles, rolePermissions: rp,
                everyoneRoleId: EVERYONE_ID, overwrites: ows, userId: USER_ID });
        }
        expect(Date.now() - start).toBeLessThan(1000);
    });
});
