// Recordes pessoais e estatísticas de carreira, calculados a partir das
// temporadas reais do jogador. O detentor de um recorde só muda quando uma
// temporada o supera estritamente: em caso de empate, vale a primeira.
import { CLUB_BY_ID } from '../data/clubs';
import { DECADES, type Decade } from '../data/types';
import { rankingScore } from '../state/storage';
import type { SeasonEntry, TitleRecord } from './types';

export type RecordGroup = 'campanha' | 'ofensivo' | 'defensivo' | 'elenco';

export const RECORD_GROUPS: { id: RecordGroup; label: string }[] = [
  { id: 'campanha', label: 'Recordes de campanha' },
  { id: 'ofensivo', label: 'Recordes ofensivos' },
  { id: 'defensivo', label: 'Recordes defensivos' },
  { id: 'elenco', label: 'Recordes de elenco' },
];

export interface PersonalRecord {
  id: string;
  group: RecordGroup;
  label: string;
  /** Valor formatado (null se ainda não há temporada que conte). */
  value: string | null;
  raw: number | null;
  detail: string | null;
  /** Temporada que detém o recorde (a mais recente que usou, nos de "mais utilizado"). */
  season: SeasonEntry | null;
  /** Nos recordes de uso: em quantas temporadas. */
  count?: number;
}

interface ValueRecordDef {
  id: string;
  group: RecordGroup;
  label: string;
  better: 'max' | 'min';
  get: (s: SeasonEntry) => number | null;
  format: (v: number, s: SeasonEntry) => string;
  detail?: (s: SeasonEntry) => string | null;
}

const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;
const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

const VALUE_RECORDS: ValueRecordDef[] = [
  { id: 'vitorias', group: 'campanha', label: 'Mais vitórias em uma temporada', better: 'max', get: (s) => s.wins, format: (v) => n(v, 'vitória', 'vitórias') },
  { id: 'pontos', group: 'campanha', label: 'Mais pontos', better: 'max', get: (s) => s.points, format: (v) => n(v, 'ponto', 'pontos') },
  { id: 'aproveitamento', group: 'campanha', label: 'Maior aproveitamento', better: 'max', get: (s) => s.metrics?.efficiency ?? null, format: (v) => pct(v) },
  { id: 'seq-vitorias', group: 'campanha', label: 'Maior sequência de vitórias', better: 'max', get: (s) => s.metrics?.winStreak ?? null, format: (v) => n(v, 'jogo', 'jogos') },
  { id: 'seq-invicta', group: 'campanha', label: 'Maior sequência sem derrotas', better: 'max', get: (s) => s.metrics?.unbeatenStreak ?? null, format: (v) => n(v, 'jogo', 'jogos') },
  { id: 'menos-derrotas', group: 'campanha', label: 'Menos derrotas', better: 'min', get: (s) => s.losses, format: (v) => n(v, 'derrota', 'derrotas') },
  { id: 'melhor-posicao', group: 'campanha', label: 'Melhor posição na classificação', better: 'min', get: (s) => s.position, format: (v) => `${v}º lugar` },
  { id: 'gols', group: 'ofensivo', label: 'Mais gols marcados em uma temporada', better: 'max', get: (s) => s.goalsFor, format: (v) => n(v, 'gol', 'gols') },
  {
    id: 'maior-vitoria',
    group: 'ofensivo',
    label: 'Maior vitória (diferença de gols)',
    better: 'max',
    get: (s) => s.metrics?.biggestWin?.diff ?? null,
    format: (_v, s) => `${s.metrics!.biggestWin!.for} × ${s.metrics!.biggestWin!.against}`,
    detail: (s) => `contra o ${s.metrics!.biggestWin!.rival}`,
  },
  {
    id: 'gols-partida',
    group: 'ofensivo',
    label: 'Mais gols em uma única partida',
    better: 'max',
    get: (s) => s.metrics?.mostGoalsMatch?.goals ?? null,
    format: (v) => n(v, 'gol', 'gols'),
    detail: (s) => `${s.metrics!.mostGoalsMatch!.goals} × ${s.metrics!.mostGoalsMatch!.against} no ${s.metrics!.mostGoalsMatch!.rival}`,
  },
  {
    id: 'gols-jogador',
    group: 'ofensivo',
    label: 'Mais gols de um jogador',
    better: 'max',
    get: (s) => s.metrics?.topScorer?.goals ?? null,
    format: (v) => n(v, 'gol', 'gols'),
    detail: (s) => s.metrics!.topScorer!.name,
  },
  { id: 'menos-sofridos', group: 'defensivo', label: 'Menos gols sofridos em uma temporada', better: 'min', get: (s) => s.goalsAgainst, format: (v) => n(v, 'gol', 'gols') },
  { id: 'seq-sem-sofrer', group: 'defensivo', label: 'Maior sequência sem sofrer gols', better: 'max', get: (s) => s.metrics?.cleanSheetStreak ?? null, format: (v) => n(v, 'jogo', 'jogos') },
  { id: 'jogos-sem-sofrer', group: 'defensivo', label: 'Mais jogos sem sofrer gols', better: 'max', get: (s) => s.metrics?.cleanSheets ?? null, format: (v) => n(v, 'jogo', 'jogos') },
  { id: 'overall', group: 'elenco', label: 'Maior overall médio', better: 'max', get: (s) => s.squadOverall, format: (v) => String(Math.round(v)) },
  { id: 'quimica', group: 'elenco', label: 'Maior química', better: 'max', get: (s) => s.chemistry, format: (v) => String(v) },
  {
    id: 'maior-jogador',
    group: 'elenco',
    label: 'Jogador de maior overall utilizado',
    better: 'max',
    get: (s) => s.metrics?.bestCard?.overall ?? null,
    format: (v) => String(v),
    detail: (s) => {
      const b = s.metrics!.bestCard!;
      return `${b.name} · ${CLUB_BY_ID[b.club]?.name ?? b.club}, anos ${b.decade.slice(2, 4)}`;
    },
  },
];

