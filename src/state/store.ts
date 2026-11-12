// Estado do jogo: a partida em andamento (run) e as preferências.
// Persistido no localStorage para que o jogador possa continuar depois.

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { CLUBS, CLUB_BY_ID } from '../data/clubs';
import { db, LEAGUE_CLUBS } from '../data/db';
import type { Card, Decade } from '../data/types';
import { getFormation, type FormationId } from '../data/formations';
import { canPlay } from '../engine/database';
import {
  createDraft,
  DEFAULT_REROLLS,
  isDraftComplete,
  pick as draftPick,
  reroll as draftReroll,
  type DraftState,
  type GameMode,
} from '../engine/draft';
import { buildSheet, type Difficulty, type TeamSheet } from '../engine/team';
import { createCampaign, playDay, simulateRest, USER_ID, type Campaign } from '../engine/campaign';
import type { MatchResult } from '../engine/match';
import { dailyChallenge, weeklyChallenge, type ChallengeConfig } from '../engine/challenges';
import { Rng, randomSeed, subSeed } from '../engine/rng';
import { markChallenge, STORAGE_PREFIX } from './storage';
import { recordRanking } from './ranking';

export type Phase = 'setup' | 'draft' | 'lineup' | 'captain' | 'preseason' | 'season' | 'finished';

export interface Run {
  id: string;
  mode: GameMode;
  clubId: string | null;
  decade: Decade | null;
  formationId: FormationId | null;
  difficulty: Difficulty;
  seed: number;
  challenge: ChallengeConfig | null;
  draft: DraftState | null;
  captainSlot: string | null;
  campaign: Campaign | null;
  phase: Phase;
  createdAt: string;
  rankingSaved: boolean;
}

export interface Settings {
  speed: 1 | 2 | 4;
  difficulty: Difficulty;
}

export { MODE_INFO } from './modes';

interface GameState {
  run: Run | null;
  settings: Settings;
  startMode: (mode: GameMode) => string;
  chooseClub: (clubId: string) => void;
  chooseDecade: (decade: Decade | null) => void;
  chooseFormation: (formationId: FormationId) => void;
  chooseDifficulty: (d: Difficulty) => void;
  startDraft: () => void;
  reroll: () => void;
  pickCard: (cardKey: string, slotId: string) => void;
  swapSlots: (a: string, b: string) => boolean;
  confirmLineup: () => void;
  setCaptain: (slotId: string) => void;
  confirmCaptain: () => void;
  startSeason: () => void;
  completeUserMatch: (result: MatchResult) => void;
  simulateDay: () => void;
  simulateAll: () => void;
  markRankingSaved: () => void;
  abandon: () => void;
  setSpeed: (s: 1 | 2 | 4) => void;
}

/** Ao terminar a temporada: marca o desafio como concluído e grava no ranking. */
function onFinished(run: Run): Run {
  if (run.challenge) markChallenge(run.challenge.key, true);
  recordRanking(run);
  return { ...run, rankingSaved: true };
}

const newId = () => `${Date.now().toString(36)}-${randomSeed().toString(36)}`;

function baseRun(mode: GameMode, difficulty: Difficulty): Run {
  return {
    id: newId(),
    mode,
    clubId: null,
    decade: null,
    formationId: null,
    difficulty,
    seed: randomSeed(),
    challenge: null,
    draft: null,
    captainSlot: null,
    campaign: null,
    phase: 'setup',
    createdAt: new Date().toISOString(),
    rankingSaved: false,
  };
}

export function lineupOf(run: Run | null): Record<string, Card> {
  if (!run?.draft) return {};
  return Object.fromEntries(Object.entries(run.draft.picks).map(([slot, key]) => [slot, db.card(key)]));
}

export function teamIdentity(run: Run): { name: string; short: string; colors: TeamSheet['colors'] } {
  if (run.clubId) {
    const c = CLUB_BY_ID[run.clubId];
    return { name: c.name, short: c.short, colors: c.colors };
  }
  return { name: 'Mistura Brasileira', short: 'MIX', colors: { primary: '#1a4fb5', secondary: '#ffcf1f', accent: '#ffffff' } };
}

