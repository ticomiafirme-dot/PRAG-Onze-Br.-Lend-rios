// Campeonato por pontos corridos (Brasileirão): tabela, classificação e artilharia.

import { Rng } from './rng';
import type { MatchResult, Side } from './match';

export interface Fixture {
  home: string;
  away: string;
}

export interface GoalRecord {
  side: Side;
  personId: string;
  name: string;
  minute: number;
  assist?: string;
  assistName?: string;
  penalty?: boolean;
}

/** Resultado compacto (todas as partidas). */
export interface PlayedMatch {
  comp: string;
  key: string;
  home: string;
  away: string;
  score: [number, number];
  seed: number;
  goals: GoalRecord[];
  /** Pênaltis em mata-mata (placar da disputa). */
  shootout?: [number, number];
}

export interface Standing {
  team: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
  form: ('V' | 'E' | 'D')[];
}

/** Gera turno e returno pelo método do círculo, alternando mandos. */
export function roundRobin(teams: string[], rng: Rng, doubleRound = true): Fixture[][] {
  const list = rng.shuffle(teams);
  if (list.length % 2 === 1) list.push('__folga__');
  const n = list.length;
  const rounds: Fixture[][] = [];
  const arr = [...list];
  for (let r = 0; r < n - 1; r++) {
    const fixtures: Fixture[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === '__folga__' || b === '__folga__') continue;
      // alterna o mando: o fixo (índice 0) troca a cada rodada; os demais por paridade
      const swap = i === 0 ? r % 2 === 1 : (r + i) % 2 === 1;
      fixtures.push(swap ? { home: b, away: a } : { home: a, away: b });
    }
    rounds.push(fixtures);
    // rotação: mantém arr[0] fixo
    arr.splice(1, 0, arr.pop()!);
  }
  if (!doubleRound) return rounds;
  const second = rounds.map((fx) => fx.map((f) => ({ home: f.away, away: f.home })));
  return [...rounds, ...second];
}

export function emptyStanding(team: string): Standing {
  return { team, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] };
}

export function computeStandings(teams: string[], matches: PlayedMatch[]): Standing[] {
  const table = new Map(teams.map((t) => [t, emptyStanding(t)]));
  for (const m of matches) {
    const h = table.get(m.home);
    const a = table.get(m.away);
    if (!h || !a) continue;
    const [gh, ga] = m.score;
    h.p++;
    a.p++;
    h.gf += gh;
    h.ga += ga;
    a.gf += ga;
    a.ga += gh;
    if (gh > ga) {
      h.w++;
      a.l++;
      h.pts += 3;
      h.form.push('V');
      a.form.push('D');
    } else if (gh < ga) {
      a.w++;
      h.l++;
      a.pts += 3;
      a.form.push('V');
      h.form.push('D');
    } else {
      h.d++;
      a.d++;
      h.pts++;
      a.pts++;
      h.form.push('E');
      a.form.push('E');
    }
  }
  return sortStandings([...table.values()]);
}

/** Critérios: pontos, vitórias, saldo, gols pró. */
export function sortStandings(rows: Standing[]): Standing[] {
  return rows.sort((x, y) => y.pts - x.pts || y.w - x.w || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf || x.team.localeCompare(y.team));
}

export function compactResult(comp: string, key: string, r: MatchResult): PlayedMatch {
  return {
    comp,
    key,
    home: r.home,
    away: r.away,
    score: r.score,
    seed: r.seed,
    goals: r.events
      .filter((e) => e.type === 'goal' || e.type === 'penalty-goal')
      .map((e) => ({
        side: e.side!,
        personId: e.player!,
        name: e.playerName!,
        minute: e.minute + (e.extra ? e.extra / 100 : 0),
        assist: e.assist,
        assistName: e.assistName,
        penalty: e.type === 'penalty-goal' || undefined,
      })),
  };
}

export interface ScorerRow {
  personId: string;
  name: string;
  team: string;
  goals: number;
  assists: number;
}

/** Artilharia a partir dos resultados compactos. */
export function topScorers(matches: PlayedMatch[]): ScorerRow[] {
  const map = new Map<string, ScorerRow>();
  for (const m of matches) {
    for (const g of m.goals) {
      const team = g.side === 'home' ? m.home : m.away;
      const k = `${team}|${g.personId}`;
      const row = map.get(k) ?? { personId: g.personId, name: g.name, team, goals: 0, assists: 0 };
      row.goals++;
      map.set(k, row);
      if (g.assist) {
        const ka = `${team}|${g.assist}`;
        const ra = map.get(ka) ?? { personId: g.assist, name: g.assistName ?? '', team, goals: 0, assists: 0 };
        ra.assists++;
        map.set(ka, ra);
      }
    }
  }
  return [...map.values()].sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name));
}
