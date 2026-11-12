// Parser das infobox de futebolistas da Wikipédia em português.
// Suporta os dois formatos mais comuns:
//   (a) numerado:  |ano1= |clube1= |jogos1= |gols1=
//   (b) multilinha: |anos= |clubes= |jogos(gols)=  (linhas separadas por <br />)

import { clubIdFromAlias, normalize } from './wiki-clubs.mjs';

const CURRENT_YEAR = 2026;

/** Extrai o primeiro template {{Info/...}} com balanceamento de chaves. */
export function extractInfobox(text) {
  const start = text.search(/\{\{\s*Info\s*\/\s*(Futebol|Futebolista|Jogador|Desportista|Treinador)/i);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '{') {
      depth++;
      i++;
    } else if (text[i] === '}' && text[i + 1] === '}') {
      depth--;
      i++;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

/** Divide os parâmetros no nível superior (ignorando | dentro de [[ ]] e {{ }}). */
export function parseParams(tpl) {
  const body = tpl.replace(/^\{\{/, '').replace(/\}\}$/, '');
  const parts = [];
  let depthC = 0;
  let depthL = 0;
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === '{{') { depthC++; cur += two; i++; continue; }
    if (two === '}}') { depthC--; cur += two; i++; continue; }
    if (two === '[[') { depthL++; cur += two; i++; continue; }
    if (two === ']]') { depthL--; cur += two; i++; continue; }
    if (body[i] === '|' && depthC === 0 && depthL === 0) { parts.push(cur); cur = ''; continue; }
    cur += body[i];
  }
  parts.push(cur);
  const params = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq < 0) continue;
    const k = p.slice(0, eq).trim().toLowerCase();
    params[k] = p.slice(eq + 1).trim();
  }
  return params;
}

