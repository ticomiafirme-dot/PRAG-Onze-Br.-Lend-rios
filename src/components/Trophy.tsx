// Troféus ilustrados da galeria (um desenho por tipo de competição).
import { useId } from 'react';
import type { TrophyStyle } from '../history/competitions';

export function Trophy({ style, label, size = 120 }: { style: TrophyStyle; label?: string; size?: number }) {
  const uid = useId().replace(/:/g, '');
  const gold = `gold-${uid}`;
  const silver = `silver-${uid}`;
  const shine = `shine-${uid}`;
  return (
    <svg className={`trophy trophy-${style}`} width={size} height={size * 1.25} viewBox="0 0 100 125" role="img" aria-label={label ?? 'Troféu'}>
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#a87400" />
          <stop offset="0.35" stopColor="#ffe27a" />
          <stop offset="0.55" stopColor="#ffcf1f" />
          <stop offset="1" stopColor="#8a5f00" />
        </linearGradient>
        <linearGradient id={silver} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6b7480" />
          <stop offset="0.35" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#c3cad3" />
          <stop offset="1" stopColor="#5f6875" />
        </linearGradient>
        <linearGradient id={shine} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="118" rx="34" ry="5" fill="#000" opacity="0.35" />
      {style === 'brasileirao' && (
        <g>
          {/* taça com alças largas sobre pedestal azul */}
          <path d="M22 18 C10 18 8 40 26 46" fill="none" stroke={`url(#${gold})`} strokeWidth="5" />
          <path d="M78 18 C90 18 92 40 74 46" fill="none" stroke={`url(#${gold})`} strokeWidth="5" />
          <path d="M24 10 H76 V24 C76 48 64 60 50 62 C36 60 24 48 24 24 Z" fill={`url(#${gold})`} />
          <path d="M30 14 H44 V40 C38 36 32 28 30 14 Z" fill={`url(#${shine})`} />
          <rect x="45" y="62" width="10" height="16" fill={`url(#${gold})`} />
          <path d="M34 78 H66 L70 88 H30 Z" fill={`url(#${gold})`} />
          <rect x="26" y="88" width="48" height="26" rx="3" fill="#0a1d47" stroke={`url(#${gold})`} strokeWidth="2" />
          <rect x="30" y="96" width="40" height="8" rx="2" fill={`url(#${gold})`} opacity="0.85" />
          <path d="M50 22 L52.6 28 L59 28.4 L54 32.4 L55.6 38.6 L50 35 L44.4 38.6 L46 32.4 L41 28.4 L47.4 28 Z" fill="#0a1d47" opacity="0.85" />
        </g>
      )}
      {style === 'copa' && (
        <g>
          {/* troféu alto e esguio, prateado com detalhes dourados */}
          <path d="M32 8 H68 L64 38 C62 50 56 56 50 57 C44 56 38 50 36 38 Z" fill={`url(#${silver})`} />
          <path d="M37 12 H47 L45 40 C41 36 38 26 37 12 Z" fill={`url(#${shine})`} />
          <path d="M32 8 H68" stroke={`url(#${gold})`} strokeWidth="4" />
          <path d="M46 57 H54 L57 80 H43 Z" fill={`url(#${silver})`} />
          <circle cx="50" cy="66" r="5" fill={`url(#${gold})`} />
          <path d="M36 80 H64 L68 92 H32 Z" fill={`url(#${gold})`} />
          <rect x="30" y="92" width="40" height="22" rx="3" fill="#13213f" stroke={`url(#${silver})`} strokeWidth="2" />
          <rect x="35" y="99" width="30" height="7" rx="2" fill={`url(#${silver})`} opacity="0.8" />
        </g>
      )}
      {style === 'estadual' && (
        <g>
          {/* escudo comemorativo sobre base */}
          <path d="M50 6 L82 16 V46 C82 66 68 80 50 88 C32 80 18 66 18 46 V16 Z" fill={`url(#${silver})`} />
          <path d="M50 13 L76 21 V46 C76 62 65 73 50 80 C35 73 24 62 24 46 V21 Z" fill="#0a1d47" />
          <path d="M50 13 L76 21 V46 C76 62 65 73 50 80 C35 73 24 62 24 46 V21 Z" fill="none" stroke={`url(#${gold})`} strokeWidth="2.5" />
          {label && (
            <text x="50" y="56" textAnchor="middle" fontFamily="'Barlow Condensed', sans-serif" fontWeight="800" fontSize="20" fill="#ffcf1f" letterSpacing="1">
              {label}
            </text>
          )}
          <path d="M40 24 H48 V44 C44 40 41 33 40 24 Z" fill={`url(#${shine})`} opacity="0.5" />
          <path d="M38 90 H62 L66 100 H34 Z" fill={`url(#${gold})`} />
          <rect x="30" y="100" width="40" height="14" rx="3" fill="#13213f" stroke={`url(#${gold})`} strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}
