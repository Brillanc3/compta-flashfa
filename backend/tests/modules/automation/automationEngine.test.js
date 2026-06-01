// backend/tests/modules/automation/automationEngine.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '../../../src');
const res = (rel) => _req.resolve(path.join(ROOT, rel));

let engine;

beforeEach(() => {
  vi.useFakeTimers(); // empêche le setInterval du scheduler de tourner pendant le test
  const enginePath = res('modules/automation/lib/automationEngine');
  delete _req.cache[enginePath];
  engine = _req(path.join(ROOT, 'modules/automation/lib/automationEngine'));
});

describe('normalizeTrigger', () => {
  it('rend identiques le format event_* et le format MAJUSCULE', () => {
    expect(engine.normalizeTrigger('event_inventory_entry')).toBe('INVENTORY_ENTRY');
    expect(engine.normalizeTrigger('INVENTORY_ENTRY')).toBe('INVENTORY_ENTRY');
  });
});

describe('mapLogToTrigger', () => {
  it('mappe add/remove inventaire', () => {
    expect(engine.mapLogToTrigger({ category: 'inventory', logType: 'add' })).toBe('event_inventory_entry');
    expect(engine.mapLogToTrigger({ category: 'inventory', logType: 'remove' })).toBe('event_inventory_exit');
  });
  it('mappe les types compta connus', () => {
    expect(engine.mapLogToTrigger({ logType: 'paid' })).toBe('event_compta_bill_paid');
    expect(engine.mapLogToTrigger({ logType: 'addmoney' })).toBe('event_compta_money_received');
  });
});

describe('SCHEDULE_TRIGGER', () => {
  it('correspond au bloc event_every_minute (normalisé EVERY_MINUTE)', () => {
    // Les workflows planifiés sont enregistrés avec le trigger du bloc admin
    // `event_every_minute` (stocké "EVERY_MINUTE" côté frontend). Le scheduler
    // doit tirer un trigger qui normalise vers la même valeur, sinon il ne
    // matchera jamais (régression historique).
    expect(engine.normalizeTrigger(engine.SCHEDULE_TRIGGER)).toBe('EVERY_MINUTE');
  });
});
