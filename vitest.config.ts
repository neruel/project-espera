import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@espera/shared': path.resolve(__dirname, './packages/shared/src'),
      '@espera/server': path.resolve(__dirname, './packages/server/src'),
    },
  },
});
