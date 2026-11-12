#!/usr/bin/env node
// Etapa 1b — Complemento pela Wikipédia em inglês.
// Para artigos em português sem infobox de futebolista (ex.: Pelé, Romário, que
// usam infobox de biografia/político), busca o artigo equivalente em inglês e
// guarda a seção inicial (Infobox football biography).
// Saída: data-src/cache/enwiki.json  { ptTitle: { enTitle, content } }

import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { wikiApi } from './wiki-api.mjs';

const UA = 'OnzeBrLendarioDataCheck/1.0 (historical football data verification script)';
const missing = JSON.parse(fs.readFileSync('data-src/cache/missing-infobox.json', 'utf8'));
const outFile = 'data-src/cache/enwiki.json';
const out = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const todo = missing.filter((t) => !out[t] && !/^(Lista|Elenco|Os )/.test(t));
const langlinks = {};
for (let i = 0; i < todo.length; i += 50) {
  const batch = todo.slice(i, i + 50);
  const j = await wikiApi('pt.wikipedia.org', { action: 'query', prop: 'langlinks', lllang: 'en', lllimit: 'max', redirects: '1', titles: batch.join('|') });
  const norm = new Map([...(j.query?.normalized ?? []), ...(j.query?.redirects ?? [])].map((n) => [n.to, n.from]));
  for (const p of j.query?.pages ?? []) {
    const en = p.langlinks?.[0]?.title;
    if (en) langlinks[norm.get(p.title) ?? p.title] = en;
  }
}

function raw(title) {
  const url = 'https://en.wikipedia.org/w/index.php?action=raw&title=' + encodeURIComponent(title);
  return new Promise((resolve) => {
    execFile('curl', ['-sS', '--compressed', '-A', UA, '-L', '-w', '\n%{http_code}', url], { maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve({ status: 0, body: '' });
      const i = stdout.lastIndexOf('\n');
      resolve({ status: Number(stdout.slice(i + 1)), body: stdout.slice(0, i) });
    });
  });
}

for (const [pt, en] of Object.entries(langlinks)) {
  for (let attempt = 0; attempt < 5; attempt++) {
    let { status, body } = await raw(en);
    const redirect = body.match(/^#REDIRECT\s*\[\[([^\]]+)\]\]/i);
    if (status === 200 && redirect) ({ status, body } = await raw(redirect[1]));
    if (status === 200) {
      const cut = body.search(/\n==[^=]/);
      out[pt] = { enTitle: redirect ? redirect[1] : en, content: cut > 0 ? body.slice(0, cut) : body.slice(0, 30000) };
      break;
    }
    await sleep(1500 * 2 ** attempt);
  }
  await sleep(250);
}
fs.writeFileSync(outFile, JSON.stringify(out));
console.log(`en.wikipedia: ${Object.keys(out).length} artigos complementares`);
