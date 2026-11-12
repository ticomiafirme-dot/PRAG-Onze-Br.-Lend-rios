import type { Position } from './types';

export interface Slot {
  id: string;
  pos: Position;
  /** Coordenadas no campo em %: x da esquerda p/ direita, y do ataque (0) à defesa (100). */
  x: number;
  y: number;
}

export interface Formation {
  id: FormationId;
  name: string;
  tagline: string;
  description: string;
  slots: Slot[];
  /** Ligações de química entre posições vizinhas. */
  links: [string, string][];
  /** Modificadores táticos usados pelo motor de simulação. */
  style: { attack: number; midfield: number; defense: number };
}

export type FormationId = '4-3-3' | '4-4-2' | '4-2-3-1' | '3-5-2' | '4-1-4-1' | '3-4-3';

const back4 = (): Slot[] => [
  { id: 'gol', pos: 'GOL', x: 50, y: 91 },
  { id: 'le', pos: 'LE', x: 12, y: 70 },
  { id: 'zag1', pos: 'ZAG', x: 37, y: 76 },
  { id: 'zag2', pos: 'ZAG', x: 63, y: 76 },
  { id: 'ld', pos: 'LD', x: 88, y: 70 },
];

const back3 = (): Slot[] => [
  { id: 'gol', pos: 'GOL', x: 50, y: 91 },
  { id: 'zag1', pos: 'ZAG', x: 27, y: 75 },
  { id: 'zag2', pos: 'ZAG', x: 50, y: 78 },
  { id: 'zag3', pos: 'ZAG', x: 73, y: 75 },
];

const back4Links: [string, string][] = [
  ['gol', 'zag1'],
  ['gol', 'zag2'],
  ['zag1', 'zag2'],
  ['le', 'zag1'],
  ['ld', 'zag2'],
];

const back3Links: [string, string][] = [
  ['gol', 'zag1'],
  ['gol', 'zag2'],
  ['gol', 'zag3'],
  ['zag1', 'zag2'],
  ['zag2', 'zag3'],
];