const chrono = (a: SeasonEntry, b: SeasonEntry) => (a.finishedAt ?? a.startedAt).localeCompare(b.finishedAt ?? b.startedAt);

function holder(def: ValueRecordDef, seasons: SeasonEntry[]): PersonalRecord {
  let best: { v: number; s: SeasonEntry } | null = null;
  for (const s of seasons) {
    const v = def.get(s);
    if (v == null) continue;
    if (!best || (def.better === 'max' ? v > best.v : v < best.v)) best = { v, s };
  }
  return {
    id: def.id,
    group: def.group,
    label: def.label,
    value: best ? def.format(best.v, best.s) : null,
    raw: best?.v ?? null,
    detail: best && def.detail ? def.detail(best.s) : null,
    season: best?.s ?? null,
  };
}

function mostUsed<K extends string>(
  id: string,
  label: string,
  seasons: SeasonEntry[],
  keysOf: (s: SeasonEntry) => [K, number][],
  name: (k: K) => string,
  unit: string,
): PersonalRecord {
  const count = new Map<K, number>();
  const last = new Map<K, SeasonEntry>();
  for (const s of seasons) {
    for (const [k, w] of keysOf(s)) {
      count.set(k, (count.get(k) ?? 0) + w);
      last.set(k, s);
    }
  }
  const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    id,
    group: 'elenco',
    label,
    value: top ? name(top[0]) : null,
    raw: top ? top[1] : null,
    detail: top ? `${top[1]} ${unit}${top[1] === 1 ? '' : 's'}` : null,
    season: top ? last.get(top[0])! : null,
    count: top?.[1],
  };
}

/** Todos os recordes pessoais. Recordes de desempenho usam as temporadas finalizadas. */
export function personalRecords(all: SeasonEntry[]): PersonalRecord[] {
  const finished = all.filter((s) => s.status === 'finished').sort(chrono);
  const played = [...all].sort(chrono);
  return [
    ...VALUE_RECORDS.map((d) => holder(d, finished)),
    mostUsed(
      'clube',
      'Clube mais utilizado',
      played.filter((s) => s.clubId),
      (s) => [[s.clubId!, 1]],
      (k) => CLUB_BY_ID[k]?.name ?? k,
      'temporada',
    ),
    mostUsed<Decade>(
      'decada',
      'Década mais utilizada',
      played,
      (s) => Object.entries(s.metrics?.decadeCounts ?? {}) as [Decade, number][],
      (d) => `Anos ${d.slice(2, 4)}`,
      'titular',
    ),
    mostUsed('formacao', 'Formação mais utilizada', played, (s) => [[s.formationId, 1]], (k) => k, 'temporada'),
  ];
}

/** Recordes cujo detentor mudou para `season` (comparando antes e depois de incluí-la). */
export function brokenRecords(before: SeasonEntry[], season: SeasonEntry): PersonalRecord[] {
  if (!before.some((s) => s.status === 'finished')) return [];
  const prev = new Map(personalRecords(before).map((r) => [r.id, r]));
  return personalRecords([...before.filter((s) => s.runId !== season.runId), season]).filter(
    (r) => r.season?.runId === season.runId && r.count == null && prev.get(r.id)?.season && prev.get(r.id)!.raw !== r.raw,
  );
}

// ---------------------------------------------------------------------------
// Estatísticas de carreira

export interface CareerStats {
  seasonsPlayed: number;
  seasonsFinished: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  titles: number;
  perfectSeasons: number;
  bestClub: { clubId: string; name: string; titles: number; avgPoints: number; seasons: number } | null;
  bestDecade: { decade: Decade; avgPoints: number; seasons: number } | null;
  bestOverall: { value: number; season: SeasonEntry } | null;
  bestCampaign: SeasonEntry | null;
}

