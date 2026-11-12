// Campanha: o Brasileirão (e, na Tríplice Coroa, Estadual e Copa do Brasil).
// Mantém o calendário, os times, os resultados e as partidas do usuário.

import type { Club } from '../data/types';
import type { Database } from './database';
import type { GameMode } from './draft';
import { Rng, subSeed } from './rng';
import { countsCleanSheet, simulateMatch, type MatchResult } from './match';
import { compactResult, computeStandings, roundRobin, type Fixture, type PlayedMatch, type Standing } from './league';
import { COPA_STAGES, advanceStage, aggregate, createKnockout, simulateShootout, type CupState, type ShootoutKick, type Tie } from './cup';
import { buildAiTeam, type Difficulty, type TeamSheet } from './team';

export const USER_ID = 'user';

export type CompId = 'brasileirao' | 'copa' | 'estadual';

export const COMP_NAMES: Record<CompId, string> = {
  brasileirao: 'Brasileirão',
  copa: 'Copa do Brasil',
  estadual: 'Estadual',
};

export interface MatchDay {
  id: string;
  comp: CompId;
  label: string;
  /** rodada do Brasileirão (0-based) */
  round?: number;
  /** etapa do mata-mata e perna (1 = ida, 2 = volta) */
  stage?: number;
  leg?: 1 | 2;
  /** triangular do estadual */
  group?: number;
}

export interface UserMatchRecord {
  key: string;
  dayId: string;
  comp: CompId;
  label: string;
  home: string;
  away: string;
  result: MatchResult;
  shootout?: { kicks: ShootoutKick[]; score: [number, number] };
}

export interface Campaign {
  version: 1;
  mode: GameMode;
  difficulty: Difficulty;
  seed: number;
  createdAt: string;
  teams: Record<string, TeamSheet>;
  league: { teams: string[]; fixtures: Fixture[][] };
  calendar: MatchDay[];
  dayIndex: number;
  results: PlayedMatch[];
  userMatches: UserMatchRecord[];
  copa: CupState | null;
  estadual: CupState | null;
  estadualName: string | null;
  finished: boolean;
}

export interface CampaignSetup {
  db: Database;
  mode: GameMode;
  difficulty: Difficulty;
  seed: number;
  user: TeamSheet;
  /** Clube que o usuário representa (fica fora da liga como IA). */
  userClubId: string | null;
  /** Clubes da liga (20 com o usuário). */
  leagueClubs: Club[];
  /** Tríplice Coroa: inclui Estadual e Copa do Brasil. */
  triple: boolean;
  /** Clubes do estado do usuário (Estadual). */
  stateClubs?: Club[];
  stateCupName?: string;
}

export function createCampaign(setup: CampaignSetup): Campaign {
  const { db, difficulty, seed, user } = setup;
  const rng = new Rng(subSeed(seed, 'campanha'));
  const exclude = new Set(user.players.map((p) => p.personId));
  const teams: Record<string, TeamSheet> = { [USER_ID]: user };

  // 19 rivais (ou menos, se a base tiver menos clubes)
  const rivals = setup.leagueClubs.filter((c) => c.id !== setup.userClubId).slice(0, 19);
  for (const c of rivals) teams[c.id] = buildAiTeam(db, c.id, new Rng(subSeed(seed, `ia:${c.id}`)), difficulty, exclude);

  const leagueTeams = [USER_ID, ...rivals.map((c) => c.id)];
  const fixtures = roundRobin(leagueTeams, rng, true);

  const calendar: MatchDay[] = [];
  let estadual: CupState | null = null;
  let copa: CupState | null = null;

  if (setup.triple) {
    // Estadual: rivais do mesmo estado
    const stateRivals = (setup.stateClubs ?? []).filter((c) => c.id !== setup.userClubId);
    for (const c of stateRivals) {
      if (!teams[c.id]) teams[c.id] = buildAiTeam(db, c.id, new Rng(subSeed(seed, `ia:${c.id}`)), difficulty, exclude);
    }
    const estTeams = [USER_ID, ...stateRivals.map((c) => c.id)];
    estadual = createEstadual(estTeams, rng, setup.stateCupName ?? 'Estadual');
    calendar.push(...estadualDays(estadual));
    // Copa do Brasil: 16 times (usuário + 15 rivais da liga)
    const copaTeams = [USER_ID, ...rng.shuffle(rivals.map((c) => c.id)).slice(0, 15)];
    copa = createKnockout('copa', 'Copa do Brasil', copaTeams, rng, COPA_STAGES);
  }

  const copaAfter = new Map<number, MatchDay>();
  if (copa) {
    // pernas da Copa intercaladas com o Brasileirão
    const slots = [4, 7, 11, 14, 19, 22, 28, 31];
    COPA_STAGES.forEach((name, s) => {
      copaAfter.set(slots[s * 2], { id: `copa-${s}-1`, comp: 'copa', label: `Copa do Brasil · ${name} (ida)`, stage: s, leg: 1 });
      copaAfter.set(slots[s * 2 + 1], { id: `copa-${s}-2`, comp: 'copa', label: `Copa do Brasil · ${name} (volta)`, stage: s, leg: 2 });
    });
  }
  fixtures.forEach((_, r) => {
    calendar.push({ id: `br-${r}`, comp: 'brasileirao', label: `Brasileirão · Rodada ${r + 1}`, round: r });
    const cd = copaAfter.get(r + 1);
    if (cd) calendar.push(cd);
  });

  return {
    version: 1,
    mode: setup.mode,
    difficulty,
    seed,
    createdAt: new Date().toISOString(),
    teams,
    league: { teams: leagueTeams, fixtures },
    calendar,
    dayIndex: 0,
    results: [],
    userMatches: [],
    copa,
    estadual,
    estadualName: setup.triple ? (setup.stateCupName ?? 'Estadual') : null,
    finished: false,
  };
}

