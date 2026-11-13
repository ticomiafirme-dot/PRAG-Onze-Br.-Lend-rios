// Migração do progresso salvo por versões anteriores.
// v1 → v2: as posições detalhadas (LD, ZAG, VOL, PE, CA...) viraram 4 categorias
// (GOL, DEF, MEI, ATA). Overalls, clubes, décadas e química não mudam; só o
// rótulo das vagas e as ofertas do draft.

import { db } from '../data/db';
import { getFormation, type Slot } from '../data/formations';
import { ROLES, toPosition, type Role } from '../data/types';
import { canPlay } from '../engine/database';
import { isDraftComplete, isDraftViable, refreshDraw, type DraftState } from '../engine/draft';
import { bestLineup } from '../engine/matching';
import type { Campaign } from '../engine/campaign';
import type { TeamSheet } from '../engine/team';
import type { Run } from './store';

/**
 * Recoloca as escolhas nas vagas pela categoria: quem já serve na vaga fica;
 * quem não serve vai para uma vaga livre que aceite sua categoria. Se ainda
 * sobrar alguém (ex.: laterais num 3-5-2, cujas alas agora são do meio-campo),
 * reorganiza pelo emparelhamento máximo e devolve os que não couberem.
 */
export function repairPicks(slots: Slot[], picks: Record<string, string>): { picks: Record<string, string>; dropped: string[] } {
  const known = Object.entries(picks).filter(([, k]) => !!db.cardMaybe(k));
  const unknown = Object.values(picks).filter((k) => !db.cardMaybe(k));
  const out: Record<string, string> = {};
  const pending: string[] = [];
  for (const [slotId, key] of known) {
    const slot = slots.find((s) => s.id === slotId);
    if (slot && canPlay(db.card(key), slot.pos)) out[slotId] = key;
    else pending.push(key);
  }
  const stuck: string[] = [];
  for (const key of pending) {
    const free = slots.find((s) => !out[s.id] && canPlay(db.card(key), s.pos));
    if (free) out[free.id] = key;
    else stuck.push(key);
  }
  if (stuck.length) {
    const cards = known.map(([, k]) => db.card(k));
    const best = Object.fromEntries(Object.entries(bestLineup(slots, cards)).map(([s, c]) => [s, c.key]));
    if (Object.keys(best).length > Object.keys(out).length) {
      const kept = new Set(Object.values(best));
      return { picks: best, dropped: [...unknown, ...cards.filter((c) => !kept.has(c.key)).map((c) => c.key)] };
    }
  }
  return { picks: out, dropped: [...unknown, ...stuck] };
}

function migrateDraft(run: Run): Run | null {
  const draft = run.draft!;
  const slots = getFormation(draft.config.formationId).slots;
  const { picks, dropped } = repairPicks(slots, draft.picks);
  // o capitão continua sendo o mesmo jogador, onde quer que ele esteja agora
  const captainKey = run.captainSlot ? draft.picks[run.captainSlot] : null;
  const captainSlot = captainKey ? (Object.entries(picks).find(([, k]) => k === captainKey)?.[0] ?? null) : null;
  const history = dropped.length ? draft.history.filter((h) => !dropped.includes(h.cardKey)) : draft.history;
  // ofertas antigas eram por vaga; agora são por categoria (mesmo clube e década)
  let next: DraftState = { ...draft, picks, history, draw: draft.draw ? { ...draft.draw, offers: {} } : null };
  if (!isDraftViable(db, next)) return null;
  next = isDraftComplete(next) ? { ...next, draw: null } : refreshDraw(db, next);
  const complete = isDraftComplete(next);
  if (!complete && !next.draw) return null;
  // quem precisou sair do time volta a ser escolhido no draft
  const phase = complete ? (run.phase === 'draft' ? 'lineup' : run.phase) : 'draft';
  return { ...run, draft: next, captainSlot, phase };
}

const isRole = (x: string): x is Role => (ROLES as string[]).includes(x);

/**
 * Fichas de times de uma temporada já iniciada: a vaga passa a guardar a
 * categoria e a função antiga vira o "jeito" do jogador na simulação, para
 * que o restante da temporada seja simulado exatamente como antes.
 */
function migrateSheet(sheet: TeamSheet): TeamSheet {
  return {
    ...sheet,
    players: sheet.players.map((p) => {
      const old = p.pos as string;
      return { ...p, pos: toPosition(old), role: p.role ?? (isRole(old) ? old : db.cardMaybe(p.cardKey)?.player.position) };
    }),
  };
}

function migrateCampaign(c: Campaign): Campaign {
  const teams = Object.fromEntries(Object.entries(c.teams).map(([id, t]) => [id, migrateSheet(t)]));
  const fixLines = <T extends { pos: string }>(lines: T[]): T[] => lines.map((l) => ({ ...l, pos: toPosition(l.pos) }));
  const userMatches = c.userMatches.map((um) => ({
    ...um,
    result: { ...um.result, players: { home: fixLines(um.result.players.home), away: fixLines(um.result.players.away) } },
  }));
  return { ...c, teams, userMatches };
}

/** v1 → v2. Uma partida que não possa ser adaptada é descartada (o ranking fica). */
export function migrateRunV2(run: Run | null): Run | null {
  if (!run) return null;
  try {
    if (run.campaign) {
      // temporada em andamento ou encerrada: o elenco já está definido
      return { ...run, campaign: migrateCampaign(run.campaign), draft: run.draft ? { ...run.draft, draw: null } : null };
    }
    if (run.draft) return migrateDraft(run);
    return run;
  } catch {
    return null;
  }
}

/** Migração do estado persistido (zustand `persist`). */
export function migratePersisted(state: unknown, version: number): unknown {
  const s = (state ?? {}) as { run?: Run | null };
  if (version < 2) return { ...s, run: migrateRunV2(s.run ?? null) };
  return s;
}
