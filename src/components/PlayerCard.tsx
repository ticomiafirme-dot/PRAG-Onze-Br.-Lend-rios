import { useState } from 'react';
import type { Card, Position } from '../data/types';
import { decadeLabel, POSITION_NAMES } from '../data/types';
import { CLUB_BY_ID } from '../data/clubs';
import { Crest } from './Crest';
import { Flag } from './Flag';

export type Tier = 'lenda' | 'idolo' | 'craque' | 'titular' | 'elenco';

export function tierOf(ovr: number): Tier {
  if (ovr >= 90) return 'lenda';
  if (ovr >= 85) return 'idolo';
  if (ovr >= 80) return 'craque';
  if (ovr >= 75) return 'titular';
  return 'elenco';
}

export const TIER_LABEL: Record<Tier, string> = {
  lenda: 'Lenda',
  idolo: 'Ídolo',
  craque: 'Craque',
  titular: 'Titular',
  elenco: 'Elenco',
};

export function initials(name: string): string {
  const parts = name.replace(/\(.*\)/, '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PlayerAvatar({ card, size = 64 }: { card: Card; size?: number }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const club = CLUB_BY_ID[card.club];
  const photo = card.player.photo?.url;
  // As iniciais ficam sempre por baixo: aparecem enquanto a foto carrega ou se ela falhar.
  return (
    <span className="avatar-wrap" style={{ width: size, height: size }}>
      <span
        className="avatar-fallback"
        style={{
          width: size,
          height: size,
          background: `linear-gradient(145deg, ${club.colors.primary}, ${club.colors.secondary === '#ffffff' ? '#1b2c57' : club.colors.secondary})`,
          fontSize: size * 0.36,
        }}
        aria-hidden="true"
      >
        {initials(card.player.name)}
      </span>
      {photo && !failed && (
        <img
          className={`avatar-img ${loaded ? 'is-loaded' : ''}`}
          src={photo}
          alt={card.player.name}
          width={size}
          height={size}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
        />
      )}
    </span>
  );
}

interface Props {
  card: Card;
  size?: 'sm' | 'md' | 'lg';
  /** Overall a exibir (ex.: efetivo com capitão/química). */
  overall?: number;
  /** Categoria da vaga em que está escalado (padrão: a categoria principal). */
  pos?: Position;
  captain?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  showClub?: boolean;
  delay?: number;
  note?: string;
}

export function PlayerCard({ card, size = 'md', overall, pos, captain, selected, disabled, onClick, showClub = true, delay = 0, note }: Props) {
  const ovr = overall ?? card.overall;
  const tier = tierOf(card.overall);
  const club = CLUB_BY_ID[card.club];
  const position = pos ?? card.positions[0];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`pcard pcard-${size} tier-${tier} ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      style={{ animationDelay: `${delay}ms`, ['--club' as string]: club.colors.primary }}
      title={`${card.player.name} — ${POSITION_NAMES[position]} · ${decadeLabel(card.decade)} · ${club.name}`}
      {...(onClick ? { type: 'button', disabled } : {})}
    >
      <span className="pcard-shine" aria-hidden="true" />
      <span className="pcard-top">
        <span className="pcard-ovr">
          <span className="pcard-ovr-num">{ovr}</span>
          <span className="pcard-pos">{position}</span>
        </span>
        <span className="pcard-flag">
          <Flag code={card.player.nationality} size={size === 'sm' ? 11 : 14} />
        </span>
      </span>
      <span className="pcard-photo">
        <PlayerAvatar card={card} size={size === 'lg' ? 96 : size === 'sm' ? 44 : 70} />
        {captain && (
          <span className="armband" title="Capitão">
            C
          </span>
        )}
      </span>
      <span className="pcard-name">{card.player.name}</span>
      <span className="pcard-meta">
        <span className="pcard-decade">{card.decade.slice(2)}</span>
        {showClub && <Crest club={club} size={size === 'sm' ? 12 : 15} />}
        {size !== 'sm' && <span className="pcard-tier">{TIER_LABEL[tier]}</span>}
      </span>
      {note && <span className="pcard-note">{note}</span>}
    </Tag>
  );
}
