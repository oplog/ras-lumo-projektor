import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { localLibrary } from './vite-plugin-local-library';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Local dev serves /api/library from a git-ignored JSON file instead of
    // proxying to production R2. Dev edits NEVER touch the live bucket, and a
    // fresh checkout starts with an empty library.
    localLibrary(),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        projector: resolve(__dirname, 'projector.html'),
      },
    },
  },
});
