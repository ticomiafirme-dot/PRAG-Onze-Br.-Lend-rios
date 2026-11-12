// Motor do draft: sorteio de décadas (e clubes, no modo Mistura), oferta de
// jogadores por categoria (GOL, DEF, MEI, ATA), novos sorteios limitados e
// validação das escolhas. Qualquer jogador de uma categoria pode ocupar
// qualquer vaga livre dessa categoria.

import type { Card, Decade, Position } from '../data/types';
import { POSITIONS } from '../data/types';
import { getFormation, type FormationId, type Slot } from '../data/formations';
import { canPlay, type Database } from './database';
import { canFillAll } from './matching';
import { Rng, type RngState } from './rng';

export type GameMode = 'classico' | 'era' | 'mistura' | 'diario' | 'semanal' | 'triplice';

export const DEFAULT_REROLLS = 5;
/** Quantos jogadores são oferecidos por categoria quando a década é fixa. */
export const ERA_OFFER_SIZE = 3;

export interface DraftConfig {
  mode: GameMode;
  /** Clube escolhido (null no modo Mistura). */
  clubId: string | null;
  /** Década fixa (modo Era Única / Desafio Diário); null = sorteio de décadas. */
  decade: Decade | null;
  formationId: FormationId;
  seed: number;
  rerolls: number;
}

export interface DraftDraw {
  round: number;
  clubId: string;
  decade: Decade;
  /** categoria -> chaves das cartas oferecidas para as vagas livres dela. */
  offers: Partial<Record<Position, string[]>>;
  /** true se veio de um novo sorteio pedido pelo jogador. */
  fromReroll: boolean;
}

export interface DraftHistoryEntry {
  round: number;
  clubId: string;
  decade: Decade;
  rerolls: number;
  slotId: string;
  cardKey: string;
}

export interface DraftState {
  config: DraftConfig;
  rng: RngState;
  rerollsLeft: number;
  /** slotId -> chave da carta escolhida. */
  picks: Record<string, string>;
  draw: DraftDraw | null;
  history: DraftHistoryEntry[];
  rerollsThisRound: number;
}

export function isFixedDecade(config: DraftConfig): boolean {
  return config.decade != null;
}

export function createDraft(db: Database, config: DraftConfig): DraftState {
  const state: DraftState = {
    config,
    rng: new Rng(config.seed).state(),
    rerollsLeft: config.rerolls,
    picks: {},
    draw: null,
    history: [],
    rerollsThisRound: 0,
  };
  return drawRound(db, state, false);
}

export function openSlots(state: DraftState): Slot[] {
  return getFormation(state.config.formationId).slots.filter((s) => !state.picks[s.id]);
}

export function pickedPersons(db: Database, state: DraftState): Set<string> {
  return new Set(Object.values(state.picks).map((k) => db.card(k).id));
}

export function isDraftComplete(state: DraftState): boolean {
  return openSlots(state).length === 0;
}

/** Categorias com vagas livres, na ordem GOL → DEF → MEI → ATA. */
export function openPositions(state: DraftState): Position[] {
  const open = new Set(openSlots(state).map((s) => s.pos));
  return POSITIONS.filter((p) => open.has(p));
}

/** Primeira vaga livre de uma categoria (na ordem da formação). */
export function firstOpenSlot(state: DraftState, pos: Position): Slot | null {
  return openSlots(state).find((s) => s.pos === pos) ?? null;
}

/** Cartas da (clube, década) que servem para a categoria e ainda não foram usadas. */
export function eligibleFor(db: Database, state: DraftState, clubId: string, decade: Decade, pos: Position, used?: Set<string>): Card[] {
  const taken = used ?? pickedPersons(db, state);
  return db.cards(clubId, decade).filter((c) => !taken.has(c.id) && canPlay(c, pos));
}

/** Universo de cartas possível para as próximas rodadas (para checar viabilidade). */
function remainingUniverse(db: Database, state: DraftState, taken: Set<string>): Card[] {
  const { config } = state;
  let cards: Card[];
  if (config.mode === 'mistura') {
    cards = db.clubs.flatMap((c) => db.allCardsOfClub(c.id));
  } else if (config.decade) {
    cards = db.cards(config.clubId!, config.decade);
  } else {
    cards = db.allCardsOfClub(config.clubId!);
  }
  return cards.filter((c) => !taken.has(c.id));
}

