// Roteador mínimo baseado em hash, no formato "#nome" (ex.: #clubes, #clube-santos,
// #ranking). Funciona em qualquer hospedagem estática e também dentro de páginas
// publicadas em sandbox, que só repassam hashes simples. Hashes antigos no
// formato "#/caminho" continuam sendo aceitos.
import { useEffect, useState } from 'react';

export interface Route {
  path: string;
  params: Record<string, string>;
}

/** Converte um caminho interno ("/clube/santos") no hash correspondente ("#clube-santos"). */
export function toHash(path: string): string {
  if (!path || path === '/') return '#inicio';
  const club = path.match(/^\/clube\/(.+)$/);
  if (club) return `#clube-${club[1]}`;
  const season = path.match(/^\/temporada\/(.+)$/);
  if (season) return `#temporada-${season[1]}`;
  return '#' + path.replace(/^\//, '');
}

export function parseHash(hash: string): Route {
  let raw = hash.replace(/^#/, '');
  if (raw.startsWith('/')) raw = raw.slice(1); // compatibilidade com "#/caminho"
  raw = raw.split('?')[0];
  if (raw === '' || raw === 'inicio') return { path: '/', params: {} };
  const legacyClub = raw.match(/^clube\/(.+)$/);
  if (legacyClub) return { path: '/clube/:id', params: { id: decodeURIComponent(legacyClub[1]) } };
  if (raw.startsWith('clube-')) return { path: '/clube/:id', params: { id: decodeURIComponent(raw.slice(6)) } };
  if (raw.startsWith('temporada-')) return { path: '/temporada/:id', params: { id: decodeURIComponent(raw.slice(10)) } };
  return { path: '/' + raw, params: {} };
}

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  const hash = toHash(to);
  if (opts.replace) {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else if (location.hash !== hash) {
    location.hash = hash;
  }
  window.scrollTo({ top: 0 });
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
