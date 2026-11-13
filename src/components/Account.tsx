// Peças da conta: botão "Entrar com Google", avisos de visitante/sessão e o
// indicador de sincronização.
import { useState } from 'react';
import { useAuth } from '../cloud/auth';
import { cloudEnabled } from '../cloud/config';
import { hasUnsyncedChanges, signInWithGoogle, signOut } from '../cloud/session';
import { useSync } from '../cloud/syncState';
import { Modal } from './ui';

/** Logotipo "G" oficial do Google (quatro cores). */
export function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function GoogleButton({ label = 'Entrar com Google', block = false }: { label?: string; block?: boolean }) {
  const status = useAuth((s) => s.status);
  if (!cloudEnabled) return null;
  return (
    <button className={`btn btn-google ${block ? 'btn-block' : ''}`} onClick={() => void signInWithGoogle()} disabled={status === 'loading'}>
      <span className="google-g">
        <GoogleG size={20} />
      </span>
      {label}
    </button>
  );
}

/** Aviso no topo das páginas da conta: visitante, sessão expirada ou erro de login. */
export function AccountBanner() {
  const { status, error } = useAuth();
  if (status === 'signed-in' || status === 'loading') return null;
  if (status === 'expired')
    return (
      <div className="account-banner is-warn" role="status">
        <span>
          <strong>Sua sessão expirou.</strong> Seu progresso continua guardado neste aparelho e será enviado à nuvem assim que você entrar de novo.
        </span>
        <GoogleButton label="Entrar novamente" />
      </div>
    );
  return (
    <div className={`account-banner ${error ? 'is-error' : ''}`} role="status">
      <span>
        {error ? (
          <>
            <strong>Não foi possível entrar com Google.</strong> {error}{' '}
          </>
        ) : null}
        {cloudEnabled ? (
          <>
            Você está como <strong>visitante</strong>: os dados ficam só neste aparelho. Entre com Google para salvar na nuvem e continuar em qualquer dispositivo.
          </>
        ) : (
          <>
            Você está como <strong>visitante</strong>: o histórico fica salvo neste aparelho. O login com Google funciona na versão web do jogo.
          </>
        )}
      </span>
      <GoogleButton />
    </div>
  );
}

const SYNC_TEXT: Record<string, string> = {
  idle: 'Sincronizado',
  synced: 'Sincronizado',
  saving: 'Salvando…',
  loading: 'Carregando…',
  offline: 'Sem conexão · salvo no aparelho',
  error: 'Erro de sincronização',
};

/** Indicador de sincronização (cabeçalho). */
export function SyncIndicator() {
  const status = useAuth((s) => s.status);
  const { state, pending, retry } = useSync();
  if (status !== 'signed-in') return null;
  // com alterações por enviar, nunca mostra "Sincronizado"
  const shown = pending && (state === 'idle' || state === 'synced') ? 'saving' : state;
  const label = SYNC_TEXT[shown] ?? '';
  return (
    <button
      className={`sync-chip is-${shown}`}
      onClick={state === 'error' || state === 'offline' ? retry : undefined}
      title={state === 'error' || state === 'offline' ? 'Tentar sincronizar agora' : label}
      aria-live="polite"
    >
      <i aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

/** Foto da conta (do Google), com as iniciais enquanto carrega ou se falhar. */
export function UserAvatar({ size = 36 }: { size?: number }) {
  const user = useAuth((s) => s.user);
  const [failed, setFailed] = useState(false);
  const initials = (user?.name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <span className="user-avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      <span aria-hidden="true">{initials}</span>
      {user?.avatarUrl && !failed && <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
    </span>
  );
}

/** Sair da conta (avisa se ainda há alterações a enviar). */
export function SignOutButton({ className = 'btn btn-ghost', onDone }: { className?: string; onDone?: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    await signOut();
    setBusy(false);
    setConfirming(false);
    onDone?.();
  };
  return (
    <>
      <button className={className} disabled={busy} onClick={() => (hasUnsyncedChanges() ? setConfirming(true) : void go())}>
        {busy ? 'Saindo…' : 'Sair da conta'}
      </button>
      {confirming && (
        <Modal label="Sair da conta" onClose={() => setConfirming(false)}>
          <h3 style={{ fontSize: 24, marginBottom: 8 }}>Sair da conta?</h3>
          <p className="muted">
            Ainda há alterações que não chegaram à nuvem. Elas ficam guardadas neste aparelho e serão enviadas automaticamente quando você entrar de novo com esta conta.
          </p>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14, gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setConfirming(false)}>
              Cancelar
            </button>
            <button className="btn btn-gold" disabled={busy} onClick={() => void go()}>
              Sair mesmo assim
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
