// Motor de simulação de partidas.
// A partida é simulada minuto a minuto. Em cada minuto pode surgir um ataque;
// quem ataca depende da posse (meio-campo) e do duelo ataque × defesa. O ataque
// pode virar finalização, que pode ir no gol, ser defendida, ir para fora ou
// explodir na trave. Há faltas, cartões, pênaltis, escanteios e impedimentos.
// Tudo é determinístico a partir da semente: a mesma partida pode ser reassistida.

import type { Position, Role } from '../data/types';
import { ROLE_CATEGORY, toPosition } from '../data/types';
import { Rng } from './rng';
import type { TeamPlayer, TeamSheet } from './team';

export type Side = 'home' | 'away';

export type EventType =
  | 'kickoff'
  | 'goal'
  | 'penalty-goal'
  | 'own-goal'
  | 'save'
  | 'miss'
  | 'post'
  | 'chance'
  | 'yellow'
  | 'red'
  | 'penalty-miss'
  | 'corner'
  | 'offside'
  | 'halftime'
  | 'fulltime';

export interface MatchEvent {
  /** Minuto "de jogo" (1–90); acréscimos em `extra`. */
  minute: number;
  extra?: number;
  /** Ordem absoluta no tempo, usada para a reprodução. */
  t: number;
  half: 1 | 2;
  side: Side | null;
  type: EventType;
  player?: string;
  playerName?: string;
  assist?: string;
  assistName?: string;
  text: string;
  score: [number, number];
}

export interface TeamMatchStats {
  goals: number;
  shots: number;
  onTarget: number;
  saves: number;
  corners: number;
  fouls: number;
  yellow: number;
  red: number;
  offsides: number;
  possession: number;
  xg: number;
}

export interface PlayerMatchLine {
  personId: string;
  name: string;
  slotId: string;
  pos: Position;
  number: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  saves: number;
  rating: number;
}

export interface MatchResult {
  seed: number;
  home: string;
  away: string;
  score: [number, number];
  events: MatchEvent[];
  stats: Record<Side, TeamMatchStats>;
  players: Record<Side, PlayerMatchLine[]>;
  mvp: { side: Side; personId: string; name: string } | null;
  stoppage: [number, number];
  /** Estatísticas acumuladas a cada 5 minutos (para exibição ao vivo). */
  snapshots: StatSnapshot[];
}

export interface StatSnapshot {
  minute: number;
  possession: number;
  home: [number, number, number, number, number];
  away: [number, number, number, number, number];
}

/** Parâmetros de calibragem do motor. */
export const TUNING = {
  attackRate: 0.27,
  homeBoost: 1.5,
  shareScale: 14,
  shotBase: 0.6,
  shotSlope: 0.012,
  onTargetBase: 0.33,
  onTargetSlope: 0.006,
  goalBase: 0.29,
  goalSlope: 0.011,
  penaltyChance: 0.0075,
  penaltyConversion: 0.76,
  foulRate: 0.3,
  yellowPerFoul: 0.13,
  redPerFoul: 0.004,
  redCardPenalty: 4,
};

/**
 * Pesos por função histórica do atleta (dão o "jeito" de cada um: centroavante
 * cabeceia, meia dá passe...). A vaga só exige a categoria; quando a função do
 * jogador é de outra categoria (ex.: lateral improvisado no meio), vale a média
 * da categoria da vaga.
 */
interface Weights {
  role: Record<Role, number>;
  cat: Record<Position, number>;
}

function weights(role: Record<Role, number>): Weights {
  const cat: Record<Position, number> = { GOL: 0, DEF: 0, MEI: 0, ATA: 0 };
  const n: Record<Position, number> = { GOL: 0, DEF: 0, MEI: 0, ATA: 0 };
  for (const [r, w] of Object.entries(role) as [Role, number][]) {
    cat[ROLE_CATEGORY[r]] += w;
    n[ROLE_CATEGORY[r]]++;
  }
  for (const c of Object.keys(cat) as Position[]) cat[c] = n[c] ? cat[c] / n[c] : 0;
  return { role, cat };
}

