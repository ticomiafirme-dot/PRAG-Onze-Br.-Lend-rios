// Medalha de conquista (SVG), nas cores da raridade.
import { useId } from 'react';
import type { AchievementTier } from '../history/types';
import { TIER_COLORS } from '../history/tiers';
import { ICONS, type IconName } from './icons';

export function Medal({ tier, icon, size = 96, locked = false, className }: { tier: AchievementTier; icon: IconName; size?: number; locked?: boolean; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const t = TIER_COLORS[tier];
  const iconColor = tier === 'prata' ? '#1b2c57' : tier === 'lendaria' ? '#ffffff' : t.dark;
  return (
    <svg className={`medal medal-${tier} ${locked ? 'is-locked' : ''} ${className ?? ''}`} width={size} height={size * 1.3} viewBox="0 0 100 130" aria-hidden="true">
      <defs>
        <linearGradient id={`rim-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={tier === 'lendaria' ? '#fff1a8' : t.light} />
          <stop offset="0.5" stopColor={tier === 'lendaria' ? '#ffcf1f' : t.dark} />
          <stop offset="1" stopColor={tier === 'lendaria' ? '#d99a00' : t.mid} />
        </linearGradient>
        <radialGradient id={`disc-${uid}`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={t.light} />
          <stop offset="0.55" stopColor={t.mid} />
          <stop offset="1" stopColor={t.dark} />
        </radialGradient>
        <radialGradient id={`glow-${uid}`}>
          <stop offset="0.45" stopColor={t.glow} />
          <stop offset="1" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>
      {!locked && <circle cx="50" cy="84" r="50" fill={`url(#glow-${uid})`} />}
      <path d="M24 2 H46 L56 52 H38 Z" fill={t.ribbon[0]} />
      <path d="M54 2 H76 L62 52 H44 Z" fill={t.ribbon[1]} />
      <circle cx="50" cy="84" r="34" fill={`url(#rim-${uid})`} />
      <circle cx="50" cy="84" r="28.5" fill={`url(#disc-${uid})`} />
      <svg x="33" y="67" width="34" height="34" viewBox="0 0 24 24">
        <path d={ICONS[icon]} fill="rgba(0,0,0,0.35)" fillRule="evenodd" transform="translate(0.6 0.8)" />
        <path d={ICONS[icon]} fill={iconColor} fillRule="evenodd" />
      </svg>
      <ellipse cx="39" cy="71" rx="11" ry="4.5" fill="#fff" opacity="0.35" transform="rotate(-34 39 71)" />
    </svg>
  );
}
