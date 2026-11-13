import { loadPlayerName } from '../state/storage';
import { useAuth } from './auth';

/** Nome do jogador para as artes e o ranking: o da conta ou o salvo no aparelho. */
export function usePlayerName(): string | null {
  const user = useAuth((s) => s.user);
  return user?.name || loadPlayerName() || null;
}
