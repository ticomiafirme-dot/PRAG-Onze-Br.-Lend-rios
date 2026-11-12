import type { ReactNode } from 'react';
import { getFormation, type FormationId, type Slot } from '../data/formations';
import type { ChemLink } from '../engine/chemistry';

export const LINK_COLORS = ['#ef4444', '#f59e0b', '#a3e635', '#22c55e'];

interface Props {
  formationId: FormationId;
  renderSlot: (slot: Slot) => ReactNode;
  links?: ChemLink[];
  compact?: boolean;
  className?: string;
}

/** Campo de futebol vertical com posições absolutas e linhas de química. */
export function Pitch({ formationId, renderSlot, links, compact, className }: Props) {
  const formation = getFormation(formationId);
  const pos = new Map(formation.slots.map((s) => [s.id, s]));
  return (
    <div className={`pitch ${compact ? 'pitch-compact' : ''} ${className ?? ''}`}>
      <svg className="pitch-lines" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
        {Array.from({ length: 10 }).map((_, i) => (
          <rect key={i} x="0" y={i * 14} width="100" height="14" fill={i % 2 ? 'var(--pitch-1)' : 'var(--pitch-2)'} />
        ))}
        <g fill="none" stroke="var(--pitch-line)" strokeWidth="0.5">
          <rect x="4" y="4" width="92" height="132" />
          <line x1="4" y1="70" x2="96" y2="70" />
          <circle cx="50" cy="70" r="11" />
          <circle cx="50" cy="70" r="0.8" fill="var(--pitch-line)" />
          <rect x="24" y="4" width="52" height="20" />
          <rect x="37" y="4" width="26" height="7.5" />
          <path d="M41 24 A10 10 0 0 0 59 24" />
          <rect x="24" y="116" width="52" height="20" />
          <rect x="37" y="128.5" width="26" height="7.5" />
          <path d="M41 116 A10 10 0 0 1 59 116" />
        </g>
      </svg>
      {links && links.length > 0 && (
        <svg className="pitch-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {links.map((l) => {
            const a = pos.get(l.a)!;
            const b = pos.get(l.b)!;
            return (
              <line
                key={`${l.a}-${l.b}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={LINK_COLORS[l.value]}
                strokeWidth={l.captain ? 4 : 3}
                strokeDasharray={l.value <= 1 ? '5 5' : undefined}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                opacity={0.9}
              />
            );
          })}
        </svg>
      )}
      {formation.slots.map((s) => (
        <div key={s.id} className="pitch-slot" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
          {renderSlot(s)}
        </div>
      ))}
    </div>
  );
}