const mainDecade = (s: SeasonEntry): Decade | null => s.fixedDecade ?? s.decades[0] ?? null;

export function careerStats(all: SeasonEntry[], titles: TitleRecord[]): CareerStats {
  const finished = all.filter((s) => s.status === 'finished');
  const counted = all.filter((s) => s.status !== 'in_progress');
  const sum = (f: (s: SeasonEntry) => number) => counted.reduce((a, s) => a + f(s), 0);

  // melhor clube: mais títulos; depois maior média de pontos
  const clubs = new Map<string, { titles: number; pts: number; seasons: number }>();
  for (const s of finished) {
    if (!s.clubId) continue;
    const c = clubs.get(s.clubId) ?? { titles: 0, pts: 0, seasons: 0 };
    c.pts += s.points;
    c.seasons++;
    clubs.set(s.clubId, c);
  }
  for (const t of titles) if (t.clubId && clubs.has(t.clubId)) clubs.get(t.clubId)!.titles++;
  const club = [...clubs.entries()].sort((a, b) => b[1].titles - a[1].titles || b[1].pts / b[1].seasons - a[1].pts / a[1].seasons || b[1].seasons - a[1].seasons)[0];

  const decades = new Map<Decade, { pts: number; seasons: number }>();
  for (const s of finished) {
    const d = mainDecade(s);
    if (!d) continue;
    const c = decades.get(d) ?? { pts: 0, seasons: 0 };
    c.pts += s.points;
    c.seasons++;
    decades.set(d, c);
  }
  const decade = [...decades.entries()].sort((a, b) => b[1].pts / b[1].seasons - a[1].pts / a[1].seasons || b[1].seasons - a[1].seasons || DECADES.indexOf(a[0]) - DECADES.indexOf(b[0]))[0];

  const byOverall = [...all].sort((a, b) => b.squadOverall - a.squadOverall || chrono(a, b))[0];
  const best = [...finished].sort((a, b) => rankingScore({ points: b.points, wins: b.wins, gf: b.goalsFor, ga: b.goalsAgainst }) - rankingScore({ points: a.points, wins: a.wins, gf: a.goalsFor, ga: a.goalsAgainst }) || chrono(a, b))[0];

  return {
    seasonsPlayed: all.length,
    seasonsFinished: finished.length,
    wins: sum((s) => s.wins),
    draws: sum((s) => s.draws),
    losses: sum((s) => s.losses),
    goalsFor: sum((s) => s.goalsFor),
    goalsAgainst: sum((s) => s.goalsAgainst),
    titles: titles.length,
    perfectSeasons: finished.filter((s) => s.perfect).length,
    bestClub: club ? { clubId: club[0], name: CLUB_BY_ID[club[0]]?.name ?? club[0], titles: club[1].titles, avgPoints: Math.round((club[1].pts / club[1].seasons) * 10) / 10, seasons: club[1].seasons } : null,
    bestDecade: decade ? { decade: decade[0], avgPoints: Math.round((decade[1].pts / decade[1].seasons) * 10) / 10, seasons: decade[1].seasons } : null,
    bestOverall: byOverall ? { value: Math.round(byOverall.squadOverall), season: byOverall } : null,
    bestCampaign: best ?? null,
  };
}

/** "Minhas Grandes Campanhas": as temporadas mais marcantes, sem repetir. */
export function greatCampaigns(all: SeasonEntry[], limit = 6): { season: SeasonEntry; reasons: string[] }[] {
  const finished = all.filter((s) => s.status === 'finished').sort(chrono);
  if (!finished.length) return [];
  const reasons = new Map<string, string[]>();
  const add = (s: SeasonEntry | undefined, why: string) => {
    if (!s) return;
    reasons.set(s.runId, [...(reasons.get(s.runId) ?? []), why]);
  };
  for (const s of finished) if (s.perfect) add(s, 'Temporada perfeita');
  for (const s of finished) if (s.triple) add(s, 'Tríplice Coroa');
  for (const s of finished) if (s.champion && !s.perfect) add(s, 'Campeão brasileiro');
  const top = (f: (s: SeasonEntry) => number) => [...finished].sort((a, b) => f(b) - f(a) || chrono(a, b))[0];
  add(top((s) => s.points), 'Maior pontuação');
  add(top((s) => s.goalsFor), 'Melhor ataque');
  add(top((s) => -s.goalsAgainst), 'Melhor defesa');
  const weight = (r: string[]) => (r.includes('Temporada perfeita') ? 100 : 0) + (r.includes('Tríplice Coroa') ? 50 : 0) + r.length * 10;
  return [...reasons.entries()]
    .map(([runId, r]) => ({ season: finished.find((s) => s.runId === runId)!, reasons: r }))
    .sort((a, b) => weight(b.reasons) - weight(a.reasons) || b.season.points - a.season.points)
    .slice(0, limit);
}
