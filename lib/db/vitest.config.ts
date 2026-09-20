import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    // PGlite é WASM: a primeira instanciação de cada arquivo custa segundos, bem
    // acima do padrão de 5s do Vitest.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
