// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/pawmatch/',          
  build: {
    outDir: 'docs',
    emptyOutDir: true
  }
});
