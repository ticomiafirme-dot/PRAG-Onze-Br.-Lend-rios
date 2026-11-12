#!/usr/bin/env node
// Etapa 1 — Coleta bruta na Wikipédia em português.
// 1) Lista a categoria "Futebolistas do <clube>" de cada clube (API).
// 2) Baixa o wikitexto de cada artigo via index.php?action=raw (servido pelo
//    CDN da Wikimedia) e guarda apenas a seção inicial, onde fica a infobox.
// Saída (cache, fora do git): data-src/cache/categories.json e data-src/cache/pages.json
//
// Uso: node scripts/data/harvest.mjs [clubeId ...]

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { WIKI_CLUBS } from './wiki-clubs.mjs';
import { categoryMembers } from './wiki-api.mjs';

const UA = 'OnzeBrLendarioDataCheck/1.0 (historical football data verification script)';
const CACHE = path.resolve('data-src/cache');
fs.mkdirSync(CACHE, { recursive: true });
const catFile = path.join(CACHE, 'categories.json');
const pagesFile = path.join(CACHE, 'pages.json');

const categories = fs.existsSync(catFile) ? JSON.parse(fs.readFileSync(catFile, 'utf8')) : {};
const pages = fs.existsSync(pagesFile) ? JSON.parse(fs.readFileSync(pagesFile, 'utf8')) : {};

const only = process.argv.slice(2);
const clubIds = only.length ? only : Object.keys(WIKI_CLUBS);

for (const id of clubIds) {
  if (!categories[id]?.length) {
    process.stderr.write(`Categoria de ${id}...\n`);
    categories[id] = await categoryMembers('pt.wikipedia.org', WIKI_CLUBS[id].category);
    fs.writeFileSync(catFile, JSON.stringify(categories));
  }
  // Goleiros ficam numa subcategoria própria ("Goleiros do <clube>")
  const gkKey = `${id}:gk`;
  if (!categories[gkKey]) {
    const gkCat = WIKI_CLUBS[id].category.replace(/^Futebolistas/, 'Goleiros');
    process.stderr.write(`Categoria de goleiros de ${id}...\n`);
    categories[gkKey] = await categoryMembers('pt.wikipedia.org', gkCat);
    fs.writeFileSync(catFile, JSON.stringify(categories));
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function rawPage(title) {
  const url = 'https://pt.wikipedia.org/w/index.php?action=raw&title=' + encodeURIComponent(title);
  return new Promise((resolve, reject) => {
    execFile('curl', ['-sS', '--compressed', '-A', UA, '-w', '\n%{http_code}', url], { maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      const i = stdout.lastIndexOf('\n');
      resolve({ status: Number(stdout.slice(i + 1)), body: stdout.slice(0, i) });
    });
  });
}

/** Mantém só a parte inicial do artigo (até o primeiro título de seção). */
function leadSection(text) {
  const m = text.search(/\n==[^=]/);
  return m > 0 ? text.slice(0, m) : text.slice(0, 20000);
}

async function fetchOne(title) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const { status, body } = await rawPage(title);
      if (status === 404) return { title, missing: true };
      if (status !== 200) throw new Error('HTTP ' + status);
      const redirect = body.match(/^#(?:REDIRECIONAMENTO|REDIRECT)\s*\[\[([^\]]+)\]\]/i);
      if (redirect) {
        const target = redirect[1].split('#')[0];
        const r = await rawPage(target);
        if (r.status === 200) return { title, redirectTo: target, content: leadSection(r.body) };
      }
      return { title, content: leadSection(body) };
    } catch (e) {
      const wait = 1500 * 2 ** attempt;
      process.stderr.write(`  ! ${title}: ${e.message} — nova tentativa em ${wait}ms\n`);
      await sleep(wait);
    }
  }
  return { title, failed: true };
}

const todo = [...new Set(clubIds.flatMap((id) => [...categories[id], ...(categories[`${id}:gk`] ?? [])]))].filter((t) => !pages[t]?.content && !pages[t]?.missing);
process.stderr.write(`Baixando ${todo.length} artigos (action=raw)...\n`);

const CONCURRENCY = 4;
let done = 0;
let cursor = 0;
async function worker() {
  while (cursor < todo.length) {
    const t = todo[cursor++];
    pages[t] = await fetchOne(t);
    done++;
    if (done % 200 === 0) {
      fs.writeFileSync(pagesFile, JSON.stringify(pages));
      process.stderr.write(`  ${done}/${todo.length}\n`);
    }
    await sleep(120);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
fs.writeFileSync(pagesFile, JSON.stringify(pages));
process.stderr.write(`Coleta concluída: ${Object.keys(pages).length} páginas.\n`);
