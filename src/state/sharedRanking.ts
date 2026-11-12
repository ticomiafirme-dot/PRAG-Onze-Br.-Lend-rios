// Ranking compartilhado entre quem abre a mesma página publicada no Claude.
// Usa as capacidades `db` e `user` do ambiente da página (window.claude.use).
// Fora desse ambiente (hospedagem estática comum), tudo aqui resolve null e o
// jogo segue apenas com o ranking local deste dispositivo.
//
// Estrutura: um documento por jogador em `ranking/<id do jogador>` com as
// suas melhores campanhas ({ entries: RankingEntry[], updatedAt }).
// Todos leem; cada um grava só o próprio documento (regras declaradas na
// publicação). Nomes nunca são gravados: são resolvidos pelo perfil na hora
// de exibir.

import { rankingScore, type RankingEntry } from './storage';

interface DocSnap {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
  metadata: { fromCache: boolean };
}
interface QuerySnap {
  docs: DocSnap[];
  metadata: { fromCache: boolean };
}
interface DocRef {
  get(): Promise<DocSnap>;
  set(data: Record<string, unknown>): Promise<void>;
}
interface CollRef {
  onSnapshot(next: (s: QuerySnap) => void, error?: (e: { code: string }) => void): () => void;
}
interface DbNs {
  doc(path: string): DocRef;
  collection(path: string): CollRef;
}
interface ProfileLite {
  name: string;
  isMe: boolean;
}
interface UserNs {
  id(): Promise<string | null>;
  profiles(ids: string[]): Promise<Record<string, ProfileLite>>;
}
interface ClaudeRuntime {
  use(name: string): Promise<unknown>;
}

export interface SharedRanking {
  db: DbNs;
  user: UserNs;
  uid: string | null;
}

export interface SharedEntry extends RankingEntry {
  uid: string;
}

const MAX_PER_PLAYER = 60;
let pending: Promise<SharedRanking | null> | null = null;

/** Conexão com o ranking compartilhado, ou null quando indisponível. */
export function getSharedRanking(): Promise<SharedRanking | null> {
  if (!pending) {
    pending = (async () => {
      const rt = (globalThis as { claude?: ClaudeRuntime }).claude;
      if (!rt || typeof rt.use !== 'function') return null;
      try {
        const [db, user] = (await Promise.all([rt.use('db'), rt.use('user')])) as [DbNs | null, UserNs | null];
        if (!db || !user) return null;
        const uid = await user.id();
        return { db, user, uid };
      } catch {
        return null;
      }
    })();
  }
  return pending;
}

export type SubmitResult = 'ok' | 'unavailable' | 'denied';

/** Grava a campanha no documento do próprio jogador (mantém as melhores). */
export async function submitShared(entry: RankingEntry): Promise<SubmitResult> {
  const shared = await getSharedRanking();
  if (!shared?.uid) return 'unavailable';
  try {
    const ref = shared.db.doc(`ranking/${shared.uid}`);
    const snap = await ref.get();
    const prev = snap.exists && Array.isArray(snap.data()?.entries) ? (snap.data()!.entries as RankingEntry[]) : [];
    // o nome exibido vem do perfil; não gravamos nomes digitados
    const clean: RankingEntry = { ...entry, playerName: '' };
    const merged = [...prev.filter((e) => e && e.id !== entry.id), clean].sort((a, b) => rankingScore(b) - rankingScore(a));
    await ref.set({ entries: merged.slice(0, MAX_PER_PLAYER), updatedAt: new Date().toISOString() });
    return 'ok';
  } catch (e) {
    return (e as { code?: string })?.code === 'invalid_argument' ? 'denied' : 'unavailable';
  }
}

/** Converte os documentos do ranking em uma lista única de campanhas. */
export function flattenShared(snap: QuerySnap): SharedEntry[] {
  const out: SharedEntry[] = [];
  for (const d of snap.docs) {
    const entries = d.data()?.entries;
    if (!Array.isArray(entries)) continue;
    for (const e of entries as RankingEntry[]) {
      if (!e || typeof e.points !== 'number' || typeof e.id !== 'string') continue;
      out.push({ ...e, uid: d.id });
    }
  }
  return out.sort((a, b) => rankingScore(b) - rankingScore(a));
}
