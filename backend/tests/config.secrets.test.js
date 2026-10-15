import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req      = createRequire(import.meta.url);
const secrets   = _req(path.resolve(__dirname, '../src/config/secrets'));

let saved;
beforeEach(() => { saved = { ...process.env }; });
afterEach(() => { process.env = saved; });

describe('config/secrets', () => {
    it('refuse un secret manquant', () => {
        delete process.env.JWT_SECRET;
        expect(() => secrets.jwtSecret).toThrow('JWT_SECRET est manquante');
    });

    it('refuse les anciennes valeurs par défaut', () => {
        process.env.JWT_SECRET = 'votre_secret_par_defaut';
        process.env.SESSION_SECRET = 'replace_with_strong_secret';
        process.env.REFRESH_TOKEN_SALT = 'refresh_salt_default';
        expect(() => secrets.jwtSecret).toThrow('valeur par défaut');
        expect(() => secrets.sessionSecret).toThrow('valeur par défaut');
        expect(() => secrets.refreshTokenSalt).toThrow('valeur par défaut');
    });

    it('renvoie le secret configuré', () => {
        process.env.JWT_SECRET = 'x'.repeat(64);
        expect(secrets.jwtSecret).toBe('x'.repeat(64));
    });
});
