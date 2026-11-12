// Emblema original de cada clube (forma + padrão + sigla nas cores do clube).
// Não reproduz os escudos oficiais.
import { useId } from 'react';
import type { Club } from '../data/types';

const SHAPES: Record<string, string> = {
  shield: 'M50 4 L92 15 V56 C92 84 73 103 50 116 C27 103 8 84 8 56 V15 Z',
  classic: 'M9 8 H91 V58 C91 88 71 105 50 116 C29 105 9 88 9 58 Z',
  pointed: 'M50 3 L94 20 L87 80 L50 117 L13 80 L6 20 Z',
  badge: 'M50 4 L92 27 V91 L50 116 L8 91 V27 Z',
  round: 'M50 12 A48 48 0 1 1 49.99 12 Z',
};

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function contrastOn(hex: string): string {
  return luminance(hex) > 0.6 ? '#0b1530' : '#ffffff';
}

function Pattern({ club }: { club: Club }) {
  const { primary: p, secondary: s } = club.colors;
  switch (club.crest.pattern) {
    case 'stripes':
      return (
        <g>
          <rect x="0" y="0" width="100" height="120" fill={p} />
          {[0, 2, 4, 6].map((i) => (
            <rect key={i} x={7 + i * 13} y="0" width="13" height="120" fill={s} />
          ))}
        </g>
      );
    case 'hoops':
      return (
        <g>
          <rect x="0" y="0" width="100" height="120" fill={p} />
          {[0, 2, 4, 6, 8].map((i) => (
            <rect key={i} x="0" y={i * 13} width="100" height="13" fill={s} />
          ))}
        </g>
      );
    case 'half':
      return (
        <g>
          <rect x="0" y="0" width="50" height="120" fill={p} />
          <rect x="50" y="0" width="50" height="120" fill={s} />
          <rect x="0" y="0" width="100" height="36" fill={club.colors.accent} />
        </g>
      );
    case 'diagonal':
      return (
        <g>
          <rect x="0" y="0" width="100" height="120" fill={p} />
          <path d="M-10 22 L22 -10 L110 78 L78 110 Z" fill={s} opacity="0.95" />
        </g>
      );
    case 'cross':
      return (
        <g>
          <rect x="0" y="0" width="100" height="120" fill={p} />
          <rect x="44" y="0" width="12" height="120" fill={s} opacity="0.18" />
          <rect x="0" y="54" width="100" height="12" fill={s} opacity="0.18" />
        </g>
      );
    case 'chevron':
      return (
        <g>
          <rect x="0" y="0" width="100" height="120" fill={p} />
          <path d="M0 40 L50 70 L100 40 L100 62 L50 92 L0 62 Z" fill={s} />
        </g>
      );
    case 'ring':
      return (
        <g>
          <rect x="0" y="0" width="100" height="120" fill={s} />
          <circle cx="50" cy="60" r="38" fill="none" stroke={p} strokeWidth="14" />
        </g>
      );
    default:
      return <rect x="0" y="0" width="100" height="120" fill={p} />;
  }
}

const STAR = 'M0 -6 L1.76 -1.85 L5.7 -1.85 L2.5 0.7 L3.53 4.85 L0 2.4 L-3.53 4.85 L-2.5 0.7 L-5.7 -1.85 L-1.76 -1.85 Z';

export function Crest({ club, size = 48, className }: { club: Club; size?: number; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const shape = SHAPES[club.crest.shape] ?? SHAPES.shield;
  const label = club.crest.initials;
  const bandColor = club.crest.pattern === 'ring' ? club.colors.primary : club.colors.primary;
  const textColor = contrastOn(bandColor);
  const fontSize = label.length >= 5 ? 15 : label.length === 4 ? 18 : 22;
  const stars = club.crest.stars ?? 0;
  return (
    <svg
      className={className}
      width={size}
      height={size * 1.2}
      viewBox="0 0 100 120"
      role="img"
      aria-label={`Emblema do ${club.name}`}
    >
      <defs>
        <clipPath id={`c-${uid}`}>
          <path d={shape} />
        </clipPath>
        <linearGradient id={`g-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#c-${uid})`}>
        <Pattern club={club} />
        <rect x="0" y="48" width="100" height="26" fill={bandColor} opacity="0.92" />
        <rect x="0" y="0" width="100" height="120" fill={`url(#g-${uid})`} />
      </g>
      <path d={shape} fill="none" stroke="#e8edf3" strokeWidth="4" />
      <path d={shape} fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="1" />
      <text
        x="50"
        y="66.5"
        textAnchor="middle"
        fontFamily="'Barlow Condensed', 'Arial Narrow', sans-serif"
        fontWeight="800"
        fontSize={fontSize}
        fill={textColor}
        letterSpacing="0.5"
      >
        {label}
      </text>
      {stars > 0 &&
        Array.from({ length: stars }).map((_, i) => {
          const spread = 13;
          const x = 50 + (i - (stars - 1) / 2) * spread;
          const y = club.crest.shape === 'round' ? 26 : 30;
          return <path key={i} d={STAR} transform={`translate(${x} ${y}) scale(${stars > 2 ? 0.9 : 1.2})`} fill="#ffd23a" stroke="#7a5a00" strokeWidth="0.4" />;
        })}
    </svg>
  );
}
