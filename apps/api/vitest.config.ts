import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./src/test/setup.ts'],
    // Les tests géospatiaux partagent une base : les faire tourner en
    // parallèle produirait des interférences sur les mêmes tables.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
