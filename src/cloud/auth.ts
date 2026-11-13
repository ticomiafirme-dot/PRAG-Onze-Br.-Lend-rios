// Estado da conta (login com Google via Supabase Auth). A implementação do
// fluxo fica em session.ts; aqui só o estado observado pela interface.
import { create } from 'zustand';
import { cloudEnabled } from './config';

export type AuthStatus = 'disabled' | 'loading' | 'signed-out' | 'signed-in' | 'expired';

export interface AccountUser {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  /** Data de entrada no jogo (criação do perfil). */
  createdAt: string | null;
}

interface AuthState {
  status: AuthStatus;
  user: AccountUser | null;
  error: string | null;
  set: (patch: Partial<Pick<AuthState, 'status' | 'user' | 'error'>>) => void;
}

export const useAuth = create<AuthState>()((set) => ({
  status: cloudEnabled ? 'loading' : 'disabled',
  user: null,
  error: null,
  set: (patch) => set(patch),
}));
