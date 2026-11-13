// Emblema original de cada clube (forma + padrão + sigla nas cores do clube).
// Não reproduz os escudos oficiais. A geometria fica em crestGeometry.ts, a mesma
// usada pela arte de compartilhamento.
import { useId } from 'react';
import type { Club } from '../data/types';
import { crestBand, crestPattern, crestShape, crestStars, STAR_PATH, type CrestOp } from './crestGeometry';

export { contrastOn } from './crestGeometry';

function Op({ op }: { op: CrestOp }) {
  switch (op.kind) {
    case 'rect':
      return <rect x={op.x} y={op.y} width={op.w} height={op.h} fill={op.fill} opacity={op.opacity} />;
    case 'path':
      return <path d={op.d} fill={op.fill} opacity={op.opacity} />;
    case 'ring':
      return <circle cx={op.cx} cy={op.cy} r={op.r} fill="none" stroke={op.stroke} strokeWidth={op.width} />;
  }
}

export function Crest({ club, size = 48, className }: { club: Club; size?: number; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const shape = crestShape(club);
  const band = crestBand(club);
  return (
    <svg className={className} width={size} height={size * 1.2} viewBox="0 0 100 120" role="img" aria-label={`Emblema do ${club.name}`}>
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
        {crestPattern(club).map((op, i) => (
          <Op key={i} op={op} />
        ))}
        <rect x="0" y="48" width="100" height="26" fill={band.color} opacity="0.92" />
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
        fontSize={band.fontSize}
        fill={band.textColor}
        letterSpacing="0.5"
      >
        {band.label}
      </text>
      {crestStars(club).map((s, i) => (
        <path key={i} d={STAR_PATH} transform={`translate(${s.x} ${s.y}) scale(${s.scale})`} fill="#ffd23a" stroke="#7a5a00" strokeWidth="0.4" />
      ))}
    </svg>
  );
}
