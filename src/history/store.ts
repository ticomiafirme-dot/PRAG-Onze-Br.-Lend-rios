// Estado do histórico do jogador (temporadas, títulos, conquistas) com cache
// local por dono ("visitante" ou o id da conta). A nuvem, quando há login,
// recebe cada gravação pelo módulo de sincronização (subscribeHistoryWrites).
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { packJSON, unpackJSON } from '../lib/compress';
import { readJSON, STORAGE_PREFIX, writeJSON } from '../state/storage';
import { EMPTY_HISTORY, type HistoryData, type HistoryUpdate } from './engine';
import type { PersonalRecord } from './records';
import type { SeasonDetails, TitleRecord, UnlockRecord } from './types';

export const GUEST = 'visitante';

export type Notice =
  | { id: string; kind: 'achievement'; unlock: UnlockRecord }
  | { id: string; kind: 'records'; runId: string; records: PersonalRecord[] }
  | { id: string; kind: 'title'; title: TitleRecord };

interface HistoryState {
  owner: string;
  data: HistoryData;
  details: Record<string, SeasonDetails>;
  notices: Notice[];
  apply: (update: HistoryUpdate, opts?: { notify?: boolean }) => void;
  dismissNotice: (id: string) => void;
  setOwner: (owner: string) => void;
  replaceData: (data: HistoryData) => void;
  cacheDetails: (runId: string, details: SeasonDetails) => void;
  rememberDetails: (runId: string, details: SeasonDetails) => void;
}

const dataKey = (owner: string) => `history:${owner}`;
const detailKey = (owner: string, runId: string) => `history-detail:${owner}:${runId}`;

export function loadLocalHistory(owner: string): HistoryData {
  const d = readJSON<Partial<HistoryData> | null>(dataKey(owner), null);
  return { seasons: d?.seasons ?? [], titles: d?.titles ?? [], unlocks: d?.unlocks ?? [] };
}

export function saveLocalHistory(owner: string, data: HistoryData): void {
  writeJSON(dataKey(owner), data);
}

export function loadLocalDetails(owner: string, runId: string): SeasonDetails | null {
  const packed = readJSON<string | null>(detailKey(owner, runId), null);
  if (!packed) return null;
  try {
    return unpackJSON<SeasonDetails>(packed);
  } catch {
    return null;
  }
}

export function saveLocalDetails(owner: string, runId: string, details: SeasonDetails): void {
  writeJSON(detailKey(owner, runId), packJSON(details));
}

/** Apaga o cache local de um dono (usado ao sair da conta depois de sincronizar). */
export function clearLocalHistory(owner: string): void {
  try {
    const prefix = `${STORAGE_PREFIX}:history-detail:${owner}:`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) localStorage.removeItem(k);
    }
    localStorage.removeItem(`${STORAGE_PREFIX}:${dataKey(owner)}`);
  } catch {
    /* armazenamento indisponível */
  }
}

type WriteListener = (owner: string, update: HistoryUpdate) => void;
const listeners = new Set<WriteListener>();

/** A sincronização com a nuvem escuta cada gravação do histórico. */
export function subscribeHistoryWrites(fn: WriteListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let seq = 0;
const noticeId = () => `n${Date.now().toString(36)}${(seq++).toString(36)}`;

export const useHistory = create<HistoryState>()((set, get) => ({
  owner: GUEST,
  data: loadLocalHistory(GUEST),
  details: {},
  notices: [],

  apply: (update, opts = { notify: true }) => {
    const { owner } = get();
    const changed =
      update.data !== get().data || update.newUnlocks.length > 0 || update.newTitles.length > 0 || !!update.season || !!update.details;
    if (!changed) return;
    saveLocalHistory(owner, update.data);
    if (update.details) saveLocalDetails(owner, update.details.runId, update.details.details);
    const notices: Notice[] = [];
    if (opts.notify !== false) {
      for (const t of update.newTitles) if (t.competitionId !== 'brasileirao') notices.push({ id: noticeId(), kind: 'title', title: t });
      for (const u of update.newUnlocks) notices.push({ id: noticeId(), kind: 'achievement', unlock: u });
      if (update.records.length && update.season) notices.push({ id: noticeId(), kind: 'records', runId: update.season.runId, records: update.records });
    }
    set((s) => ({
      data: update.data,
      details: update.details ? { ...s.details, [update.details.runId]: update.details.details } : s.details,
      notices: [...s.notices, ...notices],
    }));
    for (const fn of listeners) fn(owner, update);
  },

  dismissNotice: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),

  setOwner: (owner) => {
    if (owner === get().owner) return;
    set({ owner, data: loadLocalHistory(owner), details: {}, notices: [] });
  },

  replaceData: (data) => {
    saveLocalHistory(get().owner, data);
    set({ data });
  },

  cacheDetails: (runId, details) => {
    saveLocalDetails(get().owner, runId, details);
    set((s) => ({ details: { ...s.details, [runId]: details } }));
  },

  rememberDetails: (runId, details) => set((s) => ({ details: { ...s.details, [runId]: details } })),
}));

type DetailsLoader = (owner: string, runId: string) => Promise<SeasonDetails | null>;
let remoteDetails: DetailsLoader | null = null;

/** A nuvem registra aqui como buscar os detalhes de uma temporada que não estão no aparelho. */
export function setRemoteDetailsLoader(fn: DetailsLoader | null): void {
  remoteDetails = fn;
}

/** Detalhes de uma temporada: memória → aparelho → nuvem. */
export function useSeasonDetails(runId: string | null): { details: SeasonDetails | null; loading: boolean } {
  const owner = useHistory((s) => s.owner);
  const cached = useHistory((s) => (runId ? s.details[runId] : undefined));
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!runId || cached) return;
    const local = loadLocalDetails(owner, runId);
    if (local) {
      useHistory.getState().rememberDetails(runId, local);
      return;
    }
    if (!remoteDetails) return;
    let alive = true;
    setLoading(true);
    remoteDetails(owner, runId)
      .then((d) => {
        if (alive && d) useHistory.getState().cacheDetails(runId, d);
      })
      .catch(() => undefined)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [runId, owner, cached]);
  return { details: cached ?? null, loading };
}

export function emptyHistory(): HistoryData {
  return { ...EMPTY_HISTORY, seasons: [], titles: [], unlocks: [] };
}