export function userSheet(run: Run): TeamSheet {
  const id = teamIdentity(run);
  return buildSheet(db, {
    id: USER_ID,
    name: id.name,
    label: 'Seu Onze Lendário',
    clubId: run.clubId,
    short: id.short,
    colors: id.colors,
    formationId: run.formationId!,
    lineup: lineupOf(run),
    captainSlot: run.captainSlot,
    isUser: true,
  });
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      run: null,
      settings: { speed: 1, difficulty: 'normal' },

      startMode: (mode) => {
        const difficulty = get().settings.difficulty;
        if (mode === 'diario' || mode === 'semanal') {
          const ids = LEAGUE_CLUBS.map((c) => c.id);
          const ch = mode === 'diario' ? dailyChallenge(db, ids) : weeklyChallenge(ids);
          const run: Run = {
            ...baseRun(mode, ch.difficulty),
            clubId: ch.clubId,
            decade: ch.decade,
            formationId: ch.formationId,
            seed: ch.seed,
            challenge: ch,
          };
          run.draft = createDraft(db, { mode, clubId: ch.clubId, decade: ch.decade, formationId: ch.formationId, seed: ch.seed, rerolls: DEFAULT_REROLLS });
          run.phase = 'draft';
          markChallenge(ch.key, false);
          set({ run });
          return '/draft';
        }
        set({ run: baseRun(mode, difficulty) });
        return mode === 'mistura' ? '/formacao' : '/clubes';
      },

      chooseClub: (clubId) => {
        const run = get().run ?? baseRun('classico', get().settings.difficulty);
        set({ run: { ...run, clubId, decade: null, formationId: null, draft: null, phase: 'setup' } });
      },

      chooseDecade: (decade) => {
        const run = get().run;
        if (!run) return;
        let mode = run.mode;
        if (mode === 'classico' && decade) mode = 'era';
        if (mode === 'era' && !decade) mode = 'classico';
        set({ run: { ...run, decade, mode, formationId: null } });
      },

      chooseFormation: (formationId) => {
        const run = get().run;
        if (!run) return;
        set({ run: { ...run, formationId } });
      },

      chooseDifficulty: (d) => {
        const run = get().run;
        set({ settings: { ...get().settings, difficulty: d }, run: run && !run.challenge ? { ...run, difficulty: d } : run });
      },

      startDraft: () => {
        const run = get().run;
        if (!run || !run.formationId) return;
        const seed = randomSeed();
        const draft = createDraft(db, {
          mode: run.mode,
          clubId: run.mode === 'mistura' ? null : run.clubId,
          decade: run.decade,
          formationId: run.formationId,
          seed,
          rerolls: DEFAULT_REROLLS,
        });
        set({ run: { ...run, seed, draft, captainSlot: null, campaign: null, phase: 'draft' } });
      },

      reroll: () => {
        const run = get().run;
        if (!run?.draft) return;
        set({ run: { ...run, draft: draftReroll(db, run.draft) } });
      },

      pickCard: (cardKey, slotId) => {
        const run = get().run;
        if (!run?.draft) return;
        const draft = draftPick(db, run.draft, cardKey, slotId);
        const complete = isDraftComplete(draft);
        set({ run: { ...run, draft, phase: complete ? 'lineup' : 'draft' } });
      },

      swapSlots: (a, b) => {
        const run = get().run;
        if (!run?.draft || !run.formationId) return false;
        const slots = getFormation(run.formationId).slots;
        const sa = slots.find((s) => s.id === a);
        const sb = slots.find((s) => s.id === b);
        const ka = run.draft.picks[a];
        const kb = run.draft.picks[b];
        if (!sa || !sb || !ka || !kb) return false;
        if (!canPlay(db.card(ka), sb.pos) || !canPlay(db.card(kb), sa.pos)) return false;
        const picks = { ...run.draft.picks, [a]: kb, [b]: ka };
        const captainSlot = run.captainSlot === a ? b : run.captainSlot === b ? a : run.captainSlot;
        set({ run: { ...run, draft: { ...run.draft, picks }, captainSlot } });
        return true;
      },

      confirmLineup: () => {
        const run = get().run;
        if (!run) return;
        set({ run: { ...run, phase: 'captain' } });
      },

      setCaptain: (slotId) => {
        const run = get().run;
        if (!run || run.campaign) return;
        set({ run: { ...run, captainSlot: slotId } });
      },

      confirmCaptain: () => {
        const run = get().run;
        if (!run?.captainSlot) return;
        set({ run: { ...run, phase: 'preseason' } });
      },

      startSeason: () => {
        const run = get().run;
        if (!run?.draft || !run.captainSlot || !run.formationId) return;
        const user = userSheet(run);
        const rng = new Rng(subSeed(run.seed, 'liga'));
        const userClub = run.clubId ? CLUB_BY_ID[run.clubId] : null;
        const others = rng.shuffle(LEAGUE_CLUBS.filter((c) => c.id !== run.clubId));
        const triple = run.mode === 'triplice';
        const stateClubs = triple && userClub ? CLUBS.filter((c) => c.state === userClub.state) : [];
        const campaign = createCampaign({
          db,
          mode: run.mode,
          difficulty: run.difficulty,
          seed: run.seed,
          user,
          userClubId: run.clubId,
          leagueClubs: others.slice(0, 19),
          triple,
          stateClubs,
          stateCupName: userClub?.stateCup ?? 'Estadual',
        });
        set({ run: { ...run, campaign, phase: 'season' } });
      },

      completeUserMatch: (result) => {
        const run = get().run;
        if (!run?.campaign) return;
        const campaign = playDay(run.campaign, result);
        const next: Run = { ...run, campaign, phase: campaign.finished ? 'finished' : 'season' };
        set({ run: campaign.finished ? onFinished(next) : next });
      },

      simulateDay: () => {
        const run = get().run;
        if (!run?.campaign) return;
        const campaign = playDay(run.campaign);
        const next: Run = { ...run, campaign, phase: campaign.finished ? 'finished' : 'season' };
        set({ run: campaign.finished ? onFinished(next) : next });
      },

      simulateAll: () => {
        const run = get().run;
        if (!run?.campaign) return;
        const campaign = simulateRest(run.campaign);
        set({ run: onFinished({ ...run, campaign, phase: 'finished' }) });
      },

      markRankingSaved: () => {
        const run = get().run;
        if (run) set({ run: { ...run, rankingSaved: true } });
      },

      abandon: () => set({ run: null }),

      setSpeed: (speed) => set({ settings: { ...get().settings, speed } }),
    }),
    {
      name: `${STORAGE_PREFIX}:state`,
      version: 1,
      storage: createJSONStorage(() => {
        try {
          const k = '__obl_test__';
          localStorage.setItem(k, '1');
          localStorage.removeItem(k);
          return localStorage;
        } catch {
          const mem = new Map<string, string>();
          return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) };
        }
      }),
    },
  ),
);

/** Rota adequada para retomar a partida salva. */
export function resumeRoute(run: Run | null): string {
  if (!run) return '/';
  switch (run.phase) {
    case 'setup':
      if (!run.clubId && run.mode !== 'mistura') return '/clubes';
      if (!run.formationId) return run.mode === 'mistura' ? '/formacao' : `/clube/${run.clubId}`;
      return '/formacao';
    case 'draft':
      return '/draft';
    case 'lineup':
      return '/escalacao';
    case 'captain':
      return '/capitao';
    case 'preseason':
      return '/pre-temporada';
    case 'season':
      return '/campeonato';
    case 'finished':
      return '/resultado';
  }
}
