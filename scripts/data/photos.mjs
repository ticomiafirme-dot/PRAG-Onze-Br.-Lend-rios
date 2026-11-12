#!/usr/bin/env node
// Etapa 2b — Fotos com licença livre (Wikimedia Commons) e respectiva autoria.
// Só são usadas imagens hospedadas no Commons (que exige licenças livres).
// - A URL da miniatura é derivada do nome do arquivo (caminho por hash MD5).
// - Licença e autor vêm do wikitexto da página do arquivo (action=raw).
// Arquivos que não existem no Commons (ex.: uso restrito local) são ignorados.
// Saída: data-src/cache/photos.json  { "Arquivo.jpg": { thumb, author, license, page } | null }

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';

const UA = 'OnzeBrLendarioDataCheck/1.0 (historical football data verification script)';
const persons = JSON.parse(fs.readFileSync('data-src/cache/persons.json', 'utf8'));
const outFile = 'data-src/cache/photos.json';
const photos = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const selected = new Set();
for (const f of fs.readdirSync('src/data/players')) {
  const d = JSON.parse(fs.readFileSync(path.join('src/data/players', f), 'utf8'));
  for (const p of d.players) selected.add(p.source);
}
const files = new Set();
for (const rows of Object.values(persons)) {
  for (const r of rows) {
    if (!r.image) continue;
    const url = r.enTitle
      ? `https://en.wikipedia.org/wiki/${encodeURIComponent(r.enTitle.replace(/ /g, '_'))}`
      : `https://pt.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`;
    if (selected.has(url)) files.add(r.image.replace(/ /g, '_'));
  }
}

function raw(file) {
  const url = 'https://commons.wikimedia.org/w/index.php?action=raw&title=' + encodeURIComponent('File:' + file);
  return new Promise((resolve) => {
    execFile('curl', ['-sS', '--compressed', '-A', UA, '-w', '\n%{http_code}', url], { maxBuffer: 16 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve({ status: 0, body: '' });
      const i = stdout.lastIndexOf('\n');
      resolve({ status: Number(stdout.slice(i + 1)), body: stdout.slice(0, i) });
    });
  });
}

export function thumbUrl(file, width = 250) {
  const name = file.replace(/ /g, '_');
  const md5 = crypto.createHash('md5').update(name).digest('hex');
  const enc = encodeURIComponent(name);
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${md5[0]}/${md5.slice(0, 2)}/${enc}/${width}px-${enc}`;
}

function clean(s) {
  return String(s ?? '')
    .replace(/<ref[\s\S]*?<\/ref>/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\[(?:https?:)?\/\/\S+\s([^\]]+)\]/g, '$1')
    .replace(/\{\{[^{}]*\|([^{}|]+)\}\}/g, '$1')
    .replace(/\{\{|\}\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/'''?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseLicense(text) {
  const t = text.toLowerCase();
  const cc = t.match(/cc-(by(?:-sa)?)-(\d\.\d)(?:-([a-z]{2})(?![a-z]))?/);
  if (cc) return `CC ${cc[1].toUpperCase()} ${cc[2]}${cc[3] ? ' ' + cc[3].toUpperCase() : ''}`;
  if (/\{\{\s*agência brasil|agencia brasil/.test(t)) return 'CC BY 3.0 BR';
  if (/cc-zero|cc0/.test(t)) return 'CC0';
  if (/\{\{\s*pd-|public domain|domínio público/.test(t)) return 'Domínio público';
  if (/gfdl/.test(t)) return 'GFDL';
  if (/\{\{\s*flickr/.test(t)) return 'Licença livre (Flickr)';
  return 'Licença livre (ver página do arquivo)';
}

function parseAuthor(text) {
  const m = text.match(/\|\s*(?:author|autor|Author)\s*=\s*([^\n]*)/);
  const a = m ? clean(m[1]) : '';
  return a.slice(0, 120) || 'Wikimedia Commons';
}

const todo = [...files].filter((f) => !(f in photos));
console.log(`Consultando ${todo.length} imagens no Commons (action=raw)...`);
let done = 0;
let cursor = 0;
async function worker() {
  while (cursor < todo.length) {
    const file = todo[cursor++];
    let res = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { status, body } = await raw(file);
      if (status === 404) break;
      if (status === 200) {
        const redirect = body.match(/^#(?:REDIRECT|REDIRECIONAMENTO)\s*\[\[(?:File|Arquivo|Ficheiro):([^\]]+)\]\]/i);
        const target = redirect ? redirect[1].replace(/ /g, '_') : file;
        res = {
          thumb: thumbUrl(target),
          author: parseAuthor(body),
          license: parseLicense(body),
          page: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(target)}`,
        };
        break;
      }
      await sleep(1500 * 2 ** attempt);
    }
    photos[file] = res;
    done++;
    if (done % 100 === 0) {
      fs.writeFileSync(outFile, JSON.stringify(photos));
      console.log(`  ${done}/${todo.length}`);
    }
    await sleep(120);
  }
}
await Promise.all([worker(), worker(), worker()]);
fs.writeFileSync(outFile, JSON.stringify(photos));
console.log(`Fotos livres: ${Object.values(photos).filter(Boolean).length} de ${Object.keys(photos).length}`);
