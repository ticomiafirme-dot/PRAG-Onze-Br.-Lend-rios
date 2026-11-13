// Ligações entre o jogo e o histórico: chamadas pelo estado do jogo nos
// momentos certos (elenco completo, início da temporada, cada dia de jogos,
// fim e abandono da temporada).
import { db } from '../data/db';
import { USER_ID } from '../engine/campaign';
import type { Run } from '../state/store';
import { matchPlayed, seasonAbandoned, seasonFinished, seasonStarted, squadReady, titlesOf, titlesWon } from './engine';
import { buildSeasonRecord } from './record';
import { useHistory } from './store';

const now = () => new Date().toISOString();
const apply = (u: Parameters<ReturnType<typeof useHistory.getState>['apply']>[0], notify = true) => useHistory.getState().apply(u, { notify });
const data = () => useHistory.getState().data;

/** Overall médio do elenco como mostrado no draft (arredondado). */
export function squadOverallOf(run: Run): number | null {
  const keys = Object.values(run.draft?.picks ?? {});
  if (keys.length < 11) return null;
  return Math.round(keys.reduce((a, k) => a + db.card(k).overall, 0) / keys.length);
}

/** Fim do draft: elenco titular completo. */
export function onSquadComplete(run: Run): void {
  const overall = squadOverallOf(run);
  if (overall == null) return;
  apply(squadReady(data(), { runId: run.id, overall, chemistry: null }, now()));
}

/** Início da temporada: registra a campanha e confere o elenco já com capitão e química. */
export function onSeasonStart(run: Run): void {
  const rec = buildSeasonRecord(run, 'in_progress');
  if (!rec) return;
  apply(seasonStarted(data(), rec));
  apply(squadReady(data(), { runId: run.id, overall: squadOverallOf(run) ?? Math.round(rec.squadOverall), chemistry: rec.chemistry }, now()));
}

/** Depois de cada dia de jogos (ou da simulação em lote). */
export function onDaysPlayed(prev: Run, next: Run): void {
  const a = prev.campaign;
  const b = next.campaign;
  if (!a || !b) return;
  // partidas do jogador que acabaram de terminar
  for (const um of b.userMatches.slice(a.userMatches.length)) {
    const i = um.home === USER_ID ? 0 : 1;
    const rivalId = um.home === USER_ID ? um.away : um.home;
    apply(matchPlayed(data(), { runId: next.id, for: um.result.score[i], against: um.result.score[1 - i], rival: b.teams[rivalId]?.name ?? rivalId }, now()));
  }
  // copas decididas durante a temporada
  const cupWon = (b.copa?.champion === USER_ID && a.copa?.champion !== USER_ID) || (b.estadual?.champion === USER_ID && a.estadual?.champion !== USER_ID);
  if (cupWon && !b.finished) {
    const rec = buildSeasonRecord(next, 'in_progress');
    if (rec) apply(titlesWon(data(), titlesOf(rec, now()), now()));
  }
  if (b.finished && !a.finished) onSeasonEnd(next);
}

/** Temporada encerrada: registro permanente, títulos, conquistas e recordes. */
export function onSeasonEnd(run: Run, notify = true): void {
  const rec = buildSeasonRecord(run, 'finished');
  if (rec) apply(seasonFinished(data(), rec, rec.finishedAt ?? now()), notify);
}

/** Abandono no meio da temporada: fica no histórico como abandonada. */
export function onAbandon(run: Run): void {
  if (!run.campaign || run.campaign.finished) return;
  const rec = buildSeasonRecord(run, 'abandoned');
  if (rec) apply(seasonAbandoned(data(), rec), false);
}

/** Temporada terminada antes de existir o histórico (ou noutra sessão): registra sem alarde. */
export function backfillRun(run: Run | null): void {
  if (!run?.campaign) return;
  const known = data().seasons.find((s) => s.runId === run.id);
  if (run.campaign.finished) {
    if (!known || known.status === 'in_progress') onSeasonEnd(run, false);
  } else if (!known) {
    const rec = buildSeasonRecord(run, 'in_progress');
    if (rec) apply(seasonStarted(data(), rec), false);
  }
}
