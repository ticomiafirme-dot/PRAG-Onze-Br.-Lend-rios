#!/usr/bin/env node
// Etapa 3 — Monta a base do jogo (src/data/players/<clube>.json).
//
// Entradas:
//   data-src/cache/persons.json        passagens verificadas nas infobox (extract.mjs)
//   data-src/cache/photos.json         fotos livres + autoria (photos.mjs, opcional)
//   data-src/curation/<clube>.txt      curadoria editorial: notas, posições, inclusões
//   src/data/clubs.ts                  décadas oferecidas por clube
//
// Regras:
//   - Só entra quem tem passagem pelo clube registrada (anos) na infobox do artigo.
//   - A década vem dos anos da passagem; nunca é inventada.
//   - Seleção automática por década: os mais relevantes (jogos, gols, seleção) com
//     cotas por posição; a curadoria pode incluir/excluir e ajustar notas.
//   - Nota (overall) = avaliação editorial. Sem ajuste manual, usa a fórmula
//     documentada em docs/METODOLOGIA.md.

import fs from 'node:fs';
import path from 'node:path';
import { normalize } from './wiki-clubs.mjs';

const ROOT = path.resolve('.');
const CACHE = path.join(ROOT, 'data-src/cache');
const CURATION = path.join(ROOT, 'data-src/curation');
const OUT = path.join(ROOT, 'src/data/players');

const persons = JSON.parse(fs.readFileSync(path.join(CACHE, 'persons.json'), 'utf8'));

// ---------- correções (data-src/curation/_correcoes.json) ----------
const decadeOf = (y) => `${Math.floor(y / 10) * 10}s`;
const CORRECTIONS = path.join(CURATION, '_correcoes.json');
if (fs.existsSync(CORRECTIONS)) {
  const { adicionar = [] } = JSON.parse(fs.readFileSync(CORRECTIONS, 'utf8'));
  for (const a of adicionar) {
    const src = (persons[a.copiarDe] ?? []).find((r) => r.title === a.titulo);
    if (!src) throw new Error(`Correção: "${a.titulo}" não encontrado em ${a.copiarDe}`);
    const perDecade = {};
    for (const [s0, e0] of a.periodos) for (let y = s0; y <= e0; y++) (perDecade[decadeOf(y)] ??= { years: 0, apps: null }).years++;
    const row = { ...src, periods: a.periodos, apps: null, goals: null, loanOnly: false, decades: Object.keys(perDecade).sort(), perDecade, otherClubs: [] };
    persons[a.clube] = [...(persons[a.clube] ?? []).filter((r) => r.title !== a.titulo), row];
  }
}

/** Ainda está no clube (passagem chega ao ano da coleta)? */
const isCurrent = (row) => row.periods.some(([, e]) => e >= CURRENT_YEAR - 1);
const BASE_FILE = path.join(CURATION, '_base.json');
const BASE_CARDS = fs.existsSync(BASE_FILE) ? JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')) : {};
const photos = fs.existsSync(path.join(CACHE, 'photos.json')) ? JSON.parse(fs.readFileSync(path.join(CACHE, 'photos.json'), 'utf8')) : {};

