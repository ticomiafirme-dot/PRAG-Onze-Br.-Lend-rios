// Estado visível da sincronização (indicador no cabeçalho e avisos).
import { create } from 'zustand';

export type SyncState = 'idle' | 'loading' | 'saving' | 'synced' | 'offline' | 'error';

interface SyncStore {
  state: SyncState;
  /** Há alterações ainda não enviadas à nuvem. */
  pending: boolean;
  lastSyncedAt: string | null;
  error: string | null;
  retry: () => void;
  set: (patch: Partial<Omit<SyncStore, 'set' | 'retry'>>) => void;
  setRetry: (fn: () => void) => void;
}

export const useSync = create<SyncStore>()((set) => ({
  state: 'idle',
  pending: false,
  lastSyncedAt: null,
  error: null,
  retry: () => undefined,
  set: (patch) => set(patch),
  setRetry: (fn) => set({ retry: fn }),
}));
