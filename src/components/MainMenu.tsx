// Menu principal (gaveta lateral) e a área da conta no cabeçalho.
import { useEffect } from 'react';
import { useAuth } from '../cloud/auth';
import { cloudEnabled } from '../cloud/config';
import { navigate, toHash, useRoute } from '../router';
import { resumeRoute, useGame } from '../state/store';
import { GoogleButton, ProfileAvatar, SignOutButton, StaffBadge, SyncIndicator, UserAvatar } from './Account';
import { useProfileAvatar } from '../cloud/profile';
import { Icon } from './Icon';
import type { IconName } from './icons';

const ITEMS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Início', icon: 'museum' },
  { to: '/jogar', label: 'Jogar', icon: 'ball' },
  { to: '/perfil', label: 'Meu Perfil', icon: 'user' },
  { to: '/historico', label: 'Meu Histórico', icon: 'history' },
  { to: '/conquistas', label: 'Conquistas', icon: 'medal' },
  { to: '/recordes', label: 'Meus Recordes', icon: 'chart' },
  { to: '/hall', label: 'Hall dos Lendários', icon: 'trophy' },
];

const MORE: { to: string; label: string }[] = [
  { to: '/ranking', label: 'Ranking' },
  { to: '/como-jogar', label: 'Como jogar' },
  { to: '/creditos', label: 'Fontes' },
];

/** "Jogar": retoma a partida em andamento ou começa pela escolha do clube. */
export function goPlay(): void {
  const run = useGame.getState().run;
  navigate(run && run.phase !== 'finished' ? resumeRoute(run) : '/clubes');
}

export function MainMenu({ onClose }: { onClose: () => void }) {
  const route = useRoute();
  const { status, user } = useAuth();
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    document.body.classList.add('menu-open');
    return () => {
      window.removeEventListener('keydown', on);
      document.body.classList.remove('menu-open');
    };
  }, [onClose]);
  const go = (to: string) => {
    onClose();
    if (to === '/jogar') goPlay();
    else navigate(to);
  };
  return (
    <div className="menu-backdrop" onClick={onClose}>
      <nav className="menu-drawer" aria-label="Menu principal" onClick={(e) => e.stopPropagation()}>
        <div className="menu-account">
          {status === 'signed-in' && user ? (
            <>
              <UserAvatar size={48} />
              <div>
                <strong>{user.name}</strong>
                <StaffBadge small />
                <span className="dim">{user.email}</span>
              </div>
            </>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              <span className="row" style={{ gap: 10 }}>
                <ProfileAvatar size={44} />
                <strong>{status === 'expired' ? 'Sessão expirada' : 'Visitante'}</strong>
              </span>
              {cloudEnabled ? <GoogleButton label={status === 'expired' ? 'Entrar novamente' : 'Entrar com Google'} block /> : <span className="dim">Progresso salvo neste aparelho</span>}
            </div>
          )}
          <button className="menu-close" onClick={onClose} aria-label="Fechar menu">
            ×
          </button>
        </div>
        <ul className="menu-list">
          {ITEMS.map((it) => (
            <li key={it.to}>
              <button className={`menu-item ${route.path === it.to ? 'active' : ''} ${it.to === '/hall' ? 'is-gold' : ''}`} onClick={() => go(it.to)}>
                <Icon name={it.icon} size={20} />
                {it.label}
              </button>
            </li>
          ))}
        </ul>
        <ul className="menu-list menu-more">
          {MORE.map((it) => (
            <li key={it.to}>
              <a className={`menu-item ${route.path === it.to ? 'active' : ''}`} href={toHash(it.to)} onClick={onClose}>
                {it.label}
              </a>
            </li>
          ))}
        </ul>
        {status === 'signed-in' && (
          <div className="menu-foot">
            <SyncIndicator />
            <SignOutButton className="btn btn-ghost btn-block" onDone={onClose} />
          </div>
        )}
      </nav>
    </div>
  );
}

/** Lado direito do cabeçalho: foto e nome (logado) ou "Entrar com Google". */
/** Foto de perfil do visitante no cabeçalho (quando ele escolheu um avatar). */
function VisitorFace() {
  const chosen = useProfileAvatar();
  if (!chosen) return null;
  return (
    <a className="header-user" href="#perfil" aria-label="Meu Perfil">
      <ProfileAvatar size={34} />
    </a>
  );
}

export function HeaderAccount({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { status, user } = useAuth();
  if (status === 'signed-in' && user) {
    return (
      <div className="header-account">
        <SyncIndicator />
        <button className="header-user" onClick={onOpenMenu} aria-label={`Conta de ${user.name}`}>
          <UserAvatar size={34} />
          <span className="header-user-name">{user.name.split(' ')[0]}</span>
          <StaffBadge small />
        </button>
      </div>
    );
  }
  if (status === 'loading') return <div className="header-account" aria-busy="true"><span className="sk-avatar small" /></div>;
  return (
    <div className="header-account header-login">
      <GoogleButton label="Entrar" />
      <VisitorFace />
    </div>
  );
}