// ---------- décadas por clube (lidas de src/data/clubs.ts) ----------
const clubsTs = fs.readFileSync(path.join(ROOT, 'src/data/clubs.ts'), 'utf8');
const CLUB_INFO = {};
for (const m of clubsTs.matchAll(/id: '([a-z-]+)',\s*\n\s*name: '([^']+)'[\s\S]*?decades: \[([^\]]*)\]/g)) {
  CLUB_INFO[m[1]] = { name: m[2], decades: [...m[3].matchAll(/'(\d{4}s)'/g)].map((x) => x[1]) };
}
// títulos de cada clube (anos), para a nota: Brasileirão, Copa do Brasil e Libertadores
const CLUB_TITLES = {};
for (const block of clubsTs.split(/\n\s*\{\s*\n(?=\s*(?:guest: true,\s*\n\s*)?id: ')/)) {
  const id = block.match(/id: '([a-z-]+)'/)?.[1];
  if (!id) continue;
  const years = (k) => [...(block.match(new RegExp(`${k}: \\[([^\\]]*)\\]`))?.[1] ?? '').matchAll(/\d{4}/g)].map((x) => Number(x[0]));
  CLUB_TITLES[id] = { brasileirao: years('brasileirao'), copaDoBrasil: years('copaDoBrasil'), libertadores: years('libertadores') };
}

const POS_ORDER = ['GOL', 'LD', 'ZAG', 'LE', 'VOL', 'MC', 'MEI', 'PD', 'PE', 'SA', 'CA'];
const QUOTA = { GOL: 3, LD: 2, ZAG: 4, LE: 2, VOL: 3, MC: 2, MEI: 3, PD: 2, PE: 2, SA: 1, CA: 3 };
// Só os jogadores mais conhecidos e importantes de cada década (nada de "reserva do
// reserva"). Nos anos 2020 entram também os titulares do elenco atual.
const MAX_AUTO_PER_DECADE = 26;
const MAX_AUTO_CURRENT_DECADE = 34;
const CURRENT_DECADE = '2020s';
/** Ano da coleta: passagem que vai até ele (ou depois) é de quem ainda está no elenco. */
const CURRENT_YEAR = 2026;
/** Jogos mínimos pelo clube para um jogador do elenco atual entrar sem curadoria (peça do time, não reserva). */
const MIN_APPS_CURRENT = 40;
const MIN_PER_DECADE = 18;

const POS_NAME = {
  GOL: 'Goleiro', LD: 'Lateral-direito', ZAG: 'Zagueiro', LE: 'Lateral-esquerdo', VOL: 'Volante', MC: 'Meio-campista',
  MEI: 'Meia', PD: 'Ponta-direita', PE: 'Ponta-esquerda', SA: 'Segundo atacante', CA: 'Centroavante',
};
const NAT_ADJ = {
  BRA: 'brasileiro', ARG: 'argentino', URU: 'uruguaio', PAR: 'paraguaio', CHI: 'chileno', COL: 'colombiano', PER: 'peruano',
  ECU: 'equatoriano', BOL: 'boliviano', VEN: 'venezuelano', POR: 'português', ESP: 'espanhol', ITA: 'italiano', NED: 'neerlandês',
  FRA: 'francês', ANG: 'angolano', CMR: 'camaronês', NGA: 'nigeriano', JPN: 'japonês', MEX: 'mexicano', USA: 'estadunidense', GER: 'alemão',
  CRC: 'costarriquenho', GHA: 'ganês', RSA: 'sul-africano', SRB: 'sérvio', CRO: 'croata', BEL: 'belga', ENG: 'inglês',
  CHN: 'chinês', POL: 'polonês', BUL: 'búlgaro', ALG: 'argelino', COD: 'congolês', DEN: 'dinamarquês',
};
const NAT_ALIAS = { CRI: 'CRC', PRT: 'POR', DZA: 'ALG', EUA: 'USA', ZAF: 'RSA' };

// ---------- curadoria ----------
// Formato de linha:  Nome ou título | nota [década=nota ...] | posições | nota editorial
// Linha começando com "-" exclui o jogador do clube. "+" força inclusão em todas as décadas da passagem.
function loadCuration(club) {
  const f = path.join(CURATION, `${club}.txt`);
  const out = { entries: [], exclude: new Set() };
  if (!fs.existsSync(f)) return out;
  for (const raw of fs.readFileSync(f, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('-')) {
      out.exclude.add(normalize(line.slice(1)));
      continue;
    }
    const [who, rating, pos, note, display] = line.replace(/^\+/, '').split('|').map((x) => x?.trim() ?? '');
    const r = { who, key: normalize(who), base: null, byDecade: {}, positions: null, note: note || null, display: display || null, line: raw };
    for (const tok of (rating ?? '').split(/\s+/).filter(Boolean)) {
      const m = tok.match(/^(\d{4}s)=(\d+)$/);
      if (m) r.byDecade[m[1]] = Number(m[2]);
      else if (/^\d+$/.test(tok)) r.base = Number(tok);
    }
    if (pos) r.positions = pos.split(/[,/ ]+/).map((p) => p.toUpperCase()).filter((p) => POS_ORDER.includes(p));
    out.entries.push(r);
  }
  return out;
}

// ---------- fórmula editorial ----------
const NAT_FACTOR = { BRA: 1, ARG: 0.9, URU: 0.85 };
/** Fator de "auge": jogos pela seleção pesam menos quando a passagem foi muito no início ou no fim da carreira. */
function primeFactor(row) {
  if (!row.birthYear) return 1;
  const start = Math.min(...row.periods.map(([s]) => s));
  const end = Math.max(...row.periods.map(([, e]) => e));
  const ageStart = start - row.birthYear;
  const ageEnd = end - row.birthYear;
  let f = 1;
  if (ageEnd <= 21) f = 0.4;
  else if (ageEnd <= 23) f = 0.65;
  if (ageStart >= 36) f *= 0.45;
  else if (ageStart >= 34) f *= 0.65;
  else if (ageStart >= 32) f *= 0.85;
  return f;
}

const DEFENSIVE = new Set(['GOL', 'LD', 'ZAG', 'LE', 'VOL']);
const TITLE_WEIGHT = { libertadores: 2.2, brasileirao: 2.0, copaDoBrasil: 1.2 };

/**
 * Nota pela importância no clube (versão 2): jogos, gols (ou regularidade, para
 * goleiros e defensores), tempo de casa e títulos conquistados pelo clube nos
 * anos em que o jogador estava lá, proporcionais a quanto ele jogou; a seleção
 * pesa pouco. Limitada a 60–85 (acima disso, só pela curadoria).
 */
export function formulaRating(row, club) {
  const years = row.periods.reduce((a, [s, e]) => a + (e - s + 1), 0);
  const apps = row.apps ?? Math.min(250, years * 22);
  const appsScore = Math.min(13, (13 * Math.log10(1 + apps)) / Math.log10(301));
  const defensive = DEFENSIVE.has(row.positions?.[0]);
  const goalsScore = row.goals != null ? Math.min(6, row.goals / 15) : 0;
  const steadiness = defensive ? Math.min(4, apps / 70) : 0;
  const tenureScore = Math.min(3, 0.5 * years);
  // títulos: participação = jogos por ano / 20 (titular regular ≈ 1)
  const part = row.apps != null ? Math.min(1, row.apps / Math.max(1, years) / 20) : 0.6;
  const titles = CLUB_TITLES[club] ?? {};
  let titleSum = 0;
  for (const [kind, w] of Object.entries(TITLE_WEIGHT)) {
    for (const y of titles[kind] ?? []) if (row.periods.some(([s, e]) => y >= s && y <= e)) titleSum += w;
  }
  const titlesScore = Math.min(6, titleSum * part);
  const capsScore = row.caps ? Math.min(5, 5 * Math.sqrt(row.caps / 100)) * (NAT_FACTOR[row.nationality] ?? 0.7) * primeFactor(row) : 0;
  const r = 60 + appsScore + Math.max(goalsScore, steadiness) + tenureScore + titlesScore + capsScore;
  return Math.max(60, Math.min(85, Math.round(r)));
}

function notability(row, d) {
  const pd = row.perDecade[d];
  const appsD = pd.apps ?? pd.years * 18;
  const goalsD = row.goals != null && row.apps ? (row.goals * appsD) / row.apps : 0;
  // quem ainda está no elenco tem prioridade na década atual
  const current = d === CURRENT_DECADE && isCurrent(row) ? 60 : 0;
  return appsD + 0.5 * goalsD + 3 * Math.min(row.caps ?? 0, 60) + current;
}

function withNaturalSecondaries(positions) {
  const set = [...positions];
  const add = (p) => !set.includes(p) && set.push(p);
  if (set.includes('VOL')) add('MC');
  if (set.includes('MEI')) add('MC');
  if (set.includes('CA')) add('SA');
  if (set.includes('SA')) add('CA');
  return set;
}

function yearsString(periods) {
  return periods
    .slice()
    .sort((a, b) => a[0] - b[0])
    .map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`))
    .join(', ');
}

/** Remove trechos em escritas não latinas (ex.: "Dejan Petković Дејан Петковић"). */
function cleanName(name) {
  return String(name)
    .replace(/[^\u0000-\u024F\u1E00-\u1EFF'’.\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(title) {
  return normalize(title).replace(/[()]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const report = [];
const allSources = [];
fs.mkdirSync(OUT, { recursive: true });

for (const [club, info] of Object.entries(CLUB_INFO)) {
  const rows = (persons[club] ?? []).filter((r) => r.positions?.length || true);
  const cur = loadCuration(club);
  const byKey = new Map();
  for (const r of rows) {
    for (const k of [r.title, r.catTitle, r.name, r.fullName]) if (k) {
      const nk = normalize(k);
      if (!byKey.has(nk)) byKey.set(nk, []);
      if (!byKey.get(nk).includes(r)) byKey.get(nk).push(r);
    }
  }
  const curated = new Map(); // title -> entry
  const unmatched = [];
  for (const e of cur.entries) {
    let cands = byKey.get(e.key) ?? [];
    // preferência: título exato do artigo
    const exact = cands.filter((c) => normalize(c.title) === e.key || normalize(c.catTitle) === e.key);
    if (exact.length === 1) cands = exact;
    if (cands.length === 1) curated.set(cands[0].title, e);
    else if (cands.length > 1) unmatched.push(`AMBÍGUO: ${e.who} -> ${cands.map((c) => c.title).join(' / ')}`);
    else unmatched.push(`NÃO ENCONTRADO: ${e.who}`);
  }
  const excluded = (r) => [r.title, r.catTitle, r.name].some((k) => k && cur.exclude.has(normalize(k)));

  // quem já estava no jogo antes da revisão de elencos continua (partidas e históricos
  // salvos guardam as cartas): lista congelada em data-src/curation/_base.json
  const previous = new Set(BASE_CARDS[club] ?? []);

  const selected = new Map(); // title -> Set(decades)
  for (const d of info.decades) {
    const inD = rows.filter((r) => r.decades.includes(d) && !excluded(r));
    const chosen = new Set();
    // 1) curadoria e quem já estava no jogo
    for (const r of inD) if (curated.has(r.title) || previous.has(`${slugify(r.title)}@${d}`)) chosen.add(r);
    // 2) cotas por posição (pela posição principal)
    const ranked = inD
      .filter((r) => !chosen.has(r))
      .filter((r) => {
        const pd = r.perDecade[d];
        if (r.loanOnly && (pd.apps ?? 0) < 15) return false;
        // elenco atual: só quem já é peça do time (jogos pelo clube), não o reserva
        if (d === CURRENT_DECADE && isCurrent(r)) return (r.apps ?? 0) >= MIN_APPS_CURRENT;
        return pd.apps == null ? pd.years >= 1 : pd.apps >= 10;
      })
      .filter((r) => (curated.get(r.title)?.positions ?? r.positions).length > 0)
      .sort((a, b) => notability(b, d) - notability(a, d));
    const count = {};
    for (const r of chosen) {
      const p = (curated.get(r.title)?.positions ?? r.positions)[0];
      count[p] = (count[p] ?? 0) + 1;
    }
    const max = d === CURRENT_DECADE ? MAX_AUTO_CURRENT_DECADE : MAX_AUTO_PER_DECADE;
    for (const r of ranked) {
      if (chosen.size >= max) break;
      const p = (curated.get(r.title)?.positions ?? r.positions)[0];
      if ((count[p] ?? 0) >= Math.ceil(QUOTA[p] * (d === CURRENT_DECADE ? 1.3 : 1))) continue;
      count[p] = (count[p] ?? 0) + 1;
      chosen.add(r);
    }
    // 3) completa até o mínimo
    for (const r of ranked) {
      if (chosen.size >= MIN_PER_DECADE) break;
      chosen.add(r);
    }
    // 4) lacunas: posição sem nenhum jogador na década -> busca alguém com a posição (principal ou secundária)
    const posOf = (r) => withNaturalSecondaries(curated.get(r.title)?.positions ?? r.positions);
    for (const pos of POS_ORDER) {
      if ([...chosen].some((r) => posOf(r).includes(pos))) continue;
      const alt = inD.filter((r) => !chosen.has(r) && posOf(r).includes(pos)).sort((a, b) => notability(b, d) - notability(a, d))[0];
      if (alt) chosen.add(alt);
    }
    for (const r of chosen) {
      if (!selected.has(r.title)) selected.set(r.title, new Set());
      selected.get(r.title).add(d);
    }
  }

  const players = [];
  for (const [title, decs] of selected) {
    const r = rows.find((x) => x.title === title);
    const e = curated.get(title);
    const positions = withNaturalSecondaries(e?.positions ?? r.positions);
    if (!positions.length) continue;
    const base = e?.base ?? formulaRating(r, club);
    const eras = {};
    for (const d of info.decades) if (decs.has(d)) eras[d] = e?.byDecade[d] ?? base;
    const nationality = NAT_ALIAS[r.nationality] ?? r.nationality ?? 'BRA';
    const years = yearsString(r.periods);
    const auto = `${POS_NAME[positions[0]]} ${NAT_ADJ[nationality] ?? ''} que defendeu o ${info.name} em ${years}.`.replace(/\s+/g, ' ');
    const photo = r.image ? photos[r.image.replace(/ /g, '_')] ?? null : null;
    const url = r.enTitle
      ? `https://en.wikipedia.org/wiki/${encodeURIComponent(r.enTitle.replace(/ /g, '_'))}`
      : `https://pt.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`;
    allSources.push({ club, name: e?.who && !e.who.includes('(') ? r.name : r.name, url });
    players.push({
      id: slugify(r.title),
      name: e?.display ?? cleanName(r.name),
      ...(r.fullName && r.fullName !== r.name ? { fullName: r.fullName } : {}),
      nationality,
      position: positions[0],
      secondary: positions.slice(1),
      years,
      eras,
      apps: r.apps,
      goals: r.goals,
      caps: r.caps ?? null,
      description: e?.note ? `${e.note} ${auto}` : auto,
      photo: photo ? { url: photo.thumb, author: photo.author, license: photo.license, page: photo.page } : null,
      source: url,
      editorial: e?.base != null || Object.keys(e?.byDecade ?? {}).length > 0,
    });
  }
  players.sort((a, b) => Math.max(...Object.values(b.eras)) - Math.max(...Object.values(a.eras)) || a.name.localeCompare(b.name));
  fs.writeFileSync(path.join(OUT, `${club}.json`), JSON.stringify({ club, generatedAt: new Date().toISOString().slice(0, 10), players }, null, 0) + '\n');

  // relatório de cobertura
  const cover = info.decades.map((d) => {
    const inD = players.filter((p) => p.eras[d] != null);
    const byPos = Object.fromEntries(POS_ORDER.map((p) => [p, inD.filter((x) => x.position === p || x.secondary.includes(p)).length]));
    const missing = POS_ORDER.filter((p) => byPos[p] === 0);
    return `${d}: ${inD.length} jogadores${missing.length ? ` — SEM: ${missing.join(', ')}` : ''}`;
  });
  report.push(`## ${club} (${players.length} jogadores)\n${cover.join('\n')}${unmatched.length ? '\n' + unmatched.map((u) => '  ! ' + u).join('\n') : ''}`);
}

fs.writeFileSync(path.join(CACHE, 'build-report.md'), report.join('\n\n') + '\n');
console.log(report.join('\n\n'));
