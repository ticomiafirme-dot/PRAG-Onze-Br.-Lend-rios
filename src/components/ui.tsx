import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Logo } from './Logo';
import { navigate, toHash, useRoute } from '../router';
import { tierOf } from './PlayerCard';
import { LINK_COLORS } from './Pitch';

export function Header() {
  const route = useRoute();
  const link = (to: string, label: string, cls = '') => (
    <a href={toHash(to)} className={`nav-link ${route.path === to ? 'active' : ''} ${cls}`}>
      {label}
    </a>
  );
  return (
    <header className="header">
      <div className="header-inner">
        <a href="#inicio" className="logo-link" aria-label="Início">
          <Logo compact />
        </a>
        <nav aria-label="Principal">
          {link('/', 'Jogar')}
          {link('/ranking', 'Ranking')}
          {link('/como-jogar', 'Como jogar', 'nav-hide-sm')}
          {link('/creditos', 'Fontes', 'nav-hide-sm')}
        </nav>
      </div>
    </header>
  );
}

export function BackLink({ to, label = 'Voltar' }: { to: string; label?: string }) {
  return (
    <button className="btn btn-ghost btn-sm" onClick={() => navigate(to)}>
      ← {label}
    </button>
  );
}

export function OvrBadge({ value }: { value: number }) {
  return <span className={`ovr-badge tier-${tierOf(value)}`}>{value}</span>;
}

export function chemColor(chem: number, max = 10): string {
  const r = chem / max;
  if (r >= 0.85) return LINK_COLORS[3];
  if (r >= 0.6) return LINK_COLORS[2];
  if (r >= 0.35) return LINK_COLORS[1];
  return LINK_COLORS[0];
}

export function Meter({ value, max = 100, color }: { value: number; max?: number; color?: string }) {
  return (
    <div className="meter" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <span style={{ width: `${Math.max(0, Math.min(100, (100 * value) / max))}%`, background: color ?? chemColor(value, max) }} />
    </div>
  );
}

export function Confetti({ count = 90 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        dur: 2.4 + Math.random() * 2.2,
        dx: (Math.random() - 0.5) * 240,
        rot: (Math.random() - 0.5) * 1080,
        color: ['#ffcf1f', '#ffffff', '#2563d6', '#22c55e', '#dfe4ea', '#f2b705'][i % 6],
      })),
    [count],
  );
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOn(false), 6500);
    return () => clearTimeout(t);
  }, []);
  if (!on) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i
          key={i}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            ['--dx' as string]: `${p.dx}px`,
            ['--rot' as string]: `${p.rot}deg`,
          }}
        />
      ))}
    </div>
  );
}

export function useToast(): [ReactNode, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  const node = msg ? (
    <div className="toast" role="status">
      {msg}
    </div>
  ) : null;
  return [node, setMsg];
}

export function Modal({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/** Garante que existe uma partida em andamento; se não, volta ao início. */
export function NeedRun({ ok, children }: { ok: boolean; children: ReactNode }) {
  useEffect(() => {
    if (!ok) navigate('/', { replace: true });
  }, [ok]);
  return ok ? <>{children}</> : null;
}
