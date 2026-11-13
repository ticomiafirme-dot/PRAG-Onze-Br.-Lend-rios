// Avatar ilustrado de um jogador no clube e na década da carta. Usa a
// ilustração própria quando existe (src/assets/players/...) e, se ela não
// carregar, volta para o avatar gerado: nunca fica imagem quebrada.
import { useState } from 'react';
import { db } from '../data/db';
import type { Card } from '../data/types';
import { avatarDataUrl, avatarFrameUrls, avatarRefOf, customAvatar, type AvatarRef } from '../avatars';
import { tierOf, type Tier } from './cardTier';

export function AvatarImage({ avatar, size, alt, className = '' }: { avatar: AvatarRef; size: number; alt: string; className?: string }) {
  const custom = customAvatar(avatar);
  const [failed, setFailed] = useState(false);
  if (custom && !failed) {
    const { frame, ring } = avatarFrameUrls(avatar);
    return (
      <span className={`pavatar pavatar-custom ${className}`} style={{ width: size, height: size }} role="img" aria-label={alt}>
        <img src={frame} alt="" aria-hidden="true" draggable={false} />
        <img className="pavatar-art" src={custom} alt="" aria-hidden="true" draggable={false} loading="lazy" onError={() => setFailed(true)} />
        <img src={ring} alt="" aria-hidden="true" draggable={false} />
      </span>
    );
  }
  return <img className={`pavatar ${className}`} src={avatarDataUrl(avatar)} width={size} height={size} alt={alt} draggable={false} decoding="async" loading="lazy" />;
}

/** Avatar de uma carta (jogador + clube + década). */
export function PlayerFace({ card, size = 32, tier, className }: { card: Card; size?: number; tier?: Tier; className?: string }) {
  return <AvatarImage avatar={avatarRefOf(card, tier ?? tierOf(card.overall))} size={size} alt={card.player.name} className={className} />;
}

/** Avatar a partir da chave da carta (escalações salvas, estatísticas). */
export function PlayerFaceByKey({ cardKey, size = 28, className }: { cardKey: string | null | undefined; size?: number; className?: string }) {
  const card = cardKey ? db.cardByKey.get(cardKey) : undefined;
  if (!card) return <span className={`pavatar pavatar-empty ${className ?? ''}`} style={{ width: size, height: size }} aria-hidden="true" />;
  return <PlayerFace card={card} size={size} className={className} />;
}
