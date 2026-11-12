// Montagem das fichas de time (usuário e IA) e cálculo das forças por setor.

import type { Card, Decade, Position, Role } from '../data/types';
import { decadeLabel, toPosition } from '../data/types';
import { FORMATIONS, getFormation, type FormationId } from '../data/formations';
import type { Database } from './database';
import { CAPTAIN_BONUS, computeChemistry } from './chemistry';
import { bestLineup } from './matching';
import type { Rng } from './rng';

export interface TeamPlayer {
  slotId: string;
  /** Categoria da vaga ocupada (GOL, DEF, MEI, ATA). */
  pos: Position;
  /** Função histórica do atleta; só dá nuances à simulação, não restringe nada. */
  role?: Role;
  cardKey: string;
  personId: string;
  name: string;
  number: number;
  base: number;
  eff: number;
  nationality: string;
  decade: Decade;
  club: string;
  captain: boolean;
}

export interface TeamRatings {
  overall: number;
  attack: number;
  midfield: number;
  defense: number;
  goalkeeping: number;
}

export interface TeamSheet {
  id: string;
  name: string;
  /** Rótulo da época/escalação (ex.: "Anos 80" ou "Seleção histórica"). */
  label: string;
  clubId: string | null;
  short: string;
  colors: { primary: string; secondary: string; accent: string };
  formationId: FormationId;
  players: TeamPlayer[];
  chem: number;
  ratings: TeamRatings;
  isUser: boolean;
}

export type Difficulty = 'normal' | 'dificil' | 'lendario';

/** Ajuste de força dos rivais por dificuldade (aplicado ao overall efetivo). */
export const DIFFICULTY_OFFSET: Record<Difficulty, number> = { normal: -6, dificil: -3, lendario: -1 };

export const DIFFICULTIES: { id: Difficulty; name: string; description: string }[] = [
  { id: 'normal', name: 'Normal', description: 'Rivais escalam o melhor time de uma década sorteada de sua história.' },
  { id: 'dificil', name: 'Difícil', description: 'Rivais escalam o melhor time da década mais forte entre duas sorteadas.' },
  { id: 'lendario', name: 'Lendário', description: 'Rivais entram com a seleção de todos os tempos do clube. Só para os fortes.' },
];

/** Números de camisa: o sugerido pela vaga; se repetido, o próximo livre. */
export function assignNumbers(slots: { id: string; num?: number }[]): Record<string, number> {
  const used = new Set<number>();
  const out: Record<string, number> = {};
  for (const s of slots) {
    let n = s.num && !used.has(s.num) ? s.num : 0;
    if (!n) n = [...Array(40).keys()].map((i) => i + 1).find((x) => !used.has(x))!;
    used.add(n);
    out[s.id] = n;
  }
  return out;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round1 = (x: number) => Math.round(x * 10) / 10;

/** Forças por setor a partir dos overalls efetivos, formação e química. */
export function computeRatings(players: TeamPlayer[], formationId: FormationId, chem: number): TeamRatings {
  const style = getFormation(formationId).style;
  const byLine = (line: Position) => players.filter((p) => toPosition(p.pos) === line).map((p) => p.eff);
  // nuance: no meio-campo, volantes reforçam a defesa e meias reforçam o ataque
  const midByRole = (...roles: Role[]) => players.filter((p) => toPosition(p.pos) === 'MEI' && p.role && roles.includes(p.role)).map((p) => p.eff);
  const gk = avg(byLine('GOL'));
  const def = avg(byLine('DEF'));
  const mid = avg(byLine('MEI'));
  const att = avg(byLine('ATA'));
  const vol = midByRole('VOL').length ? avg(midByRole('VOL')) : mid;
  const mei = midByRole('MEI').length ? avg(midByRole('MEI')) : mid;
  // Química: entrosamento coletivo de −2,5 a +2,5 pontos
  const cohesion = (chem - 50) / 20;
  return {
    overall: Math.round(avg(players.map((p) => p.eff))),
    attack: round1(att * 0.78 + mei * 0.22 + style.attack + cohesion),
    midfield: round1(mid + style.midfield + cohesion),
    defense: round1(def * 0.8 + vol * 0.2 + style.defense + cohesion),
    goalkeeping: round1(gk + cohesion * 0.5),
  };
}

/** Constrói a ficha de um time a partir de uma escalação (slot -> carta). */
export function buildSheet(
  db: Database,
  opts: {
    id: string;
    name: string;
    label: string;
    clubId: string | null;
    short: string;
    colors: TeamSheet['colors'];
    formationId: FormationId;
    lineup: Record<string, Card>;
    captainSlot: string | null;
    isUser: boolean;
    ratingOffset?: number;
  },
): TeamSheet {
  const formation = getFormation(opts.formationId);
  const chem = computeChemistry(db, opts.formationId, opts.lineup, opts.captainSlot);
  const numbers = assignNumbers(formation.slots);
  const players: TeamPlayer[] = formation.slots
    .filter((s) => opts.lineup[s.id])
    .map((s) => {
      const c = opts.lineup[s.id];
      const captain = opts.captainSlot === s.id;
      const eff = Math.min(99, c.overall + (captain ? CAPTAIN_BONUS : 0) + (chem.bonus[s.id] ?? 0) + (opts.ratingOffset ?? 0));
      return {
        slotId: s.id,
        pos: s.pos,
        role: c.player.position,
        cardKey: c.key,
        personId: c.id,
        name: c.player.name,
        number: numbers[s.id],
        base: c.overall,
        eff,
        nationality: c.player.nationality,
        decade: c.decade,
        club: c.club,
        captain,
      };
    });
  return {
    id: opts.id,
    name: opts.name,
    label: opts.label,
    clubId: opts.clubId,
    short: opts.short,
    colors: opts.colors,
    formationId: opts.formationId,
    players,
    chem: chem.team,
    ratings: computeRatings(players, opts.formationId, chem.team),
    isUser: opts.isUser,
  };
}

const AI_FORMATIONS: FormationId[] = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '4-1-4-1'];

