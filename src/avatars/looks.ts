// Aparência de cada jogador (a mesma pessoa tem o mesmo rosto em todos os
// clubes; só o uniforme muda). Os traços vêm de LOOKS (curadoria, inspirada nas
// características gerais do jogador real) ou, na falta dela, de uma escolha
// determinística a partir do identificador do jogador.
import type { Decade } from '../data/types';
import { LOOKS, type LookEntry } from './looksData';

export type SkinTone = 1 | 2 | 3 | 4 | 5 | 6;
export type HairStyle = 'bald' | 'buzz' | 'short' | 'part' | 'curly' | 'afro' | 'wavy' | 'long' | 'mullet' | 'dreads' | 'top' | 'mohawk' | 'receding';
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
  /** true quando os traços vêm da curadoria. */
  curated: boolean;
}

const HAIR_CODE: Record<string, HairStyle> = {
  B: 'bald',
  Z: 'buzz',
  S: 'short',
  P: 'part',
  C: 'curly',
  A: 'afro',
  W: 'wavy',
  L: 'long',
  M: 'mullet',
  D: 'dreads',
  T: 'top',
  X: 'mohawk',
  R: 'receding',
};
const COLOR_CODE: Record<string, HairColor> = { k: 'black', d: 'dark', b: 'brown', y: 'blond', r: 'red', g: 'gray', w: 'white' };
const FACIAL_CODE: Record<string, FacialHair> = { '0': 'none', s: 'stubble', m: 'mustache', g: 'goatee', f: 'beard', c: 'short-beard' };

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

/** Penteados e barbas mais comuns em cada época (para os traços gerados). */
function eraHair(decade: Decade): [HairStyle, number][] {
  const early = decade <= '1960s';
  const seventies = decade === '1970s' || decade === '1980s';
  const modern = decade >= '2010s';
  return [
    ['short', early ? 5 : 3],
    ['part', early ? 6 : seventies ? 2 : 1],
    ['buzz', modern ? 3 : 2],
    ['curly', seventies ? 4 : 3],
    ['afro', seventies ? 2.2 : 0.6],
    ['wavy', seventies ? 1.6 : 0.3],
    ['long', seventies ? 1 : 0.4],
    ['mullet', decade === '1980s' || decade === '1990s' ? 1.4 : 0.2],
    ['dreads', modern ? 0.6 : decade === '2000s' ? 0.4 : 0],
    ['top', modern ? 4 : decade === '2000s' ? 1.5 : 0],
    ['receding', early ? 1 : 0.6],
    ['bald', decade >= '1990s' ? 0.8 : 0.3],
  ];
}

function eraFacial(decade: Decade): [FacialHair, number][] {
  const seventies = decade === '1970s' || decade === '1980s';
  const modern = decade >= '2010s';
  return [
    ['none', seventies ? 5 : modern ? 4 : 9],
    ['mustache', seventies ? 2.4 : 0.4],
    ['stubble', modern ? 2 : 0.6],
    ['goatee', modern ? 1 : decade === '2000s' ? 1 : 0.2],
    ['beard', modern ? 1.6 : seventies ? 0.6 : 0.1],
    ['short-beard', modern ? 1.6 : 0.3],
  ];
}

const STRUCTURE_KEYS = ['face', 'expression', 'eyes', 'turn', 'brow', 'nose'] as const;

/** Traços de estrutura do rosto (sempre derivados do identificador). */
function structure(id: string, skin: SkinTone): Pick<Look, (typeof STRUCTURE_KEYS)[number]> {
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
  const eyes = skin <= 2 ? pick<EyeColor>(r, [['brown', 4], ['hazel', 2], ['green', 1.4], ['blue', 1.6]]) : pick<EyeColor>(r, [['brown', 5], ['dark', 4], ['hazel', 1]]);
  const turn = Math.round((r() * 8 - 4) * 10) / 10;
  const brow = Math.floor(r() * 3);
  const nose = Math.floor(r() * 3);
  return { face, expression, eyes, turn, brow, nose };
}

/**
 * Decodifica um código de aparência: tom de pele (1–6), penteado, cor do cabelo
 * e barba, mais marcadores opcionais (h = faixa na cabeça, + = sorriso, = = sério).
 * Ex.: "5Ck0" (pele 5, cabelo cacheado curto, preto, sem barba).
 */
export function decodeLook(id: string, code: string): Look | null {
  const m = /^([1-6])([A-Z])([a-z])([0a-z])([h+=]*)$/.exec(code);
  if (!m) return null;
  const hair = HAIR_CODE[m[2]];
  const hairColor = COLOR_CODE[m[3]];
  const facial = FACIAL_CODE[m[4]];
  if (!hair || !hairColor || !facial) return null;
  const skin = Number(m[1]) as SkinTone;
  const look: Look = { skin, hair, hairColor, facial, headband: m[5].includes('h'), ...structure(id, skin), curated: true };
  if (m[5].includes('+')) look.expression = 'grin';
  if (m[5].includes('=')) look.expression = 'focused';
  return look;
}

/** Aparência gerada, coerente com a época em que o jogador começou. */
export function generatedLook(id: string, firstDecade: Decade): Look {
  const r = rng(hashString(`visual:${id}`));
  const skin = pick<SkinTone>(r, [
    [1, 1.2],
    [2, 2],
    [3, 2.4],
    [4, 2],
    [5, 1.4],
    [6, 1],
  ]);
  let hair = pick(r, eraHair(firstDecade));
  if (hair === 'afro' && skin <= 2) hair = 'curly';
  const hairColor = pick<HairColor>(
    r,
    skin <= 2
      ? [
          ['dark', 4],
          ['brown', 3],
          ['black', 2],
          ['blond', 1.2],
          ['red', 0.2],
        ]
      : [
          ['black', 6],
          ['dark', 3],
          ['brown', 0.6],
        ],
  );
  const facial = pick(r, eraFacial(firstDecade));
  return { skin, hair, hairColor, facial, headband: false, ...structure(id, skin), curated: false };
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
