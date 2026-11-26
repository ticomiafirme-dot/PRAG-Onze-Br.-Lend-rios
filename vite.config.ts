import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { staticPages } from './site/pages';

// `vite build` gera um site estático em dist/ (caminhos relativos, funciona em
// qualquer hospedagem estática). `vite build --mode single` gera um único
// arquivo HTML autocontido em dist-single/.
export default defineConfig(({ mode }) => ({
  base: './',
  // páginas de conteúdo (clubes, regras, conquistas, sobre), sitemap e robots.txt
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [staticPages()])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 4000,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
}));