const SCORER_W = weights({ GOL: 0, LD: 0.7, ZAG: 0.6, LE: 0.7, VOL: 0.8, MC: 1.4, MEI: 2.3, PD: 2.7, PE: 2.7, SA: 2.9, CA: 3.3 });
const HEADER_W = weights({ GOL: 0, LD: 0.3, ZAG: 2.6, LE: 0.3, VOL: 0.8, MC: 0.6, MEI: 0.4, PD: 0.6, PE: 0.6, SA: 1.4, CA: 3.4 });
const ASSIST_W = weights({ GOL: 0.05, LD: 1.5, ZAG: 0.4, LE: 1.5, VOL: 0.8, MC: 1.5, MEI: 3.2, PD: 2.6, PE: 2.6, SA: 2, CA: 1.4 });
const FOUL_W = weights({ GOL: 0.1, LD: 1.2, ZAG: 1.6, LE: 1.2, VOL: 2, MC: 1.2, MEI: 0.8, PD: 0.7, PE: 0.7, SA: 0.6, CA: 0.8 });

function weightOf(w: Weights, p: TeamPlayer): number {
  const cat = toPosition(p.pos);
  if (p.role && ROLE_CATEGORY[p.role] === cat) return w.role[p.role];
  return w.cat[cat];
}

