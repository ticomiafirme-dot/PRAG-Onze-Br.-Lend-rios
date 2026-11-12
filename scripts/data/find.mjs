#!/usr/bin/env node
// Busca jogadores verificados de um clube: node scripts/data/find.mjs <clube> <termo> [termo...]
import fs from 'node:fs';
import { normalize } from './wiki-clubs.mjs';
const persons = JSON.parse(fs.readFileSync('data-src/cache/persons.json', 'utf8'));
const [club, ...terms] = process.argv.slice(2);
for (const t of terms) {
  const nt = normalize(t);
  const hits = (persons[club] ?? []).filter((r) => [r.title, r.name, r.fullName].some((k) => k && normalize(k).includes(nt)));
  console.log(`${t}: ` + (hits.length ? hits.map((r) => `[${r.title}] ${r.name} ${r.positions.join('/')} ${r.periods.map(([a, b]) => a + '-' + b).join(',')} ${r.apps ?? '?'}j`).join(' || ') : '—'));
}
