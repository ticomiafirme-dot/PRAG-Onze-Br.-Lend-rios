// Identidade visual do Onze BR Lendário PRAG: a logo oficial do jogo.
import logo160 from '../assets/logo-prag-160.png';
import logo512 from '../assets/logo-prag-512.png';

/** Logo em alta resolução, usada também nas artes de compartilhamento. */
export const LOGO_URL = logo512;

export function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <img
      className="logo-mark"
      src={size > 72 ? logo512 : logo160}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
    />
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`logo ${compact ? 'logo-compact' : ''}`}>
      <LogoMark size={compact ? 44 : 52} />
      <span className="logo-text">
        <span className="logo-top">
          Onze BR <span className="logo-prag">PRAG</span>
        </span>
        <span className="logo-bottom">Lendário</span>
      </span>
    </span>
  );
}