interface Candidate {
  clubId: string;
  decade: Decade;
}

function candidatePairs(db: Database, state: DraftState): Candidate[] {
  const { config } = state;
  const open = openPositions(state);
  const taken = pickedPersons(db, state);
  const pairs: Candidate[] =
    config.mode === 'mistura'
      ? db.clubs.flatMap((c) => db.decadesOf(c.id).map((d) => ({ clubId: c.id, decade: d })))
      : config.decade
        ? [{ clubId: config.clubId!, decade: config.decade }]
        : db.decadesOf(config.clubId!).map((d) => ({ clubId: config.clubId!, decade: d }));
  return pairs.filter((p) => open.some((pos) => eligibleFor(db, state, p.clubId, p.decade, pos, taken).length > 0));
}

/**
 * Ofertas de um (clube, década) para cada categoria com vaga livre: jogadores
 * inéditos da categoria cuja escolha ainda permite completar as demais vagas.
 */
function buildOffers(db: Database, state: DraftState, cand: Candidate, rng: Rng): Partial<Record<Position, string[]>> {
  const open = openSlots(state);
  const taken = pickedPersons(db, state);
  const universe = remainingUniverse(db, state, taken);
  // a escolha ocupa uma vaga da categoria; as demais vagas ainda precisam ter opções
  const feasible = (card: Card, pos: Position): boolean => {
    const slot = open.find((s) => s.pos === pos)!;
    const rest = open.filter((s) => s.id !== slot.id);
    if (rest.length === 0) return true;
    return canFillAll(
      rest,
      universe.filter((c) => c.id !== card.id),
    );
  };
  const offers: Partial<Record<Position, string[]>> = {};
  for (const pos of openPositions(state)) {
    let cards = eligibleFor(db, state, cand.clubId, cand.decade, pos, taken).filter((c) => feasible(c, pos));
    if (state.config.decade) {
      // Década fixa: a aleatoriedade está em QUAIS jogadores aparecem.
      cards = rng.shuffle(cards).slice(0, ERA_OFFER_SIZE).sort((a, b) => b.overall - a.overall);
    }
    if (cards.length) offers[pos] = cards.map((c) => c.key);
  }
  return offers;
}

/** As vagas livres ainda podem ser preenchidas com o que resta da base? */
export function isDraftViable(db: Database, state: DraftState): boolean {
  const open = openSlots(state);
  return open.length === 0 || canFillAll(open, remainingUniverse(db, state, pickedPersons(db, state)));
}

/**
 * Recalcula as ofertas do sorteio atual mantendo clube e década (usado ao
 * carregar progresso salvo por versões anteriores). Sem ofertas, sorteia de novo.
 */
export function refreshDraw(db: Database, state: DraftState): DraftState {
  if (isDraftComplete(state)) return { ...state, draw: null };
  if (!state.draw) return drawRound(db, state, false);
  const rng = new Rng(state.rng);
  const offers = buildOffers(db, state, { clubId: state.draw.clubId, decade: state.draw.decade }, rng);
  if (Object.keys(offers).length === 0) return drawRound(db, { ...state, draw: null }, false);
  return { ...state, rng: rng.state(), draw: { ...state.draw, round: Object.keys(state.picks).length + 1, offers } };
}

/** Sorteia a próxima rodada (ou refaz o sorteio, se `reroll`). */
export function drawRound(db: Database, state: DraftState, reroll: boolean): DraftState {
  const open = openSlots(state);
  if (open.length === 0) return { ...state, draw: null };
  const rng = new Rng(state.rng);
  const { config } = state;
  let pairs = candidatePairs(db, state);
  if (pairs.length === 0) {
    // Sem jogadores elegíveis: não deveria ocorrer com a base validada.
    return { ...state, draw: null };
  }
  // Num novo sorteio, evita repetir exatamente a mesma década/clube quando houver alternativa.
  if (reroll && state.draw && !config.decade) {
    const others = pairs.filter((p) => !(p.clubId === state.draw!.clubId && p.decade === state.draw!.decade));
    if (others.length > 0) pairs = others;
  }
  let chosen: Candidate | null = null;
  let offers: Partial<Record<Position, string[]>> = {};
  while (pairs.length > 0) {
    let cand: Candidate;
    if (config.mode === 'mistura') {
      // primeiro o clube (uniforme), depois a década daquele clube
      const clubs = [...new Set(pairs.map((p) => p.clubId))];
      const clubId = rng.pick(clubs);
      cand = rng.pick(pairs.filter((p) => p.clubId === clubId));
    } else {
      cand = rng.pick(pairs);
    }
    offers = buildOffers(db, state, cand, rng);
    if (Object.keys(offers).length > 0) {
      chosen = cand;
      break;
    }
    pairs = pairs.filter((p) => p !== cand);
  }
  if (!chosen) return { ...state, rng: rng.state(), draw: null };
  const round = Object.keys(state.picks).length + 1;
  return {
    ...state,
    rng: rng.state(),
    draw: { round, clubId: chosen.clubId, decade: chosen.decade, offers, fromReroll: reroll },
    rerollsThisRound: reroll ? state.rerollsThisRound : 0,
  };
}

