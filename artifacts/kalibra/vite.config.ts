import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

// O Replit injeta PORT/BASE_PATH; fora dele, caimos em valores padrao para
// que build, preview e dev funcionem sem plumbing de ambiente.
const rawPort = process.env.PORT ?? '5173';

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? '/';

/**
 * Para onde o `/api` do dev server aponta. O `api-server` sobe em 3000 por padrão.
 */
const apiUrl = process.env.API_URL ?? 'http://localhost:3000';

/**
 * Proxy de `/api`, e não CORS.
 *
 * Sem isto o frontend serve em :5173 e o servidor em :3000 — **origens
 * diferentes**. O padrão do `fetch` é `same-origin`, e `custom-fetch.ts` nunca
 * define `credentials`, então o cookie de sessão do Clerk não viajaria e toda
 * requisição privada responderia 401. Pareceria defeito de autenticação sendo
 * defeito de origem.
 *
 * A alternativa era `credentials: 'include'` mais CORS afinado. O proxy é melhor
 * por dois motivos: mesma origem é o que produção terá, onde o servidor serve o
 * frontend; e não depende de o CORS estar certo para funcionar.
 */
const proxyDaApi = {
  '/api': {
    target: apiUrl,
    changeOrigin: false,
  },
};

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss({ optimize: false }),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: proxyDaApi,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: proxyDaApi,
  },
});
