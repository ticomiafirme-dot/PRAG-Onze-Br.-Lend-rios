// Sincronização com a nuvem para o usuário logado.
// - Histórico (temporadas, títulos, conquistas): tudo é gravado primeiro no
//   aparelho e enviado à nuvem por uma fila persistente (sobrevive a quedas de
//   conexão e ao fechamento do navegador).
// - Progresso da partida: salvo automaticamente a cada mudança (com pausa
//   curta para agrupar alterações), com controle de revisão para não
//   sobrescrever o que outro aparelho salvou.
import { CLUB_BY_ID } from '../data/clubs';
import { packJSON, unpackJSON } from '../lib/compress';
import { readJSON, writeJSON } from '../state/storage';
import { migrateRunV2 } from '../state/migrate';
import { useGame, type Run } from '../state/store';
import { EMPTY_HISTORY, mergeHistory, type HistoryData, type HistoryUpdate } from '../history/engine';
import { backfillRun } from '../history/hooks';
import { clearLocalHistory, GUEST, loadLocalDetails, loadLocalHistory, saveLocalDetails, setRemoteDetailsLoader, subscribeHistoryWrites, useHistory } from '../history/store';
import type { SeasonEntry, TitleRecord, UnlockRecord } from '../history/types';
import { ConflictError, type CloudRepo, type CloudSave } from './repo';
import { useSync } from './syncState';

const SAVE_VERSION = 2;
const DEBOUNCE_MS = 1500;

type Op = { kind: 'season'; entry: SeasonEntry } | { kind: 'titles'; titles: TitleRecord[] } | { kind: 'unlocks'; unlocks: UnlockRecord[] };

interface SaveMeta {
  /** Revisão da nuvem em que o progresso local se baseia. */
  baseRevision: number | null;
  /** Há mudanças locais ainda não enviadas. */
  dirty: boolean;
  runId: string | null;
}

const outboxKey = (uid: string) => `outbox:${uid}`;
const metaKey = (uid: string) => `save-meta:${uid}`;
const stashKey = (uid: string) => `stash:${uid}`;

const loadOutbox = (uid: string) => readJSON<Op[]>(outboxKey(uid), []);
const saveOutbox = (uid: string, ops: Op[]) => writeJSON(outboxKey(uid), ops);
const loadMeta = (uid: string) => readJSON<SaveMeta>(metaKey(uid), { baseRevision: null, dirty: false, runId: null });
const saveMeta = (uid: string, m: SaveMeta) => writeJSON(metaKey(uid), m);

export interface ConflictChoice {
  local: { run: Run; summary: string };
  cloud: { run: Run; summary: string; updatedAt: string; device: string | null };
}

/** Pergunta ao jogador qual progresso manter (registrado pela interface). */
let askConflict: (c: ConflictChoice) => Promise<'local' | 'cloud'> = async () => 'cloud';
export function setConflictResolver(fn: (c: ConflictChoice) => Promise<'local' | 'cloud'>): void {
  askConflict = fn;
}

export function describeRun(run: Run): string {
  const team = run.campaign?.teams.user?.name ?? (run.clubId ? (CLUB_BY_ID[run.clubId]?.name ?? run.clubId) : 'Mistura Brasileira');
  if (run.campaign?.finished) return `${team} · temporada encerrada`;
  if (run.campaign) {
    const played = run.campaign.results.filter((m) => m.comp === 'brasileirao' && (m.home === 'user' || m.away === 'user')).length;
    return `${team} · Brasileirão, ${played} de ${run.campaign.league.fixtures.length} jogos`;
  }
  if (run.draft) return `${team} · draft ${Object.keys(run.draft.picks).length}/11`;
  return `${team} · montando o time`;
}

function deviceName(): string {
  const ua = navigator.userAgent;
  const kind = /Mobi|Android|iPhone|iPad/i.test(ua) ? 'Celular' : 'Computador';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  return `${kind} · ${browser}`;
}

function decodeSave(s: CloudSave): Run | null {
  if (!s.payload) return null;
  try {
    const box = s.encoding === 'json' ? (JSON.parse(s.payload) as { v: number; run: Run }) : unpackJSON<{ v: number; run: Run }>(s.payload);
    return box.v < SAVE_VERSION ? migrateRunV2(box.run) : box.run;
  } catch {
    return null;
  }
}

