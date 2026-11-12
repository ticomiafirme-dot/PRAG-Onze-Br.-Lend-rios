#!/usr/bin/env node
// Gera uma página autocontida para publicação como Artifact no Claude.
// Parte do build de arquivo único (dist-single/index.html) e escreve só o
// conteúdo da página (título, estilos, raiz e script), sem <html>/<head>/<body>,
// porque o publicador adiciona o esqueleto do documento.
// Uso: npm run build:single && node scripts/build-artifact.mjs

import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync('dist-single/index.html', 'utf8');
const styles = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
const scripts = [...src.matchAll(/<script type="module"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (!styles.length || !scripts.length) throw new Error('Build de arquivo único sem estilos ou script.');
for (const js of scripts) if (/<\/script/i.test(js)) throw new Error('O script contém "</script" e quebraria a página.');

const html = [
  '<title>Onze BR Lendário PRAG</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  '<meta name="description" content="Monte o time dos sonhos com lendas do seu clube, década a década, e busque o Brasileirão perfeito.">',
  `<style>${styles.join('\n')}</style>`,
  '<div id="root"></div>',
  ...scripts.map((js) => `<script type="module">${js}</script>`),
  '',
].join('\n');

const out = path.join('dist-artifact', 'onze-br-lendario-prag.html');
fs.mkdirSync('dist-artifact', { recursive: true });
fs.writeFileSync(out, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`${out}: ${kb} KB (fontes embutidas: ${(html.match(/data:font\/woff2/g) ?? []).length})`);