export const FORMATIONS: Formation[] = [
  {
    id: '4-3-3',
    name: '4-3-3',
    tagline: 'Ofensivo com pontas',
    description: 'Três atacantes abertos e um trio de meio-campo com volante de proteção. Pressiona e cria muitas chances.',
    slots: [
      ...back4(),
      { id: 'vol', pos: 'VOL', x: 50, y: 58 },
      { id: 'mc', pos: 'MC', x: 29, y: 45 },
      { id: 'mei', pos: 'MEI', x: 71, y: 45 },
      { id: 'pe', pos: 'PE', x: 15, y: 21 },
      { id: 'ca', pos: 'CA', x: 50, y: 14 },
      { id: 'pd', pos: 'PD', x: 85, y: 21 },
    ],
    links: [
      ...back4Links,
      ['vol', 'zag1'],
      ['vol', 'zag2'],
      ['vol', 'mc'],
      ['vol', 'mei'],
      ['le', 'mc'],
      ['ld', 'mei'],
      ['mc', 'pe'],
      ['mei', 'pd'],
      ['mc', 'ca'],
      ['mei', 'ca'],
      ['pe', 'ca'],
      ['pd', 'ca'],
    ],
    style: { attack: 1.5, midfield: 0, defense: -0.5 },
  },
  {
    id: '4-4-2',
    name: '4-4-2',
    tagline: 'O clássico quadrado brasileiro',
    description: 'Dois volantes, dois meias e dupla de ataque. Equilíbrio entre defesa e ataque, com laterais dando amplitude.',
    slots: [
      ...back4(),
      { id: 'vol', pos: 'VOL', x: 37, y: 58 },
      { id: 'mc', pos: 'MC', x: 63, y: 58 },
      { id: 'mei1', pos: 'MEI', x: 27, y: 38 },
      { id: 'mei2', pos: 'MEI', x: 73, y: 38 },
      { id: 'sa', pos: 'SA', x: 37, y: 16 },
      { id: 'ca', pos: 'CA', x: 63, y: 16 },
    ],
    links: [
      ...back4Links,
      ['vol', 'zag1'],
      ['mc', 'zag2'],
      ['vol', 'mc'],
      ['le', 'mei1'],
      ['ld', 'mei2'],
      ['vol', 'mei1'],
      ['mc', 'mei2'],
      ['mei1', 'mei2'],
      ['mei1', 'sa'],
      ['mei2', 'ca'],
      ['sa', 'ca'],
    ],
    style: { attack: 0.5, midfield: 0.5, defense: 0.5 },
  },
  {
    id: '4-2-3-1',
    name: '4-2-3-1',
    tagline: 'Controle do meio-campo',
    description: 'Dupla de volantes, linha de três meias com um camisa 10 centralizado e um centroavante de referência.',
    slots: [
      ...back4(),
      { id: 'vol', pos: 'VOL', x: 37, y: 59 },
      { id: 'mc', pos: 'MC', x: 63, y: 59 },
      { id: 'pe', pos: 'PE', x: 15, y: 33 },
      { id: 'mei', pos: 'MEI', x: 50, y: 36 },
      { id: 'pd', pos: 'PD', x: 85, y: 33 },
      { id: 'ca', pos: 'CA', x: 50, y: 13 },
    ],
    links: [
      ...back4Links,
      ['vol', 'zag1'],
      ['mc', 'zag2'],
      ['vol', 'mc'],
      ['le', 'pe'],
      ['ld', 'pd'],
      ['vol', 'mei'],
      ['mc', 'mei'],
      ['pe', 'mei'],
      ['pd', 'mei'],
      ['mei', 'ca'],
      ['pe', 'ca'],
      ['pd', 'ca'],
    ],
    style: { attack: 0.5, midfield: 1, defense: 0 },
  },
  {
    id: '3-5-2',
    name: '3-5-2',
    tagline: 'Alas e meio povoado',
    description: 'Três zagueiros, alas que percorrem o corredor inteiro e um meio-campo com cinco homens. Domina a posse.',
    slots: [
      ...back3(),
      { id: 'le', pos: 'LE', x: 9, y: 49 },
      { id: 'vol', pos: 'VOL', x: 50, y: 59 },
      { id: 'mc', pos: 'MC', x: 31, y: 44 },
      { id: 'mei', pos: 'MEI', x: 69, y: 44 },
      { id: 'ld', pos: 'LD', x: 91, y: 49 },
      { id: 'sa', pos: 'SA', x: 37, y: 16 },
      { id: 'ca', pos: 'CA', x: 63, y: 16 },
    ],
    links: [
      ...back3Links,
      ['zag1', 'le'],
      ['zag3', 'ld'],
      ['vol', 'zag2'],
      ['vol', 'mc'],
      ['vol', 'mei'],
      ['le', 'mc'],
      ['ld', 'mei'],
      ['mc', 'sa'],
      ['mei', 'ca'],
      ['sa', 'ca'],
    ],
    style: { attack: 0.5, midfield: 1.5, defense: -1 },
  },
  {
    id: '4-1-4-1',
    name: '4-1-4-1',
    tagline: 'Compacto e seguro',
    description: 'Um volante à frente da zaga, dois meio-campistas e dois pontas que fecham os lados. Difícil de ser vazado.',
    slots: [
      ...back4(),
      { id: 'vol', pos: 'VOL', x: 50, y: 60 },
      { id: 'pe', pos: 'PE', x: 14, y: 36 },
      { id: 'mc1', pos: 'MC', x: 36, y: 42 },
      { id: 'mc2', pos: 'MC', x: 64, y: 42 },
      { id: 'pd', pos: 'PD', x: 86, y: 36 },
      { id: 'ca', pos: 'CA', x: 50, y: 14 },
    ],
    links: [
      ...back4Links,
      ['vol', 'zag1'],
      ['vol', 'zag2'],
      ['vol', 'mc1'],
      ['vol', 'mc2'],
      ['le', 'pe'],
      ['ld', 'pd'],
      ['pe', 'mc1'],
      ['mc1', 'mc2'],
      ['mc2', 'pd'],
      ['mc1', 'ca'],
      ['mc2', 'ca'],
    ],
    style: { attack: -0.5, midfield: 1, defense: 1 },
  },
  {
    id: '3-4-3',
    name: '3-4-3',
    tagline: 'Ataque total',
    description: 'Três zagueiros, linha de quatro no meio e trio ofensivo. Muito perigoso, mas exposto nos contra-ataques.',
    slots: [
      ...back3(),
      { id: 'le', pos: 'LE', x: 11, y: 50 },
      { id: 'vol', pos: 'VOL', x: 38, y: 55 },
      { id: 'mc', pos: 'MC', x: 62, y: 55 },
      { id: 'ld', pos: 'LD', x: 89, y: 50 },
      { id: 'pe', pos: 'PE', x: 17, y: 21 },
      { id: 'ca', pos: 'CA', x: 50, y: 14 },
      { id: 'pd', pos: 'PD', x: 83, y: 21 },
    ],
    links: [
      ...back3Links,
      ['zag1', 'le'],
      ['zag3', 'ld'],
      ['zag1', 'vol'],
      ['zag3', 'mc'],
      ['vol', 'mc'],
      ['le', 'vol'],
      ['ld', 'mc'],
      ['le', 'pe'],
      ['ld', 'pd'],
      ['vol', 'ca'],
      ['mc', 'ca'],
      ['pe', 'ca'],
      ['pd', 'ca'],
    ],
    style: { attack: 2, midfield: 0, defense: -1.5 },
  },
];

export const FORMATION_BY_ID: Record<FormationId, Formation> = Object.fromEntries(
  FORMATIONS.map((f) => [f.id, f]),
) as Record<FormationId, Formation>;

export function getFormation(id: FormationId): Formation {
  return FORMATION_BY_ID[id];
}