function createEstadual(teams: string[], rng: Rng, name: string): CupState {
  if (teams.length >= 4) {
    return createKnockout('estadual', name, teams.slice(0, 4), rng, ['Semifinal', 'Final']);
  }
  if (teams.length === 3) {
    const order = rng.shuffle(teams);
    return {
      id: 'estadual',
      name,
      stages: [],
      stageNames: ['Final'],
      current: -1,
      champion: null,
      groupStage: {
        teams: order,
        fixtures: [
          { home: order[0], away: order[1], key: null },
          { home: order[1], away: order[2], key: null },
          { home: order[2], away: order[0], key: null },
        ],
      },
    };
  }
  if (teams.length === 2) return createKnockout('estadual', name, teams, rng, ['Final']);
  // um único clube no estado: título simbólico decidido contra si mesmo não existe
  return { id: 'estadual', name, stages: [], stageNames: [], current: 0, champion: null };
}

function estadualDays(cup: CupState): MatchDay[] {
  const days: MatchDay[] = [];
  if (cup.groupStage) {
    cup.groupStage.fixtures.forEach((_, i) => days.push({ id: `est-g-${i}`, comp: 'estadual', label: `${cup.name} · Triangular (${i + 1}ª rodada)`, group: i }));
    days.push({ id: 'est-f-1', comp: 'estadual', label: `${cup.name} · Final (ida)`, stage: 0, leg: 1 });
    days.push({ id: 'est-f-2', comp: 'estadual', label: `${cup.name} · Final (volta)`, stage: 0, leg: 2 });
    return days;
  }
  cup.stageNames.forEach((name, s) => {
    days.push({ id: `est-${s}-1`, comp: 'estadual', label: `${cup.name} · ${name} (ida)`, stage: s, leg: 1 });
    days.push({ id: `est-${s}-2`, comp: 'estadual', label: `${cup.name} · ${name} (volta)`, stage: s, leg: 2 });
  });
  return days;
}

// ---------------------------------------------------------------------------

export function currentDay(c: Campaign): MatchDay | null {
  return c.calendar[c.dayIndex] ?? null;
}

function cupOf(c: Campaign, comp: CompId): CupState | null {
  return comp === 'copa' ? c.copa : comp === 'estadual' ? c.estadual : null;
}

/** Jogos de um dia do calendário. */
export function dayFixtures(c: Campaign, day: MatchDay): Fixture[] {
  if (day.comp === 'brasileirao') return c.league.fixtures[day.round!];
  const cup = cupOf(c, day.comp);
  if (!cup) return [];
  if (day.group != null) {
    const f = cup.groupStage?.fixtures[day.group];
    return f ? [{ home: f.home, away: f.away }] : [];
  }
  const stage = cup.stages[day.stage!];
  if (!stage) return [];
  return stage.ties.map((t) => (day.leg === 1 ? { home: t.a, away: t.b } : { home: t.b, away: t.a }));
}