export function reroll(db: Database, state: DraftState): DraftState {
  if (state.rerollsLeft <= 0 || !state.draw) return state;
  const next = { ...state, rerollsLeft: state.rerollsLeft - 1, rerollsThisRound: state.rerollsThisRound + 1 };
  return drawRound(db, next, true);
}

export type PickCheck = { ok: true } | { ok: false; reason: string };

/** Valida uma escolha: vaga livre, carta ofertada para a categoria, pessoa inédita e viabilidade do restante. */
export function checkPick(db: Database, state: DraftState, cardKey: string, slotId: string): PickCheck {
  const draw = state.draw;
  if (!draw) return { ok: false, reason: 'Não há sorteio ativo.' };
  const slot = getFormation(state.config.formationId).slots.find((s) => s.id === slotId);
  if (!slot) return { ok: false, reason: 'Vaga inexistente.' };
  if (state.picks[slotId]) return { ok: false, reason: 'Essa vaga já está preenchida.' };
  if (!draw.offers[slot.pos]?.includes(cardKey)) return { ok: false, reason: 'Jogador não disponível para essa categoria neste sorteio.' };
  const card = db.card(cardKey);
  if (!canPlay(card, slot.pos)) return { ok: false, reason: `${card.player.name} não é da categoria ${slot.pos}.` };
  const taken = pickedPersons(db, state);
  if (taken.has(card.id)) return { ok: false, reason: `${card.player.name} já está no seu time.` };
  // Viabilidade: as posições restantes ainda podem ser preenchidas?
  taken.add(card.id);
  const rest = openSlots(state).filter((s) => s.id !== slotId);
  if (rest.length && !canFillAll(rest, remainingUniverse(db, state, taken))) {
    return { ok: false, reason: 'Essa escolha deixaria alguma posição sem opções possíveis no restante do draft.' };
  }
  return { ok: true };
}

export function pick(db: Database, state: DraftState, cardKey: string, slotId: string): DraftState {
  const check = checkPick(db, state, cardKey, slotId);
  if (!check.ok) throw new Error(check.reason);
  const draw = state.draw!;
  const next: DraftState = {
    ...state,
    picks: { ...state.picks, [slotId]: cardKey },
    history: [
      ...state.history,
      { round: draw.round, clubId: draw.clubId, decade: draw.decade, rerolls: state.rerollsThisRound, slotId, cardKey },
    ],
    draw: null,
    rerollsThisRound: 0,
  };
  return drawRound(db, next, false);
}

/** Categorias com vagas livres e ofertas no sorteio atual (GOL → DEF → MEI → ATA). */
export function positionsWithOffers(state: DraftState): Position[] {
  if (!state.draw) return [];
  return openPositions(state).filter((p) => (state.draw!.offers[p]?.length ?? 0) > 0);
}

/** Vagas livres cuja categoria tem oferta no sorteio atual. */
export function slotsWithOffers(state: DraftState): Slot[] {
  const pos = new Set(positionsWithOffers(state));
  return openSlots(state).filter((s) => pos.has(s.pos));
}

/** Formações viáveis para uma década fixa (todas as vagas preenchíveis). */
export function feasibleFormationsForDecade(db: Database, clubId: string, decade: Decade, formations: FormationId[]): FormationId[] {
  const cards = db.cards(clubId, decade);
  return formations.filter((f) => canFillAll(getFormation(f).slots, cards));
}

export function feasibleFormationsForClub(db: Database, clubId: string, formations: FormationId[]): FormationId[] {
  const cards = db.allCardsOfClub(clubId);
  return formations.filter((f) => canFillAll(getFormation(f).slots, cards));
}