const stripRefs = (s) =>
  String(s ?? '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

export function plainText(s) {
  return stripRefs(s)
    .replace(/\{\{0\|[^}]*\}\}/g, '')
    .replace(/\{\{(?:nowrap|nobr)\|([^}]*)\}\}/gi, '$1')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/'''?/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const splitLines = (s) => {
  const parts = stripRefs(s).split(/<br\s*\/?>|\n\*/i).map((x) => x.trim());
  while (parts.length && !parts[parts.length - 1]) parts.pop();
  while (parts.length && !parts[0]) parts.shift();
  return parts;
};

/** Identifica o clube de uma célula: {{Futebol X}} ou [[Alvo|texto]]. */
export function clubFromCell(cell) {
  const c = stripRefs(cell);
  const loan = /→|empr[ée]stimo/i.test(c);
  const tpls = [...c.matchAll(/\{\{\s*(Futebol [^|}]+?)\s*(?:\|[^}]*)?\}\}/g)].map((m) => m[1]);
  for (const t of tpls) {
    const id = clubIdFromAlias(t);
    if (id) return { id, raw: t, loan };
  }
  const links = [...c.matchAll(/\[\[([^|\]#]+)(?:#[^|\]]*)?(?:\|([^\]]*))?\]\]/g)];
  for (const m of links) {
    const id = clubIdFromAlias(m[1]);
    if (id) return { id, raw: m[1], loan };
  }
  const raw = tpls[0] ?? links.find((m) => !/^(ficheiro|file|imagem):/i.test(m[1]))?.[1] ?? plainText(c);
  return { id: null, raw, loan };
}

/** "2012–2024" | "2012–" | "2005" | "1978–79" | "2020–presente" -> {start, end} */
export function parseYears(s) {
  const t = plainText(s).replace(/presente|atual|atualmente/gi, '');
  const m = t.match(/(\d{4})\s*(?:[–—\-/]\s*(\d{2,4})?)?/);
  if (!m) return null;
  const start = Number(m[1]);
  let end;
  if (m[2]) {
    end = m[2].length === 2 ? Math.floor(start / 100) * 100 + Number(m[2]) : Number(m[2]);
    if (end < start) end += 100;
  } else if (/\d{4}\s*[–—\-]/.test(t)) {
    end = CURRENT_YEAR;
  } else {
    end = start;
  }
  if (start < 1900 || start > CURRENT_YEAR || end > CURRENT_YEAR + 1) return null;
  return { start, end: Math.min(end, CURRENT_YEAR) };
}

function parseAppsGoals(s) {
  const t = plainText(s);
  const m = t.match(/(\d+)\s*\(\s*(-?\d+)\s*\)/);
  if (m) return { apps: Number(m[1]), goals: Math.abs(Number(m[2])) };
  const n = t.match(/^(\d+)/);
  return n ? { apps: Number(n[1]), goals: null } : { apps: null, goals: null };
}

const num = (s) => {
  const m = plainText(s).match(/-?\d+/);
  return m ? Math.abs(Number(m[0])) : null;
};

const NAT_TEMPLATE = /\{\{\s*([A-Z]{3})n?\s*(?:\|[^}]*)?\}\}/;
const NAT_WORDS = [
  ['brasil', 'BRA'], ['argentin', 'ARG'], ['urugua', 'URU'], ['paragua', 'PAR'], ['chilen', 'CHI'], ['chile', 'CHI'],
  ['colombia', 'COL'], ['peru', 'PER'], ['equator', 'ECU'], ['bolivi', 'BOL'], ['venezuel', 'VEN'], ['portug', 'POR'],
  ['espanh', 'ESP'], ['ital', 'ITA'], ['holand', 'NED'], ['neerland', 'NED'], ['frances', 'FRA'], ['angol', 'ANG'],
  ['camaron', 'CMR'], ['nigeri', 'NGA'], ['japon', 'JPN'], ['mexic', 'MEX'], ['estadunid', 'USA'], ['alem', 'GER'],
];
// Alguns templates de bandeira usam códigos diferentes do padrão FIFA
const NAT_FIX = {
  EQU: 'ECU', PAI: 'NED', HOL: 'NED', ALE: 'GER', DEU: 'GER', CHL: 'CHI', URY: 'URU', PRY: 'PAR', CAM: 'CMR', ESC: 'SCO', ING: 'ENG',
  AGO: 'ANG', ANG: 'ANG', CRI: 'CRC', PRT: 'POR', DZA: 'ALG', EUA: 'USA', ZAF: 'RSA', ESA: 'ESP',
};

export function parseNationality(params) {
  const raw = stripRefs(params['nacionalidade'] ?? '');
  // dupla nacionalidade: em clubes brasileiros, prioriza a brasileira quando presente
  const codes = [...raw.matchAll(new RegExp(NAT_TEMPLATE.source, 'g'))].map((m) => NAT_FIX[m[1]] ?? m[1]);
  if (codes.length) return codes.includes('BRA') ? 'BRA' : codes[0];
  const t = normalize(plainText(raw) + ' ' + plainText(params['paisnatal'] ?? '') + ' ' + plainText(params['local de nascimento'] ?? params['cidadenatal'] ?? ''));
  for (const [w, code] of NAT_WORDS) if (t.includes(w)) return code;
  return null;
}

function parseBirthYear(params) {
  for (const k of ['data de nascimento', 'data_nascimento', 'nascimento_data', 'datadenascimento', 'nascimento']) {
    const v = params[k];
    if (!v) continue;
    const dni = v.match(/\{\{\s*dni\s*\|\s*\d{1,2}\s*\|\s*\d{1,2}\s*\|\s*(\d{4})/i);
    if (dni) return Number(dni[1]);
    const any = v.match(/(1[89]\d\d|20[012]\d)/);
    if (any) return Number(any[1]);
  }
  return null;
}

const TEAM_COUNTRY = [
  ['brasil', 'BRA'], ['brazil', 'BRA'], ['argentin', 'ARG'], ['urugua', 'URU'], ['paragua', 'PAR'], ['chile', 'CHI'],
  ['colomb', 'COL'], ['peru', 'PER'], ['equador', 'ECU'], ['ecuador', 'ECU'], ['bolivia', 'BOL'], ['venezuel', 'VEN'],
  ['portugal', 'POR'], ['japao', 'JPN'], ['japan', 'JPN'], ['espanha', 'ESP'], ['spain', 'ESP'], ['italia', 'ITA'], ['italy', 'ITA'],
  ['paises baixos', 'NED'], ['holanda', 'NED'], ['netherlands', 'NED'], ['franca', 'FRA'], ['france', 'FRA'], ['angola', 'ANG'],
  ['camaroes', 'CMR'], ['cameroon', 'CMR'], ['china', 'CHN'], ['costa rica', 'CRC'], ['servia', 'SRB'], ['serbia', 'SRB'],
  ['polonia', 'POL'], ['poland', 'POL'], ['bulgaria', 'BUL'], ['argelia', 'ALG'], ['algeria', 'ALG'], ['dinamarca', 'DEN'],
  ['denmark', 'DEN'], ['gana', 'GHA'], ['ghana', 'GHA'], ['africa do sul', 'RSA'], ['south africa', 'RSA'], ['estados unidos', 'USA'],
  ['united states', 'USA'], ['mexico', 'MEX'], ['belgica', 'BEL'], ['belgium', 'BEL'], ['congo', 'COD'], ['alemanha', 'GER'], ['germany', 'GER'],
];

export function teamCountry(cell) {
  const t = normalize(plainText(cell));
  for (const [w, code] of TEAM_COUNTRY) if (t.includes(w)) return code;
  return null;
}

function isSeniorNationalTeam(cell) {
  // verifica o texto bruto (inclui alvos de links e predefinições como {{pequeno|sub-20}})
  if (/sub-?\s?\d|olímpic|olimpic|juvenil|amador/i.test(String(cell))) return false;
  const t = normalize(plainText(cell));
  return !/sub-?\d|olimpic|juvenil|b$|amador|militar|universit|sub \d/.test(t);
}

const LEAD_DEMONYMS = [
  ['brasileir', 'BRA'], ['argentin', 'ARG'], ['uruguai', 'URU'], ['paraguai', 'PAR'], ['chilen', 'CHI'],
  ['colombian', 'COL'], ['peruan', 'PER'], ['equatorian', 'ECU'], ['bolivian', 'BOL'], ['venezuelan', 'VEN'],
  ['portugu', 'POR'], ['espanhol', 'ESP'], ['italian', 'ITA'], ['neerland', 'NED'], ['holandes', 'NED'],
  ['frances', 'FRA'], ['angolan', 'ANG'], ['camarones', 'CMR'], ['nigerian', 'NGA'], ['japones', 'JPN'],
  ['mexican', 'MEX'], ['estadunidense', 'USA'], ['norte-american', 'USA'], ['alema', 'GER'], ['costarriquenh', 'CRC'],
  ['ganes', 'GHA'], ['sul-african', 'RSA'], ['servio', 'SRB'], ['croata', 'CRO'], ['belga', 'BEL'], ['ingles', 'ENG'],
];

/** Nacionalidade pela primeira frase do artigo ("é um futebolista brasileiro"). */
export function nationalityFromLead(text, infoboxEnd) {
  const lead = normalize(plainText(String(text).slice(infoboxEnd, infoboxEnd + 1500)));
  const m = lead.match(/\b(?:e|foi) (?:um |uma )?(?:ex-)?(?:futebolista|jogador de futebol|goleiro|treinador e ex-futebolista|ex-jogador)[^.]{0,80}/);
  if (!m) return null;
  for (const [w, code] of LEAD_DEMONYMS) if (m[0].includes(w)) return code;
  return null;
}

/** Converte a infobox em dados estruturados. */
export function parseInfobox(text) {
  const tpl = extractInfobox(text);
  if (!tpl) return null;
  const infoboxEnd = text.indexOf(tpl) + tpl.length;
  const p = parseParams(tpl);
  const stints = [];
  // formato (a)
  for (let i = 1; i <= 40; i++) {
    const yr = p['ano' + i] ?? p['anos' + i];
    const cl = p['clube' + i] ?? p['clubes' + i];
    if (yr == null && cl == null) continue;
    const years = parseYears(yr ?? '');
    const club = clubFromCell(cl ?? '');
    stints.push({
      ...club,
      loan: club.loan || /sim|yes/i.test(p['empréstimo' + i] ?? p['emprestimo' + i] ?? ''),
      start: years?.start ?? null,
      end: years?.end ?? null,
      apps: num(p['jogos' + i] ?? p['partidas' + i] ?? ''),
      goals: num(p['gols' + i] ?? p['golos' + i] ?? ''),
    });
  }
  // formato (b)
  if (stints.length === 0) {
    const yrs = splitLines(p['anos'] ?? p['ano'] ?? '');
    const cls = splitLines(p['clubes'] ?? p['clube'] ?? '');
    const ag = splitLines(p['jogos(gols)'] ?? p['jogos(golos)'] ?? p['partidas(gols)'] ?? p['partidas(golos)'] ?? p['jogos (gols)'] ?? '');
    for (let i = 0; i < cls.length; i++) {
      const years = parseYears(yrs[i] ?? '');
      const club = clubFromCell(cls[i]);
      const { apps, goals } = parseAppsGoals(ag[i] ?? '');
      stints.push({ ...club, start: years?.start ?? null, end: years?.end ?? null, apps, goals });
    }
  }
  // seleção principal
  let caps = null;
  let ntCountry = null;
  const isOtherSport = (t) => /areia|praia|beach|futsal|salão|salao|society|feminin/i.test(plainText(t));
  for (let i = 1; i <= 10; i++) {
    const team = p['seleção' + i] ?? p['selecao' + i];
    if (!team) continue;
    if (!isSeniorNationalTeam(team) || isOtherSport(team)) continue;
    ntCountry = ntCountry ?? teamCountry(team);
    const c = num(p['seleção-jogos' + i] ?? p['selecao-jogos' + i] ?? '');
    if (c != null) caps = (caps ?? 0) + c;
  }
  if (caps == null && p['selecaonacional']) {
    const teams = splitLines(p['selecaonacional']);
    const games = splitLines(p['partidasselecao'] ?? p['partidasselecao(gols)'] ?? '');
    teams.forEach((tm, i) => {
      if (!isSeniorNationalTeam(tm) || isOtherSport(tm)) return;
      ntCountry = ntCountry ?? teamCountry(tm);
      const g = parseAppsGoals(games[i] ?? '').apps;
      if (g != null) caps = (caps ?? 0) + g;
    });
  }
  // números implausíveis (ex.: somas com outras modalidades) são descartados
  if (caps != null && caps > 180) caps = null;
  const image = plainText(p['imagem'] ?? p['image'] ?? '').replace(/^(Ficheiro|File|Imagem):/i, '').trim() || null;
  return {
    name: plainText(p['nome'] ?? '') || null,
    fullName: plainText(p['nome completo'] ?? p['nomecompleto'] ?? p['nome_completo'] ?? '') || null,
    // nacionalidade esportiva: a seleção defendida tem prioridade sobre a de nascimento
    nationality: ntCountry ?? parseNationality(p) ?? nationalityFromLead(text, infoboxEnd),
    birthYear: parseBirthYear(p),
    position: plainText(p['posição'] ?? p['posicao'] ?? p['posições'] ?? '') || null,
    image: image && /\.(jpe?g|png|gif|svg|webp)$/i.test(image) ? image : null,
    stints,
    caps,
  };
}

// ----- posições -----
const POS_RULES = [
  [/goleir|guarda-redes|arqueiro/, ['GOL']],
  [/lateral[- ]direit|ala direit|ala-direit|defesa direit/, ['LD']],
  [/lateral[- ]esquerd|ala esquerd|ala-esquerd|defesa esquerd/, ['LE']],
  [/zagueir|defesa central|defensor|beque|libero|quarto-zagueiro/, ["ZAG"]],
  [/volante|medio defensiv|médio defensiv|trinco|cabeça de area/, ['VOL']],
  [/meia[- ]atacante|meia ofensiv|meia-armador|armador|meia-esquerd|meia-direit|ponta de lanca|enganche/, ['MEI']],
  [/\bmeia\b/, ['MEI']],
  [/meio-campista|meio campista|meio-campo|medio|meio de campo/, ['MC']],
  [/ponta[- ]direit|extremo[- ]direit|ponta direit/, ['PD']],
  [/ponta[- ]esquerd|extremo[- ]esquerd|ponta esquerd/, ['PE']],
  [/\bponta\b|\bextremo\b|ponteiro/, ['PD', 'PE']],
  [/segundo atacante/, ['SA']],
  [/centroavante|centro-avante|avante|centroavante|ponta-de-lanca/, ['CA']],
  [/atacante|ataque/, ['CA']],
];

/** Posições sugeridas a partir do texto da infobox (revisadas manualmente depois). */
export function positionsFromText(text) {
  const t = normalize(text ?? '');
  const out = [];
  // ordem de aparição no texto define a principal
  const found = [];
  for (const [re, ps] of POS_RULES) {
    const m = t.match(re);
    if (m) found.push({ at: m.index, ps });
  }
  found.sort((a, b) => a.at - b.at);
  for (const f of found) for (const p of f.ps) if (!out.includes(p)) out.push(p);
  // "lateral" sem lado
  if (out.length === 0 && /lateral/.test(t)) out.push('LD', 'LE');
  return out;
}

// ----- Wikipédia em inglês (Infobox football biography) -----
function extractTemplate(text, re) {
  const start = text.search(re);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '{') { depth++; i++; }
    else if (text[i] === '}' && text[i + 1] === '}') { depth--; i++; if (depth === 0) return text.slice(start, i + 1); }
  }
  return text.slice(start);
}

const EN_POS_RULES = [
  [/goalkeeper/, ['GOL']],
  [/right[- ]back|right wing[- ]back/, ['LD']],
  [/left[- ]back|left wing[- ]back/, ['LE']],
  [/centre[- ]back|center[- ]back|sweeper|defender/, ['ZAG']],
  [/defensive midfielder/, ['VOL']],
  [/attacking midfielder|playmaker/, ['MEI']],
  [/midfielder/, ['MC']],
  [/right winger/, ['PD']],
  [/left winger/, ['PE']],
  [/winger/, ['PD', 'PE']],
  [/second striker|inside forward/, ['SA']],
  [/striker|forward|centre[- ]forward/, ['CA']],
];

export function enPositions(text) {
  const t = normalize(plainText(text ?? ''));
  const found = [];
  for (const [re, ps] of EN_POS_RULES) {
    const m = t.match(re);
    if (m) found.push({ at: m.index, ps });
  }
  found.sort((a, b) => a.at - b.at);
  const out = [];
  for (const f of found) for (const p of f.ps) if (!out.includes(p)) out.push(p);
  return out;
}

/** Infobox football biography (en.wikipedia), inclusive quando embutida em Infobox person. */
export function parseEnInfobox(text) {
  const tpl = extractTemplate(text, /\{\{\s*Infobox football biography/i);
  if (!tpl) return null;
  const p = parseParams(tpl);
  const stints = [];
  for (let i = 1; i <= 40; i++) {
    const yr = p['years' + i];
    const cl = p['clubs' + i];
    if (yr == null && cl == null) continue;
    const years = parseYears(yr ?? '');
    const club = clubFromCell(cl ?? '');
    stints.push({ ...club, start: years?.start ?? null, end: years?.end ?? null, apps: num(p['caps' + i] ?? ''), goals: num(p['goals' + i] ?? '') });
  }
  let caps = null;
  let nt = null;
  for (let i = 1; i <= 10; i++) {
    const team = p['nationalteam' + i];
    if (!team || /U-?\d|under-|olympic| B\b|beach|futsal|women/i.test(plainText(team))) continue;
    nt = nt ?? teamCountry(team);
    const c = num(p['nationalcaps' + i] ?? '');
    if (c != null) caps = (caps ?? 0) + c;
  }
  if (caps != null && caps > 180) caps = null;
  const image = plainText(p['image'] ?? '').replace(/^(File|Image):/i, '').trim() || null;
  return {
    name: plainText(p['name'] ?? '') || null,
    fullName: plainText(p['full_name'] ?? p['fullname'] ?? '') || null,
    nationality: nt,
    birthYear: (p['birth_date'] ?? '').match(/(1[89]\d\d|20[012]\d)/)?.[1] ? Number((p['birth_date'] ?? '').match(/(1[89]\d\d|20[012]\d)/)[1]) : null,
    position: plainText(p['position'] ?? '') || null,
    image: image && /\.(jpe?g|png|gif|webp)$/i.test(image) ? image : null,
    stints,
    caps,
  };
}

/** Parâmetros de qualquer infobox (para aproveitar a nacionalidade de infobox não esportivas). */
export function anyInfoboxParams(text) {
  const tpl = extractTemplate(text, /\{\{\s*Info\s*\//i);
  return tpl ? parseParams(tpl) : {};
}
