// backend/tests/modules/automation/permissions.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '../../../src');
const { PERMISSIONS, DESCRIPTIONS, buildAutomationGuard } = _req(path.join(ROOT, 'modules/automation/automation.permissions'));

// authMiddleware factice : hasPermission = appartenance exacte au Set.
function fakeAuth(permsSet) {
  return {
    buildEffectiveCompanyPermissions: vi.fn().mockResolvedValue(permsSet),
    hasPermission: (perms, required) => perms.has(required),
  };
}

function makeReply() {
  const r = { _status: null, _body: null };
  r.code = vi.fn((n) => { r._status = n; return r; });
  r.send = vi.fn((b) => { r._body = b; return r; });
  return r;
}

const reqWith = (perms, { company = '5', userId = 42, apiKey = false } = {}) => ({
  headers: { 'x-company-id': company },
  user: userId ? { userId, isApiKey: apiKey } : (apiKey ? { isApiKey: true } : undefined),
});

describe('buildAutomationGuard', () => {
  it('400 si header x-company-id manquant', async () => {
    const { canView } = buildAutomationGuard(fakeAuth(new Set()));
    const reply = makeReply();
    await canView({ headers: {}, user: { userId: 1 } }, reply);
    expect(reply._status).toBe(400);
  });

  it('401 si non authentifié', async () => {
    const { canView } = buildAutomationGuard(fakeAuth(new Set()));
    const reply = makeReply();
    await canView({ headers: { 'x-company-id': '5' }, user: undefined }, reply);
    expect(reply._status).toBe(401);
  });

  it('dirigeant (COMPANY.{id}.*) bypass', async () => {
    const { canManage } = buildAutomationGuard(fakeAuth(new Set(['COMPANY.5.*'])));
    const reply = makeReply();
    await canManage(reqWith(new Set(['COMPANY.5.*'])), reply);
    expect(reply.code).not.toHaveBeenCalled();
  });

  it('ADMIN.* bypass', async () => {
    const { canManage } = buildAutomationGuard(fakeAuth(new Set(['ADMIN.*'])));
    const reply = makeReply();
    await canManage(reqWith(new Set(['ADMIN.*'])), reply);
    expect(reply.code).not.toHaveBeenCalled();
  });

  it('canManage refuse un utilisateur VIEW seul (403 AUTOMATION_FORBIDDEN)', async () => {
    const perms = new Set(['AUTOMATION.5.VIEW']);
    const { canManage } = buildAutomationGuard(fakeAuth(perms));
    const reply = makeReply();
    await canManage(reqWith(perms), reply);
    expect(reply._status).toBe(403);
    expect(reply._body.code).toBe('AUTOMATION_FORBIDDEN');
  });

  it('canManage autorise MANAGE', async () => {
    const perms = new Set(['AUTOMATION.5.MANAGE']);
    const { canManage } = buildAutomationGuard(fakeAuth(perms));
    const reply = makeReply();
    await canManage(reqWith(perms), reply);
    expect(reply.code).not.toHaveBeenCalled();
  });

  it('canView autorise VIEW comme MANAGE', async () => {
    for (const p of ['AUTOMATION.5.VIEW', 'AUTOMATION.5.MANAGE']) {
      const perms = new Set([p]);
      const { canView } = buildAutomationGuard(fakeAuth(perms));
      const reply = makeReply();
      await canView(reqWith(perms), reply);
      expect(reply.code, `perm ${p}`).not.toHaveBeenCalled();
    }
  });

  it('canView refuse un utilisateur sans permission', async () => {
    const perms = new Set(['INVENTORY.5.VIEW_ALL']);
    const { canView } = buildAutomationGuard(fakeAuth(perms));
    const reply = makeReply();
    await canView(reqWith(perms), reply);
    expect(reply._status).toBe(403);
  });

  it('clé API : laisse passer (scopes déjà validés)', async () => {
    const { canManage } = buildAutomationGuard(fakeAuth(new Set()));
    const reply = makeReply();
    await canManage({ headers: { 'x-company-id': '5' }, user: { isApiKey: true } }, reply);
    expect(reply.code).not.toHaveBeenCalled();
  });

  it('expose les templates de permission', () => {
    expect(PERMISSIONS.VIEW).toBe('AUTOMATION.{companyId}.VIEW');
    expect(PERMISSIONS.MANAGE).toBe('AUTOMATION.{companyId}.MANAGE');
  });

  it('fournit une description pour chaque permission (UI rangs)', () => {
    expect(DESCRIPTIONS[PERMISSIONS.VIEW]).toBeTruthy();
    expect(DESCRIPTIONS[PERMISSIONS.MANAGE]).toBeTruthy();
  });
});
