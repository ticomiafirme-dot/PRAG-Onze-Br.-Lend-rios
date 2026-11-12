#!/usr/bin/env node
// Etapa 2 — Extrai das infobox as passagens de cada jogador pelos clubes do jogo.
// Gera data-src/cache/persons.json e tabelas de candidatos por clube
// (data-src/cache/candidates/<clube>.tsv) para curadoria.

import fs from 'node:fs';
import path from 'node:path';
import { WIKI_CLUBS } from './wiki-clubs.mjs';
import { anyInfoboxParams, enPositions, parseEnInfobox, parseInfobox, parseNationality, positionsFromText } from './infobox.mjs';

const CACHE = path.resolve('data-src/cache');
const categories = JSON.parse(fs.readFileSync(path.join(CACHE, 'categories.json'), 'utf8'));
const pages = JSON.parse(fs.readFileSync(path.join(CACHE, 'pages.json'), 'utf8'));

export const DECADES = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];

function decadesOf(start, end) {
  const out = [];
  for (const d of DECADES) {
    const ds = Number(d.slice(0, 4));
    const de = ds + 9;
    if (start <= de && end >= ds) out.push(d);
  }
  return out;
}

function overlapYears(start, end, d) {
  const ds = Number(d.slice(0, 4));
  return Math.max(0, Math.min(end, ds + 9) - Math.max(start, ds) + 1);
}

const enwiki = fs.existsSync(path.join(CACHE, 'enwiki.json')) ? JSON.parse(fs.readFileSync(path.join(CACHE, 'enwiki.json'), 'utf8')) : {};

const persons = {};
const unmatched = new Map();
for (const [title, page] of Object.entries(pages)) {
  if (!page?.content) continue;
  let info = parseInfobox(page.content);
  if (!info && enwiki[title]) {
    // complemento pela Wikipédia em inglês
    const en = parseEnInfobox(enwiki[title].content);
    if (en) {
      const ptParams = anyInfoboxParams(page.content);
      info = { ...en, nationality: en.nationality ?? parseNationality(ptParams), enTitle: enwiki[title].enTitle };
      info.positionsEn = enPositions(en.position);
    }
  }
  if (!info) continue;
  for (const s of info.stints) if (!s.id && s.raw) unmatched.set(s.raw, (unmatched.get(s.raw) ?? 0) + 1);
  const positions = info.positionsEn ?? positionsFromText(info.position);
  persons[title] = { title: page.redirectTo ?? title, ...info, positions };
}

const clubsOut = {};
const missingInfobox = {};
for (const club of Object.keys(WIKI_CLUBS)) {
  // categoria do clube + goleiros + qualquer artigo coletado cuja infobox registre passagem pelo clube
  const titles = [
    ...new Set([
      ...(categories[club] ?? []),
      ...(categories[`${club}:gk`] ?? []),
      ...Object.keys(persons).filter((t) => persons[t].stints.some((s) => s.id === club)),
    ]),
  ];
  const rows = [];
  missingInfobox[club] = [];
  for (const t of titles) {
    const p = persons[t];
    if (!p) {
      missingInfobox[club].push(t);
      continue;
    }
    const stints = p.stints.filter((s) => s.id === club && s.start);
    if (!stints.length) continue;
    const periods = stints.map((s) => [s.start, s.end ?? s.start]);
    const apps = stints.some((s) => s.apps != null) ? stints.reduce((a, s) => a + (s.apps ?? 0), 0) : null;
    const goals = stints.some((s) => s.goals != null) ? stints.reduce((a, s) => a + (s.goals ?? 0), 0) : null;
    const decades = [...new Set(periods.flatMap(([a, b]) => decadesOf(a, b)))];
    const totalYears = periods.reduce((a, [s, e]) => a + (e - s + 1), 0);
    const perDecade = {};
    for (const d of decades) {
      const yrs = periods.reduce((a, [s, e]) => a + overlapYears(s, e, d), 0);
      perDecade[d] = { years: yrs, apps: apps != null ? Math.round((apps * yrs) / totalYears) : null };
    }
    rows.push({
      title: p.title,
      catTitle: t,
      name: p.name ?? t.replace(/ \(.*\)$/, ''),
      fullName: p.fullName,
      nationality: p.nationality,
      birthYear: p.birthYear,
      positionText: p.position,
      positions: p.positions,
      image: p.image,
      caps: p.caps,
      periods,
      loanOnly: stints.every((s) => s.loan),
      apps,
      goals,
      decades,
      perDecade,
      otherClubs: [...new Set(p.stints.filter((s) => s.id && s.id !== club).map((s) => s.id))],
      enTitle: p.enTitle ?? null,
    });
  }
  clubsOut[club] = rows;
}

fs.writeFileSync(path.join(CACHE, 'persons.json'), JSON.stringify(clubsOut));
fs.mkdirSync(path.join(CACHE, 'candidates'), { recursive: true });
for (const [club, rows] of Object.entries(clubsOut)) {
  const lines = ['decade\tname\ttitle\tpos\tnat\tyears\tapps\tgoals\tcaps\tposText'];
  for (const d of DECADES) {
    const inD = rows
      .filter((r) => r.decades.includes(d))
      .sort((a, b) => (b.perDecade[d].apps ?? b.perDecade[d].years * 20) - (a.perDecade[d].apps ?? a.perDecade[d].years * 20));
    for (const r of inD) {
      lines.push(
        [d, r.name, r.title, r.positions.join('/'), r.nationality ?? '?', r.periods.map(([a, b]) => (a === b ? a : `${a}-${b}`)).join(','), r.perDecade[d].apps ?? '', r.goals ?? '', r.caps ?? '', (r.positionText ?? '').slice(0, 40)].join('\t'),
      );
    }
  }
  fs.writeFileSync(path.join(CACHE, 'candidates', `${club}.tsv`), lines.join('\n'));
}

const top = [...unmatched.entries()].sort((a, b) => b[1] - a[1]);
fs.writeFileSync(path.join(CACHE, 'unmatched-clubs.txt'), top.map(([k, v]) => `${v}\t${k}`).join('\n'));

const summary = Object.entries(clubsOut).map(([club, rows]) => {
  const byDecade = Object.fromEntries(DECADES.map((d) => [d, rows.filter((r) => r.decades.includes(d)).length]));
  return { club, total: rows.length, missingInfobox: missingInfobox[club].length, ...byDecade };
});
console.table(summary);
