// Motor do histórico: aplica os acontecimentos do jogo (elenco completo,
// partida, título, início/fim/abandono de temporada) aos dados permanentes do
// jogador, verificando conquistas e recordes nos momentos certos.
// Funções puras: recebem os dados atuais e devolvem os novos + o que mudou.
import { estadualOf, COMPETITION_BY_ID } from './competitions';
import { evaluateAchievements, mergeUnlocks, type AchievementContext } from './achievements';
import { brokenRecords, type PersonalRecord } from './records';
import { toEntry } from './record';
import type { SeasonDetails, SeasonEntry, SeasonRecord, TitleRecord, UnlockRecord } from './types';

export interface HistoryData {
  seasons: SeasonEntry[];
  titles: TitleRecord[];
  unlocks: UnlockRecord[];
}

export const EMPTY_HISTORY: HistoryData = { seasons: [], titles: [], unlocks: [] };

export interface HistoryUpdate {
  data: HistoryData;
  /** Temporada criada/alterada (para gravar). */
  season?: SeasonEntry;
  details?: { runId: string; details: SeasonDetails };
  newTitles: TitleRecord[];
  newUnlocks: UnlockRecord[];
  records: PersonalRecord[];
}

const noChange = (data: HistoryData): HistoryUpdate => ({ data, newTitles: [], newUnlocks: [], records: [] });

const finishedBefore = (data: HistoryData, runId: string) => data.seasons.filter((s) => s.status === 'finished' && s.runId !== runId);

function withUnlocks(data: HistoryData, unlocks: UnlockRecord[]): HistoryData {
  return unlocks.length ? { ...data, unlocks: mergeUnlocks(data.unlocks, unlocks) } : data;
}

function evaluate(data: HistoryData, ctx: Omit<AchievementContext, 'titles'>, at: string): UnlockRecord[] {
  return evaluateAchievements({ ...ctx, titles: data.titles }, data.unlocks.map((u) => u.id), at);
}

/** Títulos de uma temporada (a partir do registro). */
export function titlesOf(record: SeasonEntry, at: string): TitleRecord[] {
  const base = {
    runId: record.runId,
    clubId: record.clubId,
    teamName: record.teamName,
    decades: record.decades,
    fixedDecade: record.fixedDecade,
    formationId: record.formationId,
    wonAt: at,
  };
  const out: TitleRecord[] = [];
  const add = (competitionId: string) => {
    const c = COMPETITION_BY_ID[competitionId];
    if (c) out.push({ ...base, id: `${record.runId}:${c.id}`, competitionId: c.id, competitionName: c.name });
  };
  if (record.champion) add('brasileirao');
  if (record.copaChampion) add('copa-do-brasil');
  if (record.estadualChampion) {
    const e = estadualOf(record.clubId);
    if (e) add(e.id);
  }
  return out;
}

function addTitles(data: HistoryData, titles: TitleRecord[]): { data: HistoryData; added: TitleRecord[] } {
  const have = new Set(data.titles.map((t) => t.id));
  const added = titles.filter((t) => !have.has(t.id));
  return { data: added.length ? { ...data, titles: [...data.titles, ...added] } : data, added };
}

/** Elenco completo (fim do draft) ou time escalado para a temporada. */
export function squadReady(data: HistoryData, squad: { runId: string; overall: number; chemistry: number | null }, at: string): HistoryUpdate {
  const unlocks = evaluate(data, { trigger: 'elenco', squad, previous: [] }, at);
  return { ...noChange(withUnlocks(data, unlocks)), newUnlocks: unlocks };
}

/** Uma partida do jogador terminou. */
export function matchPlayed(data: HistoryData, match: { runId: string; for: number; against: number; rival: string }, at: string): HistoryUpdate {
  const unlocks = evaluate(data, { trigger: 'partida', match, previous: [] }, at);
  return { ...noChange(withUnlocks(data, unlocks)), newUnlocks: unlocks };
}

/** Títulos conquistados durante a temporada (ex.: estadual decidido antes do Brasileirão). */
export function titlesWon(data: HistoryData, titles: TitleRecord[], at: string): HistoryUpdate {
  const t = addTitles(data, titles);
  if (!t.added.length) return noChange(data);
  const unlocks = evaluate(t.data, { trigger: 'titulo', previous: [] }, at);
  return { ...noChange(withUnlocks(t.data, unlocks)), newTitles: t.added, newUnlocks: unlocks };
}

