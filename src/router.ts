// Roteador mínimo baseado em hash (funciona em qualquer hospedagem estática).
import { useEffect, useState } from 'react';

export interface Route {
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
}

const PATTERNS: { name: string; re: RegExp; keys: string[] }[] = [
  { name: '/clube/:id', re: /^\/clube\/([^/]+)$/, keys: ['id'] },
];

function parse(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [p, q] = raw.split('?');
  const path = p.startsWith('/') ? p : '/' + p;
  for (const pat of PATTERNS) {
    const m = path.match(pat.re);
    if (m) {
      const params: Record<string, string> = {};
      pat.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { path: pat.name, params, query: new URLSearchParams(q ?? '') };
    }
  }
  return { path, params: {}, query: new URLSearchParams(q ?? '') };
}

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  const hash = '#' + to;
  if (opts.replace) {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else if (location.hash !== hash) {
    location.hash = hash;
  }
  window.scrollTo({ top: 0 });
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const on = () => setRoute(parse(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
