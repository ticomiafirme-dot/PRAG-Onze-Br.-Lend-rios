// Uniforme principal de cada clube (cores e desenho tradicionais) e a camisa de
// goleiro. A gola muda conforme a década, como nas camisas de cada época.
import type { Club, Decade } from '../data/types';
import { hashString } from './looks';

export type KitPattern =
  | 'solid'
  /** listras verticais: cores alternadas */
  | 'stripes'
  /** listras verticais com filete entre elas (Grêmio, Fluminense) */
  | 'stripes-piped'
  /** listras horizontais */
  | 'hoops'
  /** faixa diagonal (Vasco) */
  | 'sash'
  /** faixas horizontais no peito */
  | 'chest-bands';

export interface Kit {
  pattern: KitPattern;
  /** Cor de fundo da camisa. */
  base: string;
  /** Cores do desenho (listras, faixas), na ordem em que se repetem. */
  colors: string[];
  /** Filete entre as listras (stripes-piped). */
  pipe?: string;
  /** Gola e punhos. */
  trim: string;
}

/** Camisa 1 tradicional de cada clube. */
export const CLUB_KITS: Record<string, Kit> = {
  corinthians: { pattern: 'solid', base: '#f4f4f2', colors: [], trim: '#151515' },
  flamengo: { pattern: 'hoops', base: '#c8102e', colors: ['#141414'], trim: '#141414' },
  vasco: { pattern: 'sash', base: '#141414', colors: ['#f4f4f2'], trim: '#f4f4f2' },
  'sao-paulo': { pattern: 'chest-bands', base: '#f4f4f2', colors: ['#d71920', '#141414'], trim: '#d71920' },
  palmeiras: { pattern: 'solid', base: '#006437', colors: [], trim: '#f4f4f2' },
  santos: { pattern: 'solid', base: '#f4f4f2', colors: [], trim: '#141414' },
  gremio: { pattern: 'stripes-piped', base: '#0d80bf', colors: ['#141414'], pipe: '#f4f4f2', trim: '#141414' },
  internacional: { pattern: 'solid', base: '#e30613', colors: [], trim: '#f4f4f2' },
  cruzeiro: { pattern: 'solid', base: '#1c3f94', colors: [], trim: '#f4f4f2' },
  'atletico-mg': { pattern: 'stripes', base: '#f4f4f2', colors: ['#141414'], trim: '#141414' },
  botafogo: { pattern: 'stripes', base: '#f4f4f2', colors: ['#141414'], trim: '#141414' },
  fluminense: { pattern: 'stripes-piped', base: '#870a28', colors: ['#00613c'], pipe: '#f4f4f2', trim: '#f4f4f2' },
  bahia: { pattern: 'chest-bands', base: '#f4f4f2', colors: ['#0a4ea2', '#e30613'], trim: '#0a4ea2' },
  'athletico-pr': { pattern: 'hoops', base: '#c8102e', colors: ['#141414'], trim: '#141414' },
  coritiba: { pattern: 'chest-bands', base: '#f4f4f2', colors: ['#00664a', '#f4f4f2', '#00664a'], trim: '#00664a' },
  vitoria: { pattern: 'hoops', base: '#c8102e', colors: ['#141414'], trim: '#141414' },
  sport: { pattern: 'hoops', base: '#c8102e', colors: ['#141414'], trim: '#f2b705' },
  fortaleza: { pattern: 'hoops', base: '#0c3c8c', colors: ['#f4f4f2', '#e30613', '#f4f4f2'], trim: '#e30613' },
  ceara: { pattern: 'stripes', base: '#f4f4f2', colors: ['#141414'], trim: '#141414' },
  goias: { pattern: 'solid', base: '#006b3f', colors: [], trim: '#f4f4f2' },
  nautico: { pattern: 'stripes', base: '#f4f4f2', colors: ['#d50032'], trim: '#d50032' },
  'santa-cruz': { pattern: 'hoops', base: '#141414', colors: ['#f4f4f2', '#d50032', '#f4f4f2'], trim: '#d50032' },
  'atletico-go': { pattern: 'stripes', base: '#c8102e', colors: ['#141414'], trim: '#141414' },
  'vila-nova': { pattern: 'solid', base: '#d50032', colors: [], trim: '#f4f4f2' },
};

/** Clube sem uniforme cadastrado: camisa lisa nas cores do clube. */
export function kitOf(club: Club): Kit {
  return CLUB_KITS[club.id] ?? { pattern: 'solid', base: club.colors.primary, colors: [], trim: club.colors.secondary };
}

const GK_COLORS: Record<'classic' | 'modern', string[]> = {
  // Até os anos 80: camisas escuras ou cinza; depois, cores vivas.
  classic: ['#1d1d1f', '#2b2f36', '#5d6670', '#1f3d2b'],
  modern: ['#1d1d1f', '#5d6670', '#2e7d32', '#f2c230', '#e86a1a', '#4b3fa0', '#0f8c9a'],
};

/** Camisa de goleiro: cor da época, gola e detalhes nas cores do clube. */
export function goalkeeperKit(club: Club, playerId: string, decade: Decade): Kit {
  const palette = decade <= '1980s' ? GK_COLORS.classic : GK_COLORS.modern;
  const base = palette[hashString(`gk:${playerId}:${club.id}`) % palette.length];
  const kit = kitOf(club);
  const accent = [kit.base, ...kit.colors, kit.trim].find((c) => c.toLowerCase() !== base.toLowerCase() && !similar(c, base)) ?? '#f4f4f2';
  return { pattern: decade >= '1990s' ? 'chest-bands' : 'solid', base, colors: decade >= '1990s' ? [accent] : [], trim: accent };
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function similar(a: string, b: string): boolean {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2) < 90;
}

export type CollarStyle = 'polo-lace' | 'crew' | 'crew-rib' | 'v-neck' | 'polo' | 'v-modern' | 'crew-modern';

/** Gola típica de cada década. */
export function collarOf(decade: Decade): CollarStyle {
  switch (decade) {
    case '1950s':
      return 'polo-lace';
    case '1960s':
      return 'crew';
    case '1970s':
      return 'crew-rib';
    case '1980s':
      return 'v-neck';
    case '1990s':
      return 'polo';
    case '2000s':
      return 'v-modern';
    default:
      return 'crew-modern';
  }
}
