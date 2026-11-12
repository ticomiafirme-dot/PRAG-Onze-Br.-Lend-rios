// Mata-mata em ida e volta (Copa do Brasil / fases finais dos estaduais),
// com disputa de pênaltis em caso de empate no agregado.

import { Rng, subSeed } from './rng';
import type { PlayedMatch } from './league';
import type { TeamSheet } from './team';

export interface Tie {
  id: string;
  a: string; // mandante da ida
  b: string;
  legs: (string | null)[]; // chaves das partidas (ida, volta)
  winner: string | null;
  shootout?: [number, number];
}

export interface CupStage {
  id: string;
  name: string;
  ties: Tie[];
  /** número de jogos por confronto (1 ou 2) */
  legs: 1 | 2;
}

export interface CupState {
  id: 'copa' | 'estadual';
  name: string;
  stages: CupStage[];
  stageNames: string[];
  current: number;
  champion: string | null;
  /** Estadual com 3 clubes começa com um triangular. */
  groupStage?: { teams: string[]; fixtures: { home: string; away: string; key: string | null }[] } | null;
}

export const COPA_STAGES = ['Oitavas de final', 'Quartas de final', 'Semifinal', 'Final'];

export function createKnockout(id: CupState['id'], name: string, teams: string[], rng: Rng, stageNames: string[]): CupState {
  const order = rng.shuffle(teams);
  const ties: Tie[] = [];
  for (let i = 0; i < order.length; i += 2) {
    ties.push({ id: `${id}-0-${i / 2}`, a: order[i], b: order[i + 1], legs: [null, null], winner: null });
  }
  const offset = stageNames.length - Math.log2(order.length);
  return {
    id,
    name,
    stages: [{ id: `${id}-0`, name: stageNames[offset] ?? 'Mata-mata', ties, legs: 2 }],
    stageNames: stageNames.slice(offset),
    current: 0,
    champion: null,
  };
}

/** Aggregado do confronto (a, b). */
export function aggregate(tie: Tie, results: Map<string, PlayedMatch>): [number, number] {
  let ga = 0;
  let gb = 0;
  for (const k of tie.legs) {
    if (!k) continue;
    const m = results.get(k);
    if (!m) continue;
    if (m.home === tie.a) {
      ga += m.score[0];
      gb += m.score[1];
    } else {
      ga += m.score[1];
      gb += m.score[0];
    }
  }
  return [ga, gb];
}

export interface ShootoutKick {
  side: 'home' | 'away';
  name: string;
  scored: boolean;
}

/** Disputa de pênaltis: 5 cobranças e depois alternadas. */
export function simulateShootout(home: TeamSheet, away: TeamSheet, seed: number): { kicks: ShootoutKick[]; score: [number, number] } {
  const rng = new Rng(subSeed(seed, 'penaltis'));
  const takers = (t: TeamSheet) => [...t.players].filter((p) => p.pos !== 'GOL').sort((x, y) => y.eff - x.eff);
  const gk = (t: TeamSheet) => t.players.find((p) => p.pos === 'GOL')?.eff ?? 75;
  const th = takers(home);
  const ta = takers(away);
  const kicks: ShootoutKick[] = [];
  const score: [number, number] = [0, 0];
  const conv = (eff: number, keeper: number) => Math.max(0.55, Math.min(0.9, 0.74 + (eff - keeper) * 0.005));
  let kh = 0;
  let ka = 0;
  const shoot = (side: 'home' | 'away') => {
    const p = side === 'home' ? th[kh % th.length] : ta[ka % ta.length];
    const scored = rng.chance(conv(p.eff, gk(side === 'home' ? away : home)));
    if (scored) score[side === 'home' ? 0 : 1]++;
    kicks.push({ side, name: p.name, scored });
    if (side === 'home') kh++;
    else ka++;
  };
  // decidido antes do fim das 5 cobranças?
  const decided = () => score[0] > score[1] + (5 - ka) || score[1] > score[0] + (5 - kh);
  for (let r = 0; r < 5; r++) {
    shoot('home');
    if (decided()) break;
    shoot('away');
    if (decided()) break;
  }
  // alternadas
  while (score[0] === score[1] && kh < 30) {
    shoot('home');
    shoot('away');
  }
  return { kicks, score };
}

/** Avança a fase quando todos os confrontos estão decididos. */
export function advanceStage(cup: CupState, rng: Rng): CupState {
  const stage = cup.stages[cup.current];
  if (!stage || stage.ties.some((t) => !t.winner)) return cup;
  const winners = stage.ties.map((t) => t.winner!);
  if (winners.length === 1) return { ...cup, champion: winners[0] };
  const next: Tie[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    // sorteia o mando da ida
    const [a, b] = rng.chance(0.5) ? [winners[i], winners[i + 1]] : [winners[i + 1], winners[i]];
    next.push({ id: `${cup.id}-${cup.current + 1}-${i / 2}`, a, b, legs: [null, null], winner: null });
  }
  const name = cup.stageNames[cup.current + 1] ?? 'Final';
  return {
    ...cup,
    stages: [...cup.stages, { id: `${cup.id}-${cup.current + 1}`, name, ties: next, legs: 2 }],
    current: cup.current + 1,
  };
}

export function teamStillAlive(cup: CupState, team: string): boolean {
  if (cup.champion) return cup.champion === team;
  const stage = cup.stages[cup.current];
  if (!stage) return cup.groupStage?.teams.includes(team) ?? false;
  return stage.ties.some((t) => (t.a === team || t.b === team) && (!t.winner || t.winner === team));
}
