import type { Card, Position } from '../data/types';
import { decadeLabel, POSITION_NAMES } from '../data/types';
import { CLUB_BY_ID } from '../data/clubs';
import { Crest } from './Crest';
import { Flag } from './Flag';
import { PlayerFace } from './PlayerFace';
import { tierOf, TIER_LABEL } from './cardTier';

export { tierOf, TIER_LABEL, type Tier } from './cardTier';

export function initials(name: string): string {
  const parts = name.replace(/\(.*\)/, '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Avatar ilustrado do jogador (clube e época da carta, fundo na cor da carta). */
export function PlayerAvatar({ card, size = 64 }: { card: Card; size?: number }) {
  return <PlayerFace card={card} size={size} className="avatar-wrap" />;
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
