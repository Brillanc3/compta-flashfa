// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Identifiant de build — change à chaque `vite build`. Sert à détecter
// côté client qu'une nouvelle version du frontend est déployée.
const BUILD_ID = String(Date.now());

export default defineConfig({
    define: {
        __APP_VERSION__: JSON.stringify(BUILD_ID),
    },
    plugins: [
        react(),
        {
            // Émet /version.json dans le build pour le check de mise à jour client
            name: 'emit-version-json',
            apply: 'build',
            generateBundle() {
                this.emitFile({
                    type: 'asset',
                    fileName: 'version.json',
                    source: JSON.stringify({ version: BUILD_ID }),
                });
            },
        },
    ].filter(Boolean),
    server: {
        allowedHosts: ["ccadev.jipeg-corporation.eu", "https://react.jipeg-corporation.eu"]
    },

    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
        dedupe: ["react", "react-dom"],
    },

    build: {
        sourcemap: false,
        cssCodeSplit: true,
        chunkSizeWarningLimit: 1200,

        rollupOptions: {
            output: {
                /**
                 * Split intelligent :
                 * - react-vendor : react et core router
                 * - ui-vendor : mui
                 * - common-vendor : autres libs node_modules
                 */
                manualChunks(id) {
                    if (!id.includes("node_modules")) return;

                    if (id.includes("react") || id.includes("react-router")) {
                        return "core-react";
                    }

                    if (id.includes("@mui")) {
                        return "mui";
                    }

                    if (
                        id.includes("recharts") ||
                        id.includes("chart.js") ||
                        id.includes("apexcharts")
                    ) {
                        return "charts";
                    }

                    return "vendor";
                },
            },
        },
    },
});
