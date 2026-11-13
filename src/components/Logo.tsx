// Identidade visual original do Onze BR Lendário PRAG.
/** Traços do emblema (viewBox 100 × 112), também usados na arte de compartilhamento. */
export const LOGO_PATHS = {
  outer: 'M50 3 L93 22 L86 78 L50 109 L14 78 L7 22 Z',
  inner: 'M50 11 L85 27 L79 74 L50 100 L21 74 L15 27 Z',
  star: 'M50 18 L53.5 26 L62 26.6 L55.4 32 L57.6 40.3 L50 35.6 L42.4 40.3 L44.6 32 L38 26.6 L46.5 26 Z',
  smile: 'M24 88 Q50 98 76 88',
};

export function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 100 112" aria-hidden="true">
      <defs>
        <linearGradient id="lm-silver" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#c3cad3" />
          <stop offset="0.7" stopColor="#f4f6f9" />
          <stop offset="1" stopColor="#8d97a5" />
        </linearGradient>
        <linearGradient id="lm-blue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2563d6" />
          <stop offset="1" stopColor="#0a1d47" />
        </linearGradient>
        <linearGradient id="lm-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1a8" />
          <stop offset="0.45" stopColor="#ffcf1f" />
          <stop offset="1" stopColor="#d99a00" />
        </linearGradient>
      </defs>
      <path d={LOGO_PATHS.outer} fill="url(#lm-silver)" />
      <path d={LOGO_PATHS.inner} fill="url(#lm-blue)" />
      <path d={LOGO_PATHS.star} fill="url(#lm-gold)" />
      <text x="50" y="82" textAnchor="middle" fontFamily="'Barlow Condensed', 'Arial Narrow', sans-serif" fontWeight="800" fontSize="46" fill="url(#lm-gold)" letterSpacing="-2">
        11
      </text>
      <path d={LOGO_PATHS.smile} stroke="#22c55e" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`logo ${compact ? 'logo-compact' : ''}`}>
      <LogoMark size={compact ? 30 : 44} />
      <span className="logo-text">
        <span className="logo-top">
          Onze BR <span className="logo-prag">PRAG</span>
        </span>
        <span className="logo-bottom">Lendário</span>
      </span>
    </span>
  );
}