class SyncEngine {
  private stopped = false;
  private applyingRemote = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private backoff = 2000;
  private flushing: Promise<boolean> | null = null;
  private unsubs: (() => void)[] = [];

  constructor(
    readonly uid: string,
    readonly repo: CloudRepo,
  ) {}

  async start(): Promise<void> {
    useSync.getState().set({ state: 'loading', error: null });
    useSync.getState().setRetry(() => void this.flush());
    useHistory.getState().setOwner(this.uid);
    setRemoteDetailsLoader((owner, runId) => (owner === this.uid ? this.repo.details(runId) : Promise.resolve(null)));
    try {
      await this.reconcileHistory();
      await this.reconcileSave();
    } catch (e) {
      this.fail(e);
    }
    if (this.stopped) return;
    backfillRun(useGame.getState().run);
    this.unsubs.push(
      useGame.subscribe((s, prev) => {
        if (s.run !== prev.run && !this.applyingRemote) this.runChanged();
      }),
      subscribeHistoryWrites((owner, update) => owner === this.uid && this.enqueueUpdate(update)),
    );
    const onHide = () => document.visibilityState === 'hidden' && void this.flush();
    const onOnline = () => void this.flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('online', onOnline);
    window.addEventListener('pagehide', onHide);
    this.unsubs.push(() => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pagehide', onHide);
    });
    await this.flush();
  }

  stop(): void {
    this.stopped = true;
    for (const u of this.unsubs) u();
    this.unsubs = [];
    if (this.saveTimer) clearTimeout(this.saveTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    setRemoteDetailsLoader(null);
  }

  // ---------------------------------------------------------------- histórico

  /** Junta aparelho + nuvem + visitante e envia à nuvem o que faltar. */
  private async reconcileHistory(): Promise<void> {
    const cloud = await this.repo.history();
    const local = loadLocalHistory(this.uid);
    const guest = loadLocalHistory(GUEST);
    const merged = mergeHistory(mergeHistory(local, cloud), guest);
    // detalhes das temporadas do visitante passam para a conta
    for (const s of guest.seasons) {
      const d = loadLocalDetails(GUEST, s.runId);
      if (d) saveLocalDetails(this.uid, s.runId, d);
    }
    if (guest.seasons.length || guest.titles.length || guest.unlocks.length) clearLocalHistory(GUEST);
    useHistory.getState().replaceData(merged);
    this.enqueueMissing(merged, cloud);
  }

  private enqueueMissing(merged: HistoryData, cloud: HistoryData): void {
    const cloudSeason = new Map(cloud.seasons.map((s) => [s.runId, s.status]));
    const ops: Op[] = [];
    for (const s of merged.seasons) {
      const st = cloudSeason.get(s.runId);
      if (!st || (st === 'in_progress' && s.status !== 'in_progress')) ops.push({ kind: 'season', entry: s });
    }
    const titles = merged.titles.filter((t) => !cloud.titles.some((c) => c.id === t.id));
    if (titles.length) ops.push({ kind: 'titles', titles });
    const unlocks = merged.unlocks.filter((u) => !cloud.unlocks.some((c) => c.id === u.id));
    if (unlocks.length) ops.push({ kind: 'unlocks', unlocks });
    if (ops.length) this.enqueue(ops);
  }

  private enqueueUpdate(u: HistoryUpdate): void {
    const ops: Op[] = [];
    if (u.season) ops.push({ kind: 'season', entry: u.season });
    if (u.newTitles.length) ops.push({ kind: 'titles', titles: u.newTitles });
    if (u.newUnlocks.length) ops.push({ kind: 'unlocks', unlocks: u.newUnlocks });
    if (ops.length) {
      this.enqueue(ops);
      void this.flush();
    }
  }

  private enqueue(ops: Op[]): void {
    saveOutbox(this.uid, [...loadOutbox(this.uid), ...ops]);
    this.markPending();
  }

  /** Há algo a enviar: o indicador mostra "Salvando…" (ou mantém o aviso de falha). */
  private markPending(): void {
    const st = useSync.getState().state;
    useSync.getState().set({ pending: true, state: st === 'offline' || st === 'error' ? st : 'saving' });
  }

  private async sendOp(op: Op): Promise<void> {
    if (op.kind === 'season') {
      const details = op.entry.status === 'in_progress' ? null : loadLocalDetails(this.uid, op.entry.runId);
      await this.repo.putSeason(op.entry, details);
    } else if (op.kind === 'titles') {
      try {
        await this.repo.putTitles(op.titles);
      } catch (e) {
        // título de uma temporada que ainda não chegou à nuvem: envia a temporada antes
        if ((e as { code?: string }).code === '23503') {
          const data = useHistory.getState().data;
          for (const t of op.titles) {
            const s = data.seasons.find((x) => x.runId === t.runId);
            if (s) await this.repo.putSeason(s, s.status === 'in_progress' ? null : loadLocalDetails(this.uid, s.runId));
          }
          await this.repo.putTitles(op.titles);
        } else throw e;
      }
    } else {
      await this.repo.putUnlocks(op.unlocks);
    }
  }

  // ---------------------------------------------------------------- progresso

  private async reconcileSave(): Promise<void> {
    const meta = loadMeta(this.uid);
    const cloud = await this.repo.loadSave();
    const cloudRun = cloud ? decodeSave(cloud) : null;
    // progresso guardado neste aparelho quando a sessão terminou sem sincronizar
    const stash = readJSON<Run | null>(stashKey(this.uid), null);
    let local = useGame.getState().run;
    if (stash && (!local || local.id === stash.id)) {
      local = stash;
      meta.dirty = true;
    }
    writeJSON(stashKey(this.uid), null);

    const adoptCloud = () => {
      this.applyRemote(cloudRun);
      saveMeta(this.uid, { baseRevision: cloud?.revision ?? null, dirty: false, runId: cloudRun?.id ?? null });
    };
    const keepLocal = () => {
      if (local !== useGame.getState().run) this.applyRemote(local);
      saveMeta(this.uid, { baseRevision: cloud?.revision ?? null, dirty: true, runId: local?.id ?? null });
      useSync.getState().set({ pending: true });
    };

    if (!cloud || !cloudRun) {
      // nada na nuvem: o progresso deste aparelho (inclusive de visitante) passa para a conta
      if (local) keepLocal();
      else saveMeta(this.uid, { baseRevision: cloud?.revision ?? null, dirty: false, runId: null });
      return;
    }
    if (!local) return adoptCloud();
    const sameRun = local.id === cloudRun.id;
    const basedOnCloud = meta.baseRevision === cloud.revision;
    if (sameRun && basedOnCloud) return meta.dirty ? keepLocal() : undefined;
    if (sameRun && !meta.dirty) return adoptCloud();
    // temporada encerrada já está no histórico: só pergunta quando as duas partidas estão em andamento
    const done = (r: Run) => r.phase === 'finished';
    if (!sameRun && done(cloudRun)) return keepLocal();
    if (!sameRun && done(local)) return adoptCloud();
    // partidas diferentes, ou a mesma alterada nos dois aparelhos: o jogador decide
    const choice = await askConflict({
      local: { run: local, summary: describeRun(local) },
      cloud: { run: cloudRun, summary: describeRun(cloudRun), updatedAt: cloud.updated_at, device: cloud.device },
    });
    if (choice === 'cloud') {
      // a partida deste aparelho que estava em temporada fica no histórico como abandonada
      if (!sameRun && local.campaign && !local.campaign.finished) backfillRun(local);
      adoptCloud();
    } else keepLocal();
  }

  private applyRemote(run: Run | null): void {
    this.applyingRemote = true;
    try {
      useGame.setState({ run });
    } finally {
      this.applyingRemote = false;
    }
  }

  private runChanged(): void {
    const meta = loadMeta(this.uid);
    saveMeta(this.uid, { ...meta, dirty: true, runId: useGame.getState().run?.id ?? null });
    this.markPending();
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.flush(), DEBOUNCE_MS);
  }

  private async pushSave(): Promise<void> {
    const meta = loadMeta(this.uid);
    if (!meta.dirty) return;
    const run = useGame.getState().run;
    const save = { payload: run ? packJSON({ v: SAVE_VERSION, run }) : null, run_id: run?.id ?? null, phase: run?.phase ?? null, device: deviceName() };
    try {
      const r = await this.repo.writeSave(save, meta.baseRevision);
      // só limpa a marca se nada mudou enquanto enviava
      const now = useGame.getState().run;
      saveMeta(this.uid, { baseRevision: r.revision, dirty: now !== run, runId: run?.id ?? null });
    } catch (e) {
      if (e instanceof ConflictError) {
        await this.reconcileSave();
        return;
      }
      throw e;
    }
  }

  // ---------------------------------------------------------------- envio

  /** Envia a fila do histórico e o progresso. Retorna true se tudo foi enviado. */
  flush(): Promise<boolean> {
    if (this.flushing) return this.flushing;
    this.flushing = this.doFlush().finally(() => (this.flushing = null));
    return this.flushing;
  }

  private async doFlush(): Promise<boolean> {
    if (this.stopped) return false;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    const ops = loadOutbox(this.uid);
    const meta = loadMeta(this.uid);
    if (!ops.length && !meta.dirty) {
      useSync.getState().set({ state: 'synced', pending: false, error: null, lastSyncedAt: new Date().toISOString() });
      return true;
    }
    useSync.getState().set({ state: 'saving', pending: true });
    try {
      while (true) {
        const queue = loadOutbox(this.uid);
        if (!queue.length) break;
        await this.sendOp(queue[0]);
        saveOutbox(this.uid, loadOutbox(this.uid).slice(1));
      }
      await this.pushSave();
      this.backoff = 2000;
      const pending = loadOutbox(this.uid).length > 0 || loadMeta(this.uid).dirty;
      useSync.getState().set({ state: pending ? 'saving' : 'synced', pending, error: null, lastSyncedAt: new Date().toISOString() });
      if (pending) this.saveTimer = setTimeout(() => void this.flush(), DEBOUNCE_MS);
      return !pending;
    } catch (e) {
      this.fail(e);
      return false;
    }
  }

  private fail(e: unknown): void {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const msg = (e as Error)?.message ?? 'Falha ao sincronizar.';
    const code = (e as { code?: string })?.code;
    // erro de validação do banco: descarta a operação para não travar a fila
    if (code && /^(22|23)/.test(code) && code !== '23503') {
      saveOutbox(this.uid, loadOutbox(this.uid).slice(1));
    }
    useSync.getState().set({ state: offline ? 'offline' : 'error', error: msg, pending: true });
    if (this.stopped) return;
    this.retryTimer = setTimeout(() => void this.flush(), this.backoff);
    this.backoff = Math.min(this.backoff * 2, 60_000);
  }

  hasPending(): boolean {
    return loadOutbox(this.uid).length > 0 || loadMeta(this.uid).dirty;
  }

  /** Ao sair da conta: o que não foi enviado fica guardado para o próximo login. */
  stash(): void {
    const run = useGame.getState().run;
    if (loadMeta(this.uid).dirty && run) writeJSON(stashKey(this.uid), run);
  }
}

