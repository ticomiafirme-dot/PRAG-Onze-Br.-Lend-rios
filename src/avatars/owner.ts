// Avatar exclusivo do fundador do jogo (conta com o título "Presidente").
// Mesmo estilo dos avatares dos jogadores, com traços próprios (cabelo
// cacheado curto, bigode fino e cavanhaque, óculos e corrente com cruz),
// camisa preta e dourada do PRAG e uma moldura que nenhum outro avatar usa.
import type { Club } from '../data/types';
import { decodeLook, type Look } from './looks';
import type { Kit } from './kits';
import { avatarSvg } from './svg';

/** Chave guardada no perfil (o banco só aceita para contas com título especial). */
export const OWNER_AVATAR_KEY = 'presidente@prag@2020s';

export const OWNER_AVATAR_LABEL = 'Presidente PRAG';

const OWNER_KIT: Kit = { pattern: 'chest-bands', base: '#141414', colors: ['#ffcf1f'], trim: '#ffcf1f' };

// emblema no peito: o "PRAG" em preto e dourado
const PRAG_BADGE = {
  id: 'prag',
  name: 'PRAG',
  colors: { primary: '#ffcf1f', secondary: '#141414', accent: '#ffcf1f' },
  crest: { shape: 'round', pattern: 'ring', initials: 'PRAG' },
} as unknown as Club;

function ownerLook(): Look {
  const look = decodeLook('fundador-prag', '4Ckg=')!;
  return { ...look, face: 'oval', turn: -1.5, brow: 1, nose: 1 };
}

let cached: string | null = null;

export function ownerAvatarSvg(): string {
  cached ??= avatarSvg({ look: ownerLook(), kit: OWNER_KIT, club: PRAG_BADGE, decade: '2020s', tier: 'lenda', seed: 11, extras: { glasses: true, chain: true, frame: 'fundador' } });
  return cached;
}

let url: string | null = null;

export function ownerAvatarUrl(): string {
  url ??= `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ownerAvatarSvg())}`;
  return url;
}

export function isOwnerAvatar(key: string | null | undefined): boolean {
  return key === OWNER_AVATAR_KEY;
}