export function userFixture(c: Campaign, day: MatchDay | null = currentDay(c)): Fixture | null {
  if (!day) return null;
  return dayFixtures(c, day).find((f) => f.home === USER_ID || f.away === USER_ID) ?? null;
}

export function matchSeed(c: Campaign, day: MatchDay, f: Fixture): number {
  return subSeed(c.seed, `${day.id}:${f.home}:${f.away}`);
}

export function matchKey(day: MatchDay, f: Fixture): string {
  return `${day.id}:${f.home}:${f.away}`;
}

/** Simula a partida do usuário (determinística pela semente). */
export function simulateUserMatch(c: Campaign): { day: MatchDay; fixture: Fixture; result: MatchResult } | null {
  const day = currentDay(c);
  const f = userFixture(c, day);
  if (!day || !f) return null;
  const result = simulateMatch(c.teams[f.home], c.teams[f.away], matchSeed(c, day, f));
  return { day, fixture: f, result };
}

/** Joga o dia inteiro: a partida do usuário (já simulada) e as demais. */
export function playDay(c: Campaign, userResult?: MatchResult): Campaign {
  const day = currentDay(c);
  if (!day || c.finished) return c;
  const fixtures = dayFixtures(c, day);
  const results = [...c.results];
  const userMatches = [...c.userMatches];
  const byKey = new Map(results.map((m) => [m.key, m]));

  for (const f of fixtures) {
    const key = matchKey(day, f);
    if (byKey.has(key)) continue;
    const isUser = f.home === USER_ID || f.away === USER_ID;
    const full = isUser && userResult ? userResult : simulateMatch(c.teams[f.home], c.teams[f.away], matchSeed(c, day, f));
    const compact = compactResult(day.comp, key, full);
    results.push(compact);
    byKey.set(key, compact);
    if (isUser) userMatches.push({ key, dayId: day.id, comp: day.comp, label: day.label, home: f.home, away: f.away, result: full });
  }

  let next: Campaign = { ...c, results, userMatches };
  next = resolveCups(next, day, byKey);
  next = { ...next, dayIndex: next.dayIndex + 1 };
  // pula dias de mata-mata em que nada há para jogar
  while (next.calendar[next.dayIndex] && dayFixtures(next, next.calendar[next.dayIndex]).length === 0) {
    next = { ...next, dayIndex: next.dayIndex + 1 };
  }
  if (next.dayIndex >= next.calendar.length) next = { ...next, finished: true };
  return next;
}

function resolveCups(c: Campaign, day: MatchDay, byKey: Map<string, PlayedMatch>): Campaign {
  if (day.comp === 'brasileirao') return c;
  const cup = cupOf(c, day.comp)!;
  let updated: CupState = cup;
  const rng = new Rng(subSeed(c.seed, `sorteio:${day.id}`));
  let userMatches = c.userMatches;
  let results = c.results;

  if (day.group != null && cup.groupStage) {
    const fixtures = cup.groupStage.fixtures.map((f, i) => (i === day.group ? { ...f, key: matchKey(day, f) } : f));
    updated = { ...cup, groupStage: { ...cup.groupStage, fixtures } };
    if (fixtures.every((f) => f.key)) {
      // dois primeiros do triangular decidem a final
      const table = computeStandings(
        cup.groupStage.teams,
        fixtures.map((f) => byKey.get(f.key!)!).filter(Boolean),
      );
      const [first, second] = table;
      updated = {
        ...updated,
        current: 0,
        stages: [{ id: 'estadual-0', name: 'Final', legs: 2, ties: [{ id: 'estadual-0-0', a: second.team, b: first.team, legs: [null, null], winner: null }] }],
      };
    }
  } else if (day.stage != null) {
    const stage = cup.stages[day.stage];
    if (stage) {
      const ties: Tie[] = stage.ties.map((t) => {
        const f = day.leg === 1 ? { home: t.a, away: t.b } : { home: t.b, away: t.a };
        const key = matchKey(day, f);
        const legs = [...t.legs];
        legs[day.leg! - 1] = key;
        const tie: Tie = { ...t, legs };
        if (day.leg === 2) {
          const [ga, gb] = aggregate(tie, byKey);
          if (ga !== gb) tie.winner = ga > gb ? t.a : t.b;
          else {
            // pênaltis após a volta (mandante da volta = t.b)
            const so = simulateShootout(c.teams[t.b], c.teams[t.a], subSeed(c.seed, key));
            tie.shootout = [so.score[1], so.score[0]];
            tie.winner = so.score[0] > so.score[1] ? t.b : t.a;
            results = results.map((m) => (m.key === key ? { ...m, shootout: so.score } : m));
            if (t.a === USER_ID || t.b === USER_ID) {
              userMatches = userMatches.map((um) => (um.key === key ? { ...um, shootout: so } : um));
            }
          }
        }
        return tie;
      });
      const stages = [...cup.stages];
      stages[day.stage] = { ...stage, ties };
      updated = { ...cup, stages };
      if (day.leg === 2) updated = advanceStage(updated, rng);
    }
  }
  return day.comp === 'copa' ? { ...c, copa: updated, results, userMatches } : { ...c, estadual: updated, results, userMatches };
}

