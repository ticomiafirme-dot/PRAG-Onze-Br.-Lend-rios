// Login com Google (Supabase Auth): início da sessão, retorno do Google,
// sessão persistente, expiração e saída da conta.
import type { Session } from '@supabase/supabase-js';
import { navigate } from '../router';
import { useGame } from '../state/store';
import { useAuth, type AccountUser } from './auth';
import { createRepo } from './repo';
import { getSupabase } from './supabase';
import { endSyncForLogout, flushSync, startSync, stopSync, syncHasPending, watchWhileExpired } from './sync';

let signingOut = false;
let activeUid: string | null = null;

function cleanAuthParams(): boolean {
  const url = new URL(location.href);
  const keys = ['code', 'error', 'error_code', 'error_description', 'state'];
  if (!keys.some((k) => url.searchParams.has(k))) return false;
  for (const k of keys) url.searchParams.delete(k);
  history.replaceState(null, '', url.pathname + url.search + (location.hash || '#inicio'));
  return true;
}

function userFrom(session: Session, profile?: { display_name: string; avatar_url: string | null; created_at: string; game_avatar?: string | null } | null): AccountUser {
  const m = (session.user.user_metadata ?? {}) as Record<string, string | undefined>;
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: profile?.display_name || m.full_name || m.name || session.user.email?.split('@')[0] || 'Jogador',
    avatarUrl: profile?.avatar_url ?? m.avatar_url ?? m.picture ?? null,
    gameAvatar: profile?.game_avatar ?? null,
    createdAt: profile?.created_at ?? session.user.created_at ?? null,
  };
}

async function onSession(session: Session | null, fromRedirect: boolean): Promise<void> {
  const auth = useAuth.getState();
  if (!session) {
    if (activeUid && !signingOut) {
      // a sessão terminou sem o jogador sair: expirou ou foi revogada
      stopSync();
      watchWhileExpired(activeUid);
      auth.set({ status: 'expired' });
    } else if (auth.status !== 'expired') {
      auth.set({ status: 'signed-out', user: null });
    }
    activeUid = null;
    return;
  }
  if (activeUid === session.user.id) {
    // renovação de token: mantém tudo
    if (auth.status !== 'signed-in') auth.set({ status: 'signed-in' });
    return;
  }
  activeUid = session.user.id;
  auth.set({ status: 'signed-in', user: userFrom(session), error: null });
  const sb = getSupabase()!;
  const repo = createRepo(sb, session.user.id);
  try {
    const m = (session.user.user_metadata ?? {}) as Record<string, string | undefined>;
    const profile = await repo.ensureProfile({
      name: m.full_name || m.name || session.user.email?.split('@')[0] || 'Jogador',
      avatarUrl: m.avatar_url ?? m.picture ?? null,
      email: session.user.email ?? null,
    });
    auth.set({ user: userFrom(session, profile) });
  } catch {
    /* perfil será lido de novo na próxima sincronização */
  }
  await startSync(session.user.id, repo);
  if (fromRedirect) navigate('/', { replace: true });
}

/** Inicia a sessão: recupera a sessão salva ou conclui o retorno do Google. */
export async function initSession(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const params = new URL(location.href).searchParams;
  const oauthError = params.get('error_description') || params.get('error');
  const fromRedirect = params.has('code');
  if (oauthError) useAuth.getState().set({ error: oauthError.replace(/\+/g, ' ') });

  sb.auth.onAuthStateChange((event, session) => {
    // o Supabase pede que chamadas ao banco não ocorram dentro deste callback
    setTimeout(() => {
      if (event === 'INITIAL_SESSION') return; // tratado abaixo, com o resultado do getSession
      void onSession(session, false);
    }, 0);
  });
  try {
    const { data, error } = await sb.auth.getSession();
    if (error) useAuth.getState().set({ error: error.message });
    cleanAuthParams();
    await onSession(data.session, fromRedirect && !!data.session);
  } catch (e) {
    cleanAuthParams();
    useAuth.getState().set({ status: 'signed-out', error: (e as Error).message });
  }
}

export async function signInWithGoogle(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  useAuth.getState().set({ error: null });
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // volta para a página inicial do jogo
      redirectTo: location.origin + location.pathname,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) useAuth.getState().set({ error: error.message });
}

/** Há alterações que ainda não chegaram à nuvem? */
export function hasUnsyncedChanges(): boolean {
  return syncHasPending();
}

/** Sai da conta. O que não foi enviado fica guardado neste aparelho para o próximo login. */
export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  signingOut = true;
  try {
    const synced = await flushSync();
    endSyncForLogout(synced);
    // a partida pertence à conta: o visitante começa do zero neste aparelho
    useGame.setState({ run: null });
    await sb.auth.signOut();
  } finally {
    activeUid = null;
    signingOut = false;
    useAuth.getState().set({ status: 'signed-out', user: null });
    navigate('/');
  }
}

/** Atualiza o nome de exibição do perfil. */
/** Grava o avatar de jogador escolhido como foto de perfil da conta. */
export async function updateGameAvatar(key: string | null): Promise<void> {
  const sb = getSupabase();
  const user = useAuth.getState().user;
  if (!sb || !user) return;
  await createRepo(sb, user.id).setGameAvatar(key);
  useAuth.getState().set({ user: { ...user, gameAvatar: key } });
}

export async function updateDisplayName(name: string): Promise<void> {
  const sb = getSupabase();
  const user = useAuth.getState().user;
  if (!sb || !user) return;
  const clean = name.trim().slice(0, 60);
  if (!clean) return;
  await createRepo(sb, user.id).setDisplayName(clean);
  useAuth.getState().set({ user: { ...user, name: clean } });
}
