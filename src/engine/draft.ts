// Motor do draft: sorteio de décadas (e clubes, no modo Mistura), oferta de
// jogadores por posição, novos sorteios limitados e validação das escolhas.

import type { Card, Decade } from '../data/types';
import { getFormation, type FormationId, type Slot } from '../data/formations';
import { canPlay, type Database } from './database';
import { canFillAll } from './matching';
import { Rng, type RngState } from './rng';

export type GameMode = 'classico' | 'era' | 'mistura' | 'diario' | 'semanal' | 'triplice';

export const DEFAULT_REROLLS = 5;
/** Quantos jogadores são oferecidos por posição quando a década é fixa. */
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
  /** slotId -> chaves das cartas oferecidas para aquela posição. */
  offers: Record<string, string[]>;
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

/** Cartas da (clube, década) que servem para a posição e ainda não foram usadas. */
export function eligibleFor(db: Database, state: DraftState, clubId: string, decade: Decade, slot: Slot, used?: Set<string>): Card[] {
  const taken = used ?? pickedPersons(db, state);
  return db.cards(clubId, decade).filter((c) => !taken.has(c.id) && canPlay(c, slot.pos));
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
  const open = openSlots(state);
  const taken = pickedPersons(db, state);
  const pairs: Candidate[] =
    config.mode === 'mistura'
      ? db.clubs.flatMap((c) => db.decadesOf(c.id).map((d) => ({ clubId: c.id, decade: d })))
      : config.decade
        ? [{ clubId: config.clubId!, decade: config.decade }]
        : db.decadesOf(config.clubId!).map((d) => ({ clubId: config.clubId!, decade: d }));
  return pairs.filter((p) => open.some((s) => eligibleFor(db, state, p.clubId, p.decade, s, taken).length > 0));
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
  const taken = pickedPersons(db, state);
  const universe = remainingUniverse(db, state, taken);
  const feasible = (card: Card, slot: Slot): boolean => {
    const rest = open.filter((s) => s.id !== slot.id);
    if (rest.length === 0) return true;
    return canFillAll(
      rest,
      universe.filter((c) => c.id !== card.id),
    );
  };

  let chosen: Candidate | null = null;
  let offers: Record<string, string[]> = {};
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
    offers = {};
    for (const slot of open) {
      let cards = eligibleFor(db, state, cand.clubId, cand.decade, slot, taken).filter((c) => feasible(c, slot));
      if (config.decade) {
        // Década fixa: a aleatoriedade está em QUAIS jogadores aparecem.
        cards = rng.shuffle(cards).slice(0, ERA_OFFER_SIZE).sort((a, b) => b.overall - a.overall);
      }
      if (cards.length) offers[slot.id] = cards.map((c) => c.key);
    }
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

/** Valida uma escolha: posição aberta, carta ofertada, pessoa inédita e viabilidade do restante. */
export function checkPick(db: Database, state: DraftState, cardKey: string, slotId: string): PickCheck {
  const draw = state.draw;
  if (!draw) return { ok: false, reason: 'Não há sorteio ativo.' };
  const slot = getFormation(state.config.formationId).slots.find((s) => s.id === slotId);
  if (!slot) return { ok: false, reason: 'Posição inexistente.' };
  if (state.picks[slotId]) return { ok: false, reason: 'Essa posição já está preenchida.' };
  if (!draw.offers[slotId]?.includes(cardKey)) return { ok: false, reason: 'Jogador não disponível para essa posição neste sorteio.' };
  const card = db.card(cardKey);
  if (!canPlay(card, slot.pos)) return { ok: false, reason: `${card.player.name} não atua como ${slot.pos}.` };
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

/** Slots abertos que têm oferta no sorteio atual, na ordem da formação (goleiro → ataque). */
export function slotsWithOffers(state: DraftState): Slot[] {
  if (!state.draw) return [];
  return openSlots(state).filter((s) => (state.draw!.offers[s.id]?.length ?? 0) > 0);
}

/** Formações viáveis para uma década fixa (todas as posições preenchíveis). */
export function feasibleFormationsForDecade(db: Database, clubId: string, decade: Decade, formations: FormationId[]): FormationId[] {
  const cards = db.cards(clubId, decade);
  return formations.filter((f) => canFillAll(getFormation(f).slots, cards));
}

export function feasibleFormationsForClub(db: Database, clubId: string, formations: FormationId[]): FormationId[] {
  const cards = db.allCardsOfClub(clubId);
  return formations.filter((f) => canFillAll(getFormation(f).slots, cards));
}
