import { create } from 'zustand';
import { loadPlayerName, loadProfileAvatar, saveProfileAvatar } from '../state/storage';
import { useAuth } from './auth';
import { updateGameAvatar } from './session';

/** Nome do jogador para as artes e o ranking: o da conta ou o salvo no aparelho. */
export function usePlayerName(): string | null {
  const user = useAuth((s) => s.user);
  return user?.name || loadPlayerName() || null;
}

/** Como o jogador aparece nas artes: o título especial (ex.: "Presidente") ou "Técnico". */
export function usePlayerRole(): string {
  const title = useAuth((s) => (s.status === 'signed-in' ? (s.user?.title ?? null) : null));
  return title || 'Técnico';
}

const useVisitorAvatar = create<{ key: string | null }>(() => ({ key: loadProfileAvatar() }));

/** Avatar de jogador usado como foto de perfil (da conta, ou do visitante neste aparelho). */
export function useProfileAvatar(): string | null {
  const status = useAuth((s) => s.status);
  const account = useAuth((s) => s.user?.gameAvatar ?? null);
  const visitor = useVisitorAvatar((s) => s.key);
  return status === 'signed-in' ? account : visitor;
}

/** Troca a foto de perfil (null volta para a foto da conta Google ou as iniciais). */
export async function setProfileAvatar(key: string | null): Promise<void> {
  if (useAuth.getState().status === 'signed-in') {
    await updateGameAvatar(key);
    return;
  }
  saveProfileAvatar(key);
  useVisitorAvatar.setState({ key });
}