function lineupScore(lineup: Record<string, Card>, slots: number): number {
  const vals = Object.values(lineup);
  return vals.reduce((a, c) => a + c.overall, 0) - (slots - vals.length) * 60;
}

/** Melhor escalação de um conjunto de cartas, escolhendo também a formação. */
function bestOf(db: Database, clubId: string, cards: Card[]): { formationId: FormationId; lineup: Record<string, Card> } {
  let best: { formationId: FormationId; lineup: Record<string, Card>; score: number } | null = null;
  for (const f of AI_FORMATIONS) {
    const slots = getFormation(f).slots;
    const lineup = bestLineup(slots, cards);
    // completa posições faltantes com jogadores de outras décadas do próprio clube
    const missing = slots.filter((s) => !lineup[s.id]);
    if (missing.length) {
      const used = new Set(Object.values(lineup).map((c) => c.id));
      const extra = db.allCardsOfClub(clubId).filter((c) => !used.has(c.id));
      const fill = bestLineup(missing, extra);
      Object.assign(lineup, fill);
    }
    const score = lineupScore(lineup, slots.length);
    if (!best || score > best.score) best = { formationId: f, lineup, score };
  }
  return { formationId: best!.formationId, lineup: best!.lineup };
}

function captainOf(lineup: Record<string, Card>): string | null {
  let bestSlot: string | null = null;
  let bestOvr = -1;
  for (const [slot, c] of Object.entries(lineup)) {
    if (c.overall > bestOvr) {
      bestOvr = c.overall;
      bestSlot = slot;
    }
  }
  return bestSlot;
}

/** Time controlado pela IA, montado com jogadores históricos do próprio clube. */
export function buildAiTeam(db: Database, clubId: string, rng: Rng, difficulty: Difficulty, excludePersons: Set<string> = new Set()): TeamSheet {
  const club = db.club(clubId);
  const decades = db.decadesOf(clubId);
  let cards: Card[];
  let label: string;
  if (difficulty === 'lendario' || decades.length === 0) {
    cards = db.allCardsOfClub(clubId);
    label = 'Seleção histórica';
  } else {
    const pickDecade = (): Decade => rng.pick(decades);
    let d = pickDecade();
    if (difficulty === 'dificil' && decades.length > 1) {
      const d2 = pickDecade();
      const score = (x: Decade) => {
        const lineup = bestOf(db, clubId, db.cards(clubId, x).filter((c) => !excludePersons.has(c.id))).lineup;
        return lineupScore(lineup, 11);
      };
      if (score(d2) > score(d)) d = d2;
    }
    cards = db.cards(clubId, d);
    label = decadeLabel(d);
  }
  cards = cards.filter((c) => !excludePersons.has(c.id));
  const { formationId, lineup } = bestOf(db, clubId, cards);
  return buildSheet(db, {
    id: clubId,
    name: club.name,
    label,
    clubId,
    short: club.short,
    colors: club.colors,
    formationId,
    lineup,
    captainSlot: captainOf(lineup),
    isUser: false,
    ratingOffset: DIFFICULTY_OFFSET[difficulty],
  });
}

export const ALL_FORMATION_IDS: FormationId[] = FORMATIONS.map((f) => f.id);
