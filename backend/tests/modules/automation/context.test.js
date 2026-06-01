// backend/tests/modules/automation/context.test.js
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '../../../src');
const ctx = _req(path.join(ROOT, 'modules/automation/lib/context'));

describe('context extractors', () => {
  it('parse data JSON string ou objet', () => {
    expect(ctx.getAmount({ data: '{"amount":42}' })).toBe(42);
    expect(ctx.getAmount({ data: { amount: 7 } })).toBe(7);
    expect(ctx.getAmount({})).toBe(0);
  });

  it('getReason lit reason ou comment', () => {
    expect(ctx.getReason({ data: { reason: 'Loyer' } })).toBe('Loyer');
    expect(ctx.getReason({ data: { comment: 'Note' } })).toBe('Note');
    expect(ctx.getReason({})).toBe('');
  });

  it('getItem renvoie code et libellé inventaire', () => {
    const c = { data: { item: 'water', metadata: { formatname: 'Bouteille d\'eau' } } };
    expect(ctx.getItem(c)).toEqual({ code: 'water', label: 'Bouteille d\'eau' });
  });

  it('getItem tombe sur le code si pas de libellé', () => {
    expect(ctx.getItem({ data: { item: 'bread' } })).toEqual({ code: 'bread', label: 'bread' });
  });

  it('getQuantity et getOwner', () => {
    const c = { data: { count: 3, owner: 'stash_42' } };
    expect(ctx.getQuantity(c)).toBe(3);
    expect(ctx.getOwner(c)).toBe('stash_42');
  });

  it('résiste au JSON invalide', () => {
    expect(ctx.getAmount({ data: 'pas-du-json' })).toBe(0);
  });
});
