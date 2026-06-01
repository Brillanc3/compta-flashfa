// backend/tests/modules/automation/getConfig.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '../../../src');
const res = (rel) => _req.resolve(path.join(ROOT, rel));

let mockPrisma, mockRegistry, mockChannels, getConfig;

beforeEach(() => {
  mockPrisma = { companyModule: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) } };
  mockRegistry = {
    scan: vi.fn().mockResolvedValue(),
    getConfig: vi.fn().mockReturnValue({
      blocks: [{ type: 'action_tchat_send_message', args0: [{ type: 'field_dropdown', name: 'CHANNEL', options: [['(sélectionner un salon)', '0']] }] }],
      toolbox: [], moduleDefinitions: {},
    }),
  };
  mockChannels = { getCompanyTextChannels: vi.fn().mockResolvedValue([{ id: '10', name: 'logs' }]) };

  const dbPath = res('db');
  const regPath = res('modules/automation/automationRegistry');
  const chPath = res('modules/tchatv2/lib/companyChannels');
  const ctrlPath = res('modules/automation/automation.controller');

  _req.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockPrisma };
  _req.cache[regPath] = { id: regPath, filename: regPath, loaded: true, exports: mockRegistry };
  _req.cache[chPath] = { id: chPath, filename: chPath, loaded: true, exports: mockChannels };
  delete _req.cache[ctrlPath];
  ({ getConfig } = _req(path.join(ROOT, 'modules/automation/automation.controller')));
});

function reply() {
  const r = {};
  r.status = vi.fn().mockReturnValue(r);
  r.send = vi.fn().mockReturnValue(r);
  return r;
}

describe('getConfig — injection des salons', () => {
  it('remplace les options du dropdown CHANNEL par les salons de la company', async () => {
    const rep = reply();
    await getConfig({ headers: { 'x-company-id': '5' } }, rep);
    const sent = rep.send.mock.calls[0][0];
    const block = sent.blocks.find((b) => b.type === 'action_tchat_send_message');
    const channelArg = block.args0.find((a) => a.name === 'CHANNEL');
    expect(channelArg.options).toEqual([['#logs', '10']]);
  });

  it('ne mute pas l\'objet partagé du registry (clone)', async () => {
    const rep = reply();
    await getConfig({ headers: { 'x-company-id': '5' } }, rep);
    const original = mockRegistry.getConfig().blocks[0].args0[0].options;
    expect(original).toEqual([['(sélectionner un salon)', '0']]);
  });
});
