// Avatares dos jogadores: um por combinação jogador + clube (a gola acompanha a
// década da carta). Uma ilustração própria colocada em
// src/assets/players/<id-do-jogador>/<id-do-clube>.png (ou -<década>.png)
// substitui automaticamente o avatar gerado.
import { CLUB_BY_ID } from '../data/clubs';
import { PLAYERS_BY_CLUB } from '../data/db';
import { DECADES, type Card, type Decade } from '../data/types';
import { tierOf, type Tier } from '../components/cardTier';
import { goalkeeperKit, kitOf } from './kits';
import { hashString, lookFor, type Look } from './looks';
import { avatarSvg, frameSvg, ringSvg } from './svg';

const customFiles = import.meta.glob<string>('../assets/players/*/*.{png,webp,jpg,jpeg,svg}', { eager: true, query: '?url', import: 'default' });

/** Ilustrações próprias: "<jogador>/<clube>" ou "<jogador>/<clube>-<década>" → URL. */
const CUSTOM: Record<string, string> = Object.fromEntries(
  Object.entries(customFiles).map(([path, url]) => {
    const m = /players\/([^/]+)\/([^/.]+)\.[a-z]+$/.exec(path);
    return [m ? `${m[1]}/${m[2]}` : path, url];
  }),
);

let firstDecades: Record<string, Decade> | null = null;

/** Década em que cada jogador aparece pela primeira vez na base (define o visual gerado). */
function firstDecadeOf(id: string): Decade {
  if (!firstDecades) {
    firstDecades = {};
    for (const players of Object.values(PLAYERS_BY_CLUB)) {
      for (const p of players) {
        for (const d of Object.keys(p.eras) as Decade[]) {
          const cur = firstDecades[p.id];
          if (!cur || DECADES.indexOf(d) < DECADES.indexOf(cur)) firstDecades[p.id] = d;
        }
      }
    }
  }
  return firstDecades[id] ?? '1990s';
}

const lookCache = new Map<string, Look>();

/** Aparência do jogador naquele clube e década (como ele era na época). */
export function playerLook(id: string, clubId?: string, decade?: Decade): Look {
  const key = `${id}@${clubId ?? ''}@${decade ?? ''}`;
  let look = lookCache.get(key);
  if (!look) {
    look = lookFor(id, firstDecadeOf(id), clubId, decade);
    lookCache.set(key, look);
  }
  return look;
}

/** O que define um avatar: jogador, clube, década (gola), função (goleiro) e nível da carta. */
export interface AvatarRef {
  playerId: string;
  clubId: string;
  decade: Decade;
  goalkeeper: boolean;
  tier: Tier;
}

export function avatarRefOf(card: Card, tier: Tier = tierOf(card.overall)): AvatarRef {
  return { playerId: card.id, clubId: card.club, decade: card.decade, goalkeeper: card.player.position === 'GOL', tier };
}

/** Chave estável do avatar (sem o nível da carta, que só muda o fundo). */
export function avatarKey(ref: Pick<AvatarRef, 'playerId' | 'clubId' | 'decade'>): string {
  return `${ref.playerId}@${ref.clubId}@${ref.decade}`;
}

/** Ilustração própria do jogador naquele clube, se houver. */
export function customAvatar(ref: Pick<AvatarRef, 'playerId' | 'clubId' | 'decade'>): string | null {
  return CUSTOM[`${ref.playerId}/${ref.clubId}-${ref.decade}`] ?? CUSTOM[`${ref.playerId}/${ref.clubId}`] ?? null;
}

const svgCache = new Map<string, string>();

/** SVG do avatar gerado. */
export function avatarMarkup(ref: AvatarRef): string {
  const key = `${avatarKey(ref)}#${ref.tier}#${ref.goalkeeper ? 1 : 0}`;
  let svg = svgCache.get(key);
  if (!svg) {
    const club = CLUB_BY_ID[ref.clubId];
    const look = playerLook(ref.playerId, ref.clubId, ref.decade);
    const kit = ref.goalkeeper ? goalkeeperKit(club, ref.playerId, ref.decade) : kitOf(club);
    svg = avatarSvg({ look, kit, club, decade: ref.decade, tier: ref.tier, seed: hashString(`${ref.playerId}@${ref.clubId}`) });
    svgCache.set(key, svg);
  }
  return svg;
}

const urlCache = new Map<string, string>();

/** Endereço da imagem do avatar gerado (data URI, sem requisições). */
export function avatarDataUrl(ref: AvatarRef): string {
  const key = `${avatarKey(ref)}#${ref.tier}#${ref.goalkeeper ? 1 : 0}`;
  let url = urlCache.get(key);
  if (!url) {
    url = svgUrl(avatarMarkup(ref));
    urlCache.set(key, url);
  }
  return url;
}

const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const frameCache = new Map<string, string>();

/** Fundo e aro na cor da carta, para compor uma ilustração própria. */
export function avatarFrameUrls(ref: AvatarRef): { frame: string; ring: string } {
  const key = `${ref.playerId}@${ref.clubId}#${ref.tier}`;
  let frame = frameCache.get(key);
  if (!frame) {
    frame = svgUrl(frameSvg(ref.tier, hashString(`${ref.playerId}@${ref.clubId}`)));
    frameCache.set(key, frame);
  }
  let ring = frameCache.get(`ring#${ref.tier}`);
  if (!ring) {
    ring = svgUrl(ringSvg(ref.tier));
    frameCache.set(`ring#${ref.tier}`, ring);
  }
  return { frame, ring };
}