/** Temporada começou: registra como "em andamento" (se ainda não existir). */
export function seasonStarted(data: HistoryData, record: SeasonRecord): HistoryUpdate {
  if (data.seasons.some((s) => s.runId === record.runId)) return noChange(data);
  const entry: SeasonEntry = { ...toEntry(record), status: 'in_progress', finishedAt: null, achievements: [] };
  return { ...noChange({ ...data, seasons: [...data.seasons, entry] }), season: entry, ...(record.details ? { details: { runId: record.runId, details: record.details } } : {}) };
}

/**
 * Temporada terminou: grava o registro definitivo (que não muda mais), os
 * títulos, as conquistas e os recordes batidos.
 */
export function seasonFinished(data: HistoryData, record: SeasonRecord, at: string): HistoryUpdate {
  const existing = data.seasons.find((s) => s.runId === record.runId);
  if (existing && existing.status !== 'in_progress') return noChange(data); // registro permanente: não sobrescreve
  const previous = finishedBefore(data, record.runId);
  const entry0 = toEntry(record);

  // títulos
  const t = addTitles(data, titlesOf(entry0, at));
  let cur = t.data;
  // conquistas: títulos, temporada e recordes
  const unlocks: UnlockRecord[] = [];
  const run = (trigger: AchievementContext['trigger']) => {
    const u = evaluate(cur, { trigger, season: entry0, previous }, at);
    cur = withUnlocks(cur, u);
    unlocks.push(...u);
  };
  if (t.added.length) run('titulo');
  run('temporada');
  const records = brokenRecords(data.seasons, entry0);
  if (records.length) run('recorde');

  const achievements = [...new Set([...entry0.achievements, ...cur.unlocks.filter((u) => u.runId === record.runId).map((u) => u.id)])];
  const entry: SeasonEntry = { ...entry0, achievements };
  const seasons = existing ? cur.seasons.map((s) => (s.runId === record.runId ? entry : s)) : [...cur.seasons, entry];
  return {
    data: { ...cur, seasons },
    season: entry,
    ...(record.details ? { details: { runId: record.runId, details: record.details } } : {}),
    newTitles: t.added,
    newUnlocks: unlocks,
    records,
  };
}

/** Temporada abandonada no meio: fica no histórico com os números até ali. */
export function seasonAbandoned(data: HistoryData, record: SeasonRecord): HistoryUpdate {
  const existing = data.seasons.find((s) => s.runId === record.runId);
  if (existing && existing.status !== 'in_progress') return noChange(data);
  const entry: SeasonEntry = { ...toEntry(record), status: 'abandoned', achievements: existing?.achievements ?? [] };
  const seasons = existing ? data.seasons.map((s) => (s.runId === record.runId ? entry : s)) : [...data.seasons, entry];
  return { ...noChange({ ...data, seasons }), season: entry, ...(record.details ? { details: { runId: record.runId, details: record.details } } : {}) };
}

/**
 * Junta dois históricos (ex.: este aparelho + nuvem, ou visitante + conta):
 * temporadas finalizadas prevalecem sobre "em andamento"; títulos e conquistas
 * não se repetem (a conquista mais antiga prevalece).
 */
export function mergeHistory(a: HistoryData, b: HistoryData): HistoryData {
  const rank = (s: SeasonEntry) => (s.status === 'in_progress' ? 0 : 1);
  const seasons = new Map<string, SeasonEntry>();
  for (const s of [...a.seasons, ...b.seasons]) {
    const cur = seasons.get(s.runId);
    if (!cur || rank(s) > rank(cur)) seasons.set(s.runId, s);
  }
  const titles = new Map<string, TitleRecord>();
  for (const t of [...a.titles, ...b.titles]) if (!titles.has(t.id) || t.wonAt < titles.get(t.id)!.wonAt) titles.set(t.id, t);
  return {
    seasons: [...seasons.values()].sort((x, y) => x.startedAt.localeCompare(y.startedAt)),
    titles: [...titles.values()].sort((x, y) => x.wonAt.localeCompare(y.wonAt)),
    unlocks: mergeUnlocks(a.unlocks, b.unlocks),
  };
}