/** Simula todas as rodadas restantes de uma vez (usado em "Simular até o fim"). */
export function simulateRest(c: Campaign): Campaign {
  let cur = c;
  let guard = 0;
  while (!cur.finished && guard++ < 200) cur = playDay(cur);
  return cur;
}

export function leagueStandings(c: Campaign): Standing[] {
  return computeStandings(
    c.league.teams,
    c.results.filter((m) => m.comp === 'brasileirao'),
  );
}

export interface CampaignSummary {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  points: number;
  position: number;
  perfect: boolean;
  unbeaten: boolean;
  champion: boolean;
  copaChampion: boolean;
  estadualChampion: boolean;
  triple: boolean;
}

export function summarize(c: Campaign): CampaignSummary {
  const table = leagueStandings(c);
  const idx = table.findIndex((s) => s.team === USER_ID);
  const me = table[idx];
  const totalRounds = c.league.fixtures.length;
  const done = me.p === totalRounds;
  const champion = done && idx === 0;
  const copaChampion = c.copa?.champion === USER_ID;
  const estadualChampion = c.estadual?.champion === USER_ID;
  return {
    played: me.p,
    wins: me.w,
    draws: me.d,
    losses: me.l,
    gf: me.gf,
    ga: me.ga,
    points: me.pts,
    position: idx + 1,
    perfect: done && me.w === totalRounds,
    unbeaten: done && me.l === 0,
    champion,
    copaChampion,
    estadualChampion,
    triple: champion && copaChampion && estadualChampion,
  };
}

// ---------------------------------------------------------------------------
// Estatísticas individuais do time do usuário

export interface PlayerSeasonStats {
  personId: string;
  name: string;
  pos: string;
  number: number;
  games: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  saves: number;
  cleanSheets: number;
  mvps: number;
  ratingSum: number;
  rating: number;
}

export function userPlayerStats(c: Campaign, comp?: CompId): PlayerSeasonStats[] {
  const user = c.teams[USER_ID];
  const map = new Map<string, PlayerSeasonStats>();
  for (const p of user.players) {
    map.set(p.personId, {
      personId: p.personId,
      name: p.name,
      pos: p.pos,
      number: p.number,
      games: 0,
      goals: 0,
      assists: 0,
      yellow: 0,
      red: 0,
      saves: 0,
      cleanSheets: 0,
      mvps: 0,
      ratingSum: 0,
      rating: 0,
    });
  }
  for (const um of c.userMatches) {
    if (comp && um.comp !== comp) continue;
    const side = um.home === USER_ID ? 'home' : 'away';
    const conceded = um.result.score[side === 'home' ? 1 : 0];
    for (const line of um.result.players[side]) {
      const s = map.get(line.personId);
      if (!s) continue;
      s.games++;
      s.goals += line.goals;
      s.assists += line.assists;
      s.yellow += line.yellow;
      s.red += line.red;
      s.saves += line.saves;
      s.ratingSum += line.rating;
      if (conceded === 0 && countsCleanSheet(line.pos)) s.cleanSheets++;
      if (um.result.mvp?.side === side && um.result.mvp.personId === line.personId) s.mvps++;
    }
  }
  for (const s of map.values()) s.rating = s.games ? Math.round((s.ratingSum / s.games) * 100) / 100 : 0;
  return [...map.values()];
}
