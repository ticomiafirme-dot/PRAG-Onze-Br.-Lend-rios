#!/usr/bin/env node
// Sugere títulos para entradas da curadoria não encontradas (lê build-report.md).
import fs from 'node:fs';
import { normalize } from './wiki-clubs.mjs';
const persons = JSON.parse(fs.readFileSync('data-src/cache/persons.json', 'utf8'));
const report = fs.readFileSync('data-src/cache/build-report.md', 'utf8');
const only = process.argv.slice(2);
let club = null;
for (const line of report.split('\n')) {
  const h = line.match(/^## ([a-z-]+)/);
  if (h) { club = h[1]; continue; }
  const m = line.match(/! (NÃO ENCONTRADO|AMBÍGUO): (.+?)( ->|$)/);
  if (!m || (only.length && !only.includes(club))) continue;
  const who = m[2];
  const base = who.replace(/\s*\(.*\)\s*/, '').trim();
  const toks = normalize(base).split(' ').filter((t) => t.length > 2);
  const rows = persons[club] ?? [];
  const score = (r) => {
    const hay = normalize([r.title, r.name, r.fullName].filter(Boolean).join(' '));
    return toks.filter((t) => hay.includes(t)).length;
  };
  const hits = rows.map((r) => [score(r), r]).filter(([s]) => s >= Math.max(1, Math.ceil(toks.length * 0.6))).sort((a, b) => b[0] - a[0]).slice(0, 4);
  console.log(`${club} | ${who} => ` + (hits.length ? hits.map(([, r]) => `[${r.title}] ${r.positions.join('/')} ${r.periods.map(([a, b]) => a + '-' + b).join(',')}`).join(' || ') : '—'));
}
