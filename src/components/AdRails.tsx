// Anúncios do Google AdSense só nas laterais da tela, fora da área do jogo
// (nada por cima do draft, das partidas ou dos menus). Aparecem apenas em
// telas largas, onde sobra espaço dos dois lados do conteúdo; em celulares e
// notebooks pequenos não há anúncio. Ficam desligados até existir o código do
// bloco de anúncio (VITE_ADSENSE_SLOT, criado no painel do AdSense).
import { useEffect, useRef, useState } from 'react';

const CLIENT = 'ca-pub-6625644430029714';
const SLOT = (import.meta.env.VITE_ADSENSE_SLOT as string | undefined)?.trim() || '';
/** Conteúdo do jogo (1200px) + duas colunas de 160px com folga. */
const WIDE = '(min-width: 1600px)';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

function useWide(): boolean {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(WIDE).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(WIDE);
    if (!mq) return;
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return !!wide;
}

function AdRail({ side }: { side: 'left' | 'right' }) {
  const pushed = useRef(false);
  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* bloqueador de anúncios ou script indisponível: o jogo segue normal */
    }
  }, []);
  return (
    <aside className={`ad-rail ad-rail-${side}`} aria-label="Publicidade">
      <span className="ad-rail-label">Publicidade</span>
      <ins className="adsbygoogle" style={{ display: 'inline-block', width: 160, height: 600 }} data-ad-client={CLIENT} data-ad-slot={SLOT} />
    </aside>
  );
}

export function AdRails() {
  const wide = useWide();
  if (!SLOT || !wide) return null;
  return (
    <>
      <AdRail side="left" />
      <AdRail side="right" />
    </>
  );
}
