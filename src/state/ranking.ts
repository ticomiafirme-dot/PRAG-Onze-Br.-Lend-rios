// Monta a entrada de ranking de uma campanha encerrada.
import { db } from '../data/db';
import { summarize, USER_ID } from '../engine/campaign';
import { addRankingEntry, loadPlayerName, type RankingEntry } from './storage';
import { MODE_INFO } from './modes';
import { submitShared } from './sharedRanking';
import type { Run } from './store';

export function buildRankingEntry(run: Run, playerName = loadPlayerName()): RankingEntry | null {
  const c = run.campaign;
  if (!c?.finished || !run.captainSlot || !run.draft) return null;
  const s = summarize(c);
  const user = c.teams[USER_ID];
  const captain = db.card(run.draft.picks[run.captainSlot]);
  return {
    id: run.id,
    date: new Date().toISOString(),
    mode: run.mode,
    modeLabel: MODE_INFO[run.mode].name,
    challengeKey: run.challenge?.key ?? null,
    clubId: run.clubId,
    teamName: user.name,
    formationId: run.formationId!,
    difficulty: run.difficulty,
    points: s.points,
    wins: s.wins,
    draws: s.draws,
    losses: s.losses,
    gf: s.gf,
    ga: s.ga,
    position: s.position,
    perfect: s.perfect,
    champion: s.champion,
    triple: s.triple,
    overall: user.ratings.overall,
    chem: user.chem,
    captain: captain.player.name,
    playerName: playerName || 'Anônimo',
  };
}

/** Registra a campanha no ranking local e, quando disponível, no compartilhado
 *  (idempotente: a mesma partida substitui o registro anterior). */
export function recordRanking(run: Run, playerName?: string, opts: { shared?: boolean } = { shared: true }): void {
  const entry = buildRankingEntry(run, playerName);
  if (!entry) return;
  addRankingEntry(entry);
  if (opts.shared) void submitShared(entry);
}
