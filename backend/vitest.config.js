import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.js'],
        environment: 'node',
        // Secrets factices : src/config/secrets.js refuse de démarrer sans eux
        env: {
            JWT_SECRET: 'test-jwt-secret-0123456789abcdef0123456789abcdef',
            SESSION_SECRET: 'test-session-secret-0123456789abcdef0123456789',
            REFRESH_TOKEN_SALT: 'test-refresh-salt-0123456789abcdef0123456789',
        },
    },
});
