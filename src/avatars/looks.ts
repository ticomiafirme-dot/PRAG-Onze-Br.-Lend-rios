// Aparência de cada jogador (a mesma pessoa tem o mesmo rosto em todos os
// clubes; só o uniforme e, quando mudou, o visual da época mudam). Os traços vêm
// de LOOKS (pesquisa: tom de pele, cabelo, barba e olhos do jogador real). Sem
// pesquisa, o jogador recebe um visual neutro e discreto, sem traços marcantes
// inventados.
import type { Decade } from '../data/types';
import { LOOKS, type LookEntry } from './looksData';

export type SkinTone = 1 | 2 | 3 | 4 | 5 | 6;
export type HairStyle =
  | 'bald'
  | 'buzz'
  | 'short'
  | 'part'
  | 'curly'
  | 'shortafro'
  | 'afro'
  | 'wavy'
  | 'long'
  | 'mullet'
  | 'dreads'
  | 'cornrows'
  | 'bun'
  | 'top'
  | 'mohawk'
  | 'receding';
export type HairColor = 'black' | 'dark' | 'brown' | 'blond' | 'red' | 'gray' | 'white';
export type FacialHair = 'none' | 'stubble' | 'mustache' | 'goatee' | 'beard' | 'short-beard';
export type FaceShape = 'oval' | 'round' | 'square' | 'long';
export type Expression = 'smile' | 'grin' | 'neutral' | 'focused';
export type EyeColor = 'brown' | 'dark' | 'hazel' | 'green' | 'blue';

export interface Look {
  skin: SkinTone;
  hair: HairStyle;
  hairColor: HairColor;
  facial: FacialHair;
  headband: boolean;
  face: FaceShape;
  expression: Expression;
  eyes: EyeColor;
  /** Leve giro do rosto (−4 a 4), para dar a pose de três quartos. */
  turn: number;
  /** Espessura das sobrancelhas (0 a 2). */
  brow: number;
  /** Largura do nariz (0 a 2). */
  nose: number;
  /** true quando os traços vêm da pesquisa (LOOKS). */
  curated: boolean;
}

const HAIR_CODE: Record<string, HairStyle> = {
  B: 'bald',
  Z: 'buzz',
  S: 'short',
  P: 'part',
  C: 'curly',
  O: 'shortafro',
  A: 'afro',
  W: 'wavy',
  L: 'long',
  M: 'mullet',
  D: 'dreads',
  N: 'cornrows',
  U: 'bun',
  T: 'top',
  X: 'mohawk',
  R: 'receding',
};
const COLOR_CODE: Record<string, HairColor> = { k: 'black', d: 'dark', b: 'brown', y: 'blond', r: 'red', g: 'gray', w: 'white' };
const FACIAL_CODE: Record<string, FacialHair> = { '0': 'none', s: 'stubble', m: 'mustache', g: 'goatee', f: 'beard', c: 'short-beard' };
const EYE_CODE: Record<string, EyeColor> = { a: 'blue', v: 'green', l: 'hazel', k: 'dark' };

export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Gerador pseudoaleatório determinístico (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [v, w] of items) {
    x -= w;
    if (x < 0) return v;
  }
  return items[items.length - 1][0];
}



const STRUCTURE_KEYS = ['face', 'expression', 'turn', 'brow', 'nose'] as const;

/** Traços de estrutura do rosto (formato, expressão, pose), derivados do identificador. */
function structure(id: string): Pick<Look, (typeof STRUCTURE_KEYS)[number]> {
  const r = rng(hashString(`rosto:${id}`));
  const face = pick<FaceShape>(r, [
    ['oval', 4],
    ['round', 2],
    ['square', 3],
    ['long', 2],
  ]);
  const expression = pick<Expression>(r, [
    ['smile', 3],
    ['grin', 2],
    ['neutral', 2],
    ['focused', 3],
  ]);
  const turn = Math.round((r() * 8 - 4) * 10) / 10;
  const brow = Math.floor(r() * 3);
  const nose = Math.floor(r() * 3);
  return { face, expression, turn, brow, nose };
}

/** Olhos castanhos por padrão (mais escuros nas peles mais escuras). */
function defaultEyes(skin: SkinTone): EyeColor {
  return skin >= 4 ? 'dark' : 'brown';
}

/**
 * Decodifica um código de aparência: tom de pele (1–6), penteado, cor do cabelo,
 * barba, cor dos olhos opcional (a azul, v verde, l mel, k castanho-escuro) e
 * marcadores opcionais (h = faixa na cabeça, + = sorriso aberto, = = sério).
 * Ex.: "5Ok0" (pele 5, black curto, preto, sem barba); "2Sdcv" (olhos verdes).
 */
export function decodeLook(id: string, code: string): Look | null {
  const m = /^([1-6])([A-Z])([a-z])([0a-z])([avlk]?)([h+=]*)$/.exec(code);
  if (!m) return null;
  const hair = HAIR_CODE[m[2]];
  const hairColor = COLOR_CODE[m[3]];
  const facial = FACIAL_CODE[m[4]];
  if (!hair || !hairColor || !facial) return null;
  const skin = Number(m[1]) as SkinTone;
  const eyes = m[5] ? EYE_CODE[m[5]] : defaultEyes(skin);
  const look: Look = { skin, hair, hairColor, facial, headband: m[6].includes('h'), eyes, ...structure(id), curated: true };
  if (m[6].includes('+')) look.expression = 'grin';
  if (m[6].includes('=')) look.expression = 'focused';
  return look;
}

/**
 * Visual neutro para quem ainda não tem pesquisa de aparência: tom de pele
 * intermediário, cabelo curto comum na época, cabelo escuro, sem barba e olhos
 * castanhos. Evita inventar traços marcantes (cabelo longo, black power, loiro,
 * barba) que o jogador real talvez não tivesse.
 */
export function generatedLook(id: string, firstDecade: Decade): Look {
  const r = rng(hashString(`visual:${id}`));
  const skin: SkinTone = r() < 0.5 ? 3 : 4;
  const early = firstDecade <= '1960s';
  const modern = firstDecade >= '2010s';
  const hair = pick<HairStyle>(r, [
    ['short', 5],
    ['part', early ? 4 : 0.5],
    ['buzz', modern ? 3 : 1],
  ]);
  return { skin, hair, hairColor: r() < 0.6 ? 'black' : 'dark', facial: 'none', headband: false, eyes: defaultEyes(skin), ...structure(id), curated: false };
}

/** Código da aparência para o clube e a década (o visual da época no clube). */
export function lookCode(entry: LookEntry | undefined, club?: string, decade?: Decade): string | null {
  if (!entry) return null;
  if (typeof entry === 'string') return entry;
  return (club && decade && entry[`${club}@${decade}`]) || (club && entry[club]) || (decade && entry[decade]) || entry.base;
}

export function lookFor(id: string, firstDecade: Decade, club?: string, decade?: Decade): Look {
  const code = lookCode(LOOKS[id], club, decade);
  return (code && decodeLook(id, code)) || generatedLook(id, firstDecade);
}
