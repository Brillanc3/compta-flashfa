// backend/tests/modules/automation/memory.test.js
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '../../../src');
const { createMemory } = _req(path.join(ROOT, 'modules/automation/lib/memory'));

describe('createMemory', () => {
  it('démarre propre (non dirty) et lit la valeur initiale', () => {
    const m = createMemory({ stock: 5 });
    expect(m.get('stock')).toBe(5);
    expect(m.dirty).toBe(false);
  });

  it('set marque dirty', () => {
    const m = createMemory();
    m.set('x', 'hello');
    expect(m.get('x')).toBe('hello');
    expect(m.dirty).toBe(true);
  });

  it('add accumule numériquement et renvoie le total', () => {
    const m = createMemory({ stock: 2 });
    expect(m.add('stock', 3)).toBe(5);
    expect(m.add('neuf', 1)).toBe(1); // clé absente => 0 + 1
    expect(m.dirty).toBe(true);
  });

  it('clear vide tout et marque dirty', () => {
    const m = createMemory({ a: 1 });
    m.clear();
    expect(m.get('a')).toBeUndefined();
    expect(m.dirty).toBe(true);
  });

  it('toObject sérialise la mémoire', () => {
    const m = createMemory({ a: 1 });
    m.set('b', 2);
    expect(m.toObject()).toEqual({ a: 1, b: 2 });
  });
});