let engine: SyncEngine | null = null;
let expiredWatch: (() => void) | null = null;

/**
 * Sessão expirada: o jogo continua neste aparelho; cada mudança fica marcada
 * para ser enviada assim que o jogador entrar de novo.
 */
export function watchWhileExpired(uid: string): void {
  expiredWatch?.();
  expiredWatch = useGame.subscribe((s, prev) => {
    if (s.run !== prev.run) {
      saveMeta(uid, { ...loadMeta(uid), dirty: true, runId: s.run?.id ?? null });
      useSync.getState().set({ pending: true });
    }
  });
}

export async function startSync(uid: string, repo: CloudRepo): Promise<void> {
  expiredWatch?.();
  expiredWatch = null;
  if (engine?.uid === uid) return;
  engine?.stop();
  engine = new SyncEngine(uid, repo);
  await engine.start();
}

export function stopSync(): void {
  engine?.stop();
  engine = null;
}

export function syncHasPending(): boolean {
  return engine?.hasPending() ?? false;
}

export async function flushSync(timeoutMs = 6000): Promise<boolean> {
  if (!engine) return true;
  const timeout = new Promise<boolean>((r) => setTimeout(() => r(false), timeoutMs));
  return Promise.race([engine.flush(), timeout]);
}

/** Encerra a sincronização ao sair da conta, guardando o que faltou enviar. */
export function endSyncForLogout(clearCache: boolean): void {
  if (!engine) return;
  const uid = engine.uid;
  engine.stash();
  engine.stop();
  engine = null;
  if (clearCache) clearLocalHistory(uid);
  useHistory.getState().setOwner(GUEST);
  useHistory.getState().replaceData({ ...EMPTY_HISTORY, ...loadLocalHistory(GUEST) });
}