/** Defensores e goleiros somam "jogo sem sofrer gols". */
export function countsCleanSheet(pos: string): boolean {
  const c = toPosition(pos);
  return c === 'GOL' || c === 'DEF';
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

const emptyStats = (): TeamMatchStats => ({
  goals: 0,
  shots: 0,
  onTarget: 0,
  saves: 0,
  corners: 0,
  fouls: 0,
  yellow: 0,
  red: 0,
  offsides: 0,
  possession: 50,
  xg: 0,
});

export function simulateMatch(home: TeamSheet, away: TeamSheet, seed: number): MatchResult {
  const rng = new Rng(seed);
  const teams: Record<Side, TeamSheet> = { home, away };
  const stats: Record<Side, TeamMatchStats> = { home: emptyStats(), away: emptyStats() };
  const lines: Record<Side, Map<string, PlayerMatchLine>> = { home: new Map(), away: new Map() };
  for (const side of ['home', 'away'] as Side[]) {
    for (const p of teams[side].players) {
      lines[side].set(p.personId, {
        personId: p.personId,
        name: p.name,
        slotId: p.slotId,
        pos: p.pos,
        number: p.number,
        goals: 0,
        assists: 0,
        yellow: 0,
        red: 0,
        saves: 0,
        rating: 6,
      });
    }
  }
  const sentOff: Record<Side, Set<string>> = { home: new Set(), away: new Set() };
  const reds: Record<Side, number> = { home: 0, away: 0 };
  const events: MatchEvent[] = [];
  const score: [number, number] = [0, 0];
  let t = 0;

  const active = (side: Side): TeamPlayer[] => teams[side].players.filter((p) => !sentOff[side].has(p.personId));
  const other = (s: Side): Side => (s === 'home' ? 'away' : 'home');
  const idx = (s: Side) => (s === 'home' ? 0 : 1);

  const rating = (side: Side) => {
    const r = teams[side].ratings;
    const boost = side === 'home' ? TUNING.homeBoost : 0;
    const pen = reds[side] * TUNING.redCardPenalty;
    return {
      att: r.attack + boost - pen,
      mid: r.midfield + boost - pen,
      def: r.defense + boost * 0.6 - pen,
      gk: r.goalkeeping,
    };
  };

  const push = (e: Omit<MatchEvent, 't' | 'score'>) => {
    events.push({ ...e, t: t++, score: [score[0], score[1]] });
  };

  const pickPlayer = (side: Side, w: Weights, exclude?: string): TeamPlayer | undefined => {
    const pool = active(side).filter((p) => p.personId !== exclude && weightOf(w, p) > 0);
    if (!pool.length) return undefined;
    return rng.weighted(pool, (p) => weightOf(w, p) * Math.pow(p.eff / 80, 2));
  };

  const gkOf = (side: Side) => active(side).find((p) => toPosition(p.pos) === 'GOL');

  const stoppage: [number, number] = [rng.int(1, 4), rng.int(2, 6)];
  const mins: { minute: number; extra?: number; half: 1 | 2 }[] = [];
  for (let m = 1; m <= 45; m++) mins.push({ minute: m, half: 1 });
  for (let e = 1; e <= stoppage[0]; e++) mins.push({ minute: 45, extra: e, half: 1 });
  for (let m = 46; m <= 90; m++) mins.push({ minute: m, half: 2 });
  for (let e = 1; e <= stoppage[1]; e++) mins.push({ minute: 90, extra: e, half: 2 });

  push({ minute: 0, half: 1, side: null, type: 'kickoff', text: `Bola rolando! ${home.name} e ${away.name} se enfrentam.` });

  let possessionHome = 0;
  let possessionTotal = 0;
  let halftimeDone = false;
  const snapshots: StatSnapshot[] = [];
  const pack = (st: TeamMatchStats): [number, number, number, number, number] => [st.shots, st.onTarget, st.saves, st.corners, st.fouls];
  const snap = (minute: number) =>
    snapshots.push({
      minute,
      possession: possessionTotal ? Math.round((100 * possessionHome) / possessionTotal) : 50,
      home: pack(stats.home),
      away: pack(stats.away),
    });

  for (const slot of mins) {
    if (!slot.extra && slot.minute % 5 === 0) snap(slot.minute - 1);
    if (slot.half === 2 && !halftimeDone) {
      halftimeDone = true;
      push({ minute: 45, half: 1, side: null, type: 'halftime', text: `Fim do primeiro tempo: ${home.short} ${score[0]} × ${score[1]} ${away.short}.` });
    }
    const H = rating('home');
    const A = rating('away');
    // posse do minuto
    let pHome = clamp(0.5 + (H.mid - A.mid) * 0.012, 0.28, 0.72);
    // quem está perdendo tende a ficar mais com a bola no fim
    const diff = score[0] - score[1];
    if (slot.half === 2 && Math.abs(diff) >= 1) pHome = clamp(pHome + (diff > 0 ? -0.04 : 0.04), 0.25, 0.75);
    possessionHome += pHome;
    possessionTotal += 1;

    const ev = { minute: slot.minute, extra: slot.extra, half: slot.half };

    // faltas e cartões
    if (rng.chance(TUNING.foulRate)) {
      const fouler: Side = rng.chance(1 - pHome) ? 'home' : 'away';
      stats[fouler].fouls++;
      const p = pickPlayer(fouler, FOUL_W);
      if (p) {
        const line = lines[fouler].get(p.personId)!;
        if (rng.chance(TUNING.redPerFoul)) {
          line.red++;
          stats[fouler].red++;
          sentOff[fouler].add(p.personId);
          reds[fouler]++;
          push({ ...ev, side: fouler, type: 'red', player: p.personId, playerName: p.name, text: `Vermelho direto! ${p.name} (${teams[fouler].short}) é expulso após entrada violenta.` });
        } else if (rng.chance(TUNING.yellowPerFoul)) {
          line.yellow++;
          stats[fouler].yellow++;
          if (line.yellow >= 2) {
            line.red++;
            stats[fouler].red++;
            sentOff[fouler].add(p.personId);
            reds[fouler]++;
            push({ ...ev, side: fouler, type: 'red', player: p.personId, playerName: p.name, text: `Segundo amarelo para ${p.name}! ${teams[fouler].short} fica com um a menos.` });
          } else {
            push({ ...ev, side: fouler, type: 'yellow', player: p.personId, playerName: p.name, text: rng.pick(YELLOW_TEXTS)(p.name) });
          }
        }
      }
    }

    if (!rng.chance(TUNING.attackRate)) continue;

    const wH = pHome * Math.exp((H.att - A.def) / TUNING.shareScale);
    const wA = (1 - pHome) * Math.exp((A.att - H.def) / TUNING.shareScale);
    const side: Side = rng.chance(wH / (wH + wA)) ? 'home' : 'away';
    const opp = other(side);
    const atk = side === 'home' ? H : A;
    const dfn = side === 'home' ? A : H;
    const edge = atk.att - dfn.def;

    // pênalti
    if (rng.chance(TUNING.penaltyChance * Math.exp(edge / 25))) {
      // cobrador: entre os três melhores jogadores de linha (não sempre o mesmo)
      const takers = [...active(side)].filter((p) => toPosition(p.pos) !== 'GOL').sort((a, b) => b.eff - a.eff).slice(0, 3);
      const taker = takers.length ? rng.pick(takers) : undefined;
      const gk = gkOf(opp);
      stats[side].shots++;
      stats[side].xg += 0.76;
      const conv = clamp(TUNING.penaltyConversion + ((taker?.eff ?? 80) - (gk?.eff ?? 75)) * 0.006, 0.55, 0.92);
      if (taker && rng.chance(conv)) {
        stats[side].onTarget++;
        stats[side].goals++;
        score[idx(side)]++;
        lines[side].get(taker.personId)!.goals++;
        push({ ...ev, side, type: 'penalty-goal', player: taker.personId, playerName: taker.name, text: `GOOOL DE PÊNALTI! ${taker.name} bate com categoria e marca para o ${teams[side].short}.` });
      } else if (taker) {
        const saved = rng.chance(0.6) && gk;
        if (saved) {
          stats[side].onTarget++;
          stats[opp].saves++;
          lines[opp].get(gk!.personId)!.saves++;
          lines[opp].get(gk!.personId)!.rating += 0.6;
        }
        push({ ...ev, side, type: 'penalty-miss', player: taker.personId, playerName: taker.name, text: saved ? `DEFENDEU! ${gk!.name} pega o pênalti cobrado por ${taker.name}!` : `${taker.name} isola a cobrança de pênalti! Que desperdício.` });
      }
      continue;
    }

    // impedimento
    if (rng.chance(0.07)) {
      stats[side].offsides++;
      const p = pickPlayer(side, SCORER_W);
      if (p && rng.chance(0.35)) push({ ...ev, side, type: 'offside', player: p.personId, playerName: p.name, text: `${p.name} estava em posição de impedimento. Lance anulado.` });
      continue;
    }

    const pShot = clamp(TUNING.shotBase + edge * TUNING.shotSlope, 0.25, 0.88);
    if (!rng.chance(pShot)) {
      // ataque neutralizado: às vezes vira escanteio
      if (rng.chance(0.28)) stats[side].corners++;
      continue;
    }

    // jogada de bola parada (escanteio + cabeçada) ou lance corrido
    const header = rng.chance(0.18);
    if (header) stats[side].corners++;
    const shooter = pickPlayer(side, header ? HEADER_W : SCORER_W);
    if (!shooter) continue;
    stats[side].shots++;
    // qualidade do finalizador relativa à defesa adversária (não a um valor absoluto)
    const pOn = clamp(TUNING.onTargetBase + (shooter.eff - dfn.def) * TUNING.onTargetSlope, 0.15, 0.6);
    const gk = gkOf(opp);
    const pGoal = clamp(TUNING.goalBase + (shooter.eff - (gk?.eff ?? dfn.gk)) * TUNING.goalSlope + edge * 0.004, 0.07, 0.62);
    stats[side].xg += pOn * pGoal;

    if (rng.chance(pOn)) {
      stats[side].onTarget++;
      if (rng.chance(pGoal)) {
        // gol!
        stats[side].goals++;
        score[idx(side)]++;
        lines[side].get(shooter.personId)!.goals++;
        let assist: TeamPlayer | undefined;
        if (rng.chance(header ? 0.92 : 0.78)) {
          assist = pickPlayer(side, ASSIST_W, shooter.personId);
          if (assist) lines[side].get(assist.personId)!.assists++;
        }
        const text = header
          ? rng.pick(HEADER_GOAL_TEXTS)(shooter.name, assist?.name, teams[side].short)
          : rng.pick(GOAL_TEXTS)(shooter.name, assist?.name, teams[side].short);
        push({ ...ev, side, type: 'goal', player: shooter.personId, playerName: shooter.name, assist: assist?.personId, assistName: assist?.name, text });
      } else {
        stats[opp].saves++;
        if (gk) lines[opp].get(gk.personId)!.saves++;
        if (rng.chance(0.45) && gk) push({ ...ev, side, type: 'save', player: shooter.personId, playerName: shooter.name, text: rng.pick(SAVE_TEXTS)(gk.name, shooter.name) });
      }
    } else if (rng.chance(0.06)) {
      push({ ...ev, side, type: 'post', player: shooter.personId, playerName: shooter.name, text: `NA TRAVE! ${shooter.name} carimba o poste e o ${teams[side].short} quase marca.` });
    } else if (rng.chance(0.22)) {
      push({ ...ev, side, type: 'miss', player: shooter.personId, playerName: shooter.name, text: rng.pick(MISS_TEXTS)(shooter.name) });
    }
  }

  push({ minute: 90, extra: stoppage[1], half: 2, side: null, type: 'fulltime', text: `Fim de jogo! ${home.short} ${score[0]} × ${score[1]} ${away.short}.` });

  snap(90 + stoppage[1]);
  const possHome = Math.round((100 * possessionHome) / Math.max(1, possessionTotal));
  stats.home.possession = possHome;
  stats.away.possession = 100 - possHome;
  stats.home.xg = Math.round(stats.home.xg * 100) / 100;
  stats.away.xg = Math.round(stats.away.xg * 100) / 100;

  // notas dos jogadores
  for (const side of ['home', 'away'] as Side[]) {
    const gf = score[idx(side)];
    const ga = score[idx(other(side))];
    for (const line of lines[side].values()) {
      const p = teams[side].players.find((x) => x.personId === line.personId)!;
      let r = 6 + (p.eff - 80) * 0.04;
      r += line.goals * 1.1 + line.assists * 0.6;
      if (toPosition(line.pos) === 'GOL') r += line.saves * 0.25;
      if (countsCleanSheet(line.pos)) r += ga === 0 ? 0.6 : -0.25 * ga;
      r += gf > ga ? 0.3 : gf < ga ? -0.3 : 0;
      r -= line.yellow * 0.3 + line.red * 1.5;
      r += rng.normal() * 0.25;
      line.rating = Math.round(clamp(r, 3, 10) * 10) / 10;
    }
  }
  let mvp: MatchResult['mvp'] = null;
  for (const side of ['home', 'away'] as Side[]) {
    for (const line of lines[side].values()) {
      if (!mvp || line.rating > findRating(lines, mvp)) mvp = { side, personId: line.personId, name: line.name };
    }
  }

  return {
    seed,
    home: home.id,
    away: away.id,
    score: [score[0], score[1]],
    events,
    stats,
    players: { home: [...lines.home.values()], away: [...lines.away.values()] },
    mvp,
    stoppage,
    snapshots,
  };
}

function findRating(lines: Record<Side, Map<string, PlayerMatchLine>>, ref: { side: Side; personId: string }): number {
  return lines[ref.side].get(ref.personId)?.rating ?? 0;
}

export function formatMinute(e: Pick<MatchEvent, 'minute' | 'extra'>): string {
  return e.extra ? `${e.minute}+${e.extra}'` : `${e.minute}'`;
}

const YELLOW_TEXTS = [
  (n: string) => `Cartão amarelo para ${n}, que chegou atrasado na dividida.`,
  (n: string) => `${n} para o contra-ataque com falta e leva amarelo.`,
  (n: string) => `Amarelo! ${n} reclama demais com a arbitragem.`,
];

const GOAL_TEXTS = [
  (s: string, a: string | undefined, t: string) => (a ? `GOOOOL DO ${t}! ${a} enfia a bola e ${s} bate cruzado, sem chances para o goleiro.` : `GOOOOL DO ${t}! ${s} arranca, corta o marcador e solta a bomba!`),
  (s: string, a: string | undefined, t: string) => (a ? `GOL! Tabela entre ${a} e ${s}, que finaliza na saída do goleiro. ${t} na frente!` : `GOL! ${s} aproveita o rebote e empurra para as redes. Festa do ${t}!`),
  (s: string, a: string | undefined, t: string) => (a ? `É GOL! Cruzamento de ${a} e ${s} completa de primeira. Que pintura do ${t}!` : `É GOL! Chute de fora da área de ${s}, no ângulo! Golaço do ${t}!`),
  (s: string, a: string | undefined, t: string) => (a ? `GOOOL! ${a} encontra ${s} livre na área, que só desvia. ${t} balança a rede!` : `GOOOL! ${s} cobra falta com perfeição por cima da barreira. ${t} comemora!`),
];

const HEADER_GOAL_TEXTS = [
  (s: string, a: string | undefined, t: string) => (a ? `GOL DE CABEÇA! Escanteio de ${a} e ${s} sobe mais que todo mundo. ${t} marca!` : `GOL DE CABEÇA! ${s} testa firme após escanteio. ${t} na rede!`),
  (s: string, a: string | undefined, t: string) => (a ? `GOOOL! ${a} levanta na área e ${s} cabeceia no cantinho. Bola parada decisiva do ${t}!` : `GOOOL! Na bola parada, ${s} aparece na segunda trave e marca para o ${t}!`),
];

const SAVE_TEXTS = [
  (gk: string, s: string) => `Que defesa! ${gk} voa no canto e espalma o chute de ${s}.`,
  (gk: string, s: string) => `${s} finaliza com força, mas ${gk} segura firme.`,
  (gk: string, s: string) => `Milagre de ${gk}! Defesa à queima-roupa na finalização de ${s}.`,
];

const MISS_TEXTS = [
  (s: string) => `${s} arrisca de longe e a bola passa raspando a trave.`,
  (s: string) => `Chance clara! ${s} finaliza por cima do gol.`,
  (s: string) => `${s} tenta a colocada, mas manda para fora.`,
];
