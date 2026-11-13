import type { Position } from './types';

/**
 * Vaga na formação. `pos` é a categoria aceita (GOL, DEF, MEI ou ATA): qualquer
 * jogador da categoria pode ocupar qualquer vaga dela. O `id` identifica a vaga
 * no campo (lado/altura) e é usado pelas ligações de química; não restringe nada.
 */
export interface Slot {
  id: string;
  pos: Position;
  /** Coordenadas no campo em %: x da esquerda p/ direita, y do ataque (0) à defesa (100). */
  x: number;
  y: number;
  /** Número da camisa sugerido para quem ocupar a vaga. */
  num: number;
}

export interface Formation {
  id: FormationId;
  name: string;
  tagline: string;
  description: string;
  slots: Slot[];
  /** Ligações de química entre vagas vizinhas. */
  links: [string, string][];
  /** Modificadores táticos usados pelo motor de simulação. */
  style: { attack: number; midfield: number; defense: number };
}

export type FormationId = '4-3-3' | '4-4-2' | '4-2-3-1' | '3-5-2' | '4-1-4-1' | '3-4-3' | '4-2-4';

const gk = (): Slot => ({ id: 'gol', pos: 'GOL', x: 50, y: 91, num: 1 });

const back4 = (): Slot[] => [
  gk(),
  { id: 'le', pos: 'DEF', x: 12, y: 70, num: 6 },
  { id: 'zag1', pos: 'DEF', x: 37, y: 76, num: 3 },
  { id: 'zag2', pos: 'DEF', x: 63, y: 76, num: 4 },
  { id: 'ld', pos: 'DEF', x: 88, y: 70, num: 2 },
];

const back3 = (): Slot[] => [
  gk(),
  { id: 'zag1', pos: 'DEF', x: 27, y: 75, num: 3 },
  { id: 'zag2', pos: 'DEF', x: 50, y: 78, num: 4 },
  { id: 'zag3', pos: 'DEF', x: 73, y: 75, num: 2 },
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
    tagline: 'Ofensivo, com trio de ataque',
    description: 'Quatro defensores, trio de meio-campo e três atacantes. Pressiona e cria muitas chances.',
    slots: [
      ...back4(),
      { id: 'vol', pos: 'MEI', x: 50, y: 58, num: 5 },
      { id: 'mc', pos: 'MEI', x: 29, y: 45, num: 8 },
      { id: 'mei', pos: 'MEI', x: 71, y: 45, num: 10 },
      { id: 'pe', pos: 'ATA', x: 15, y: 21, num: 11 },
      { id: 'ca', pos: 'ATA', x: 50, y: 14, num: 9 },
      { id: 'pd', pos: 'ATA', x: 85, y: 21, num: 7 },
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
    description: 'Quatro defensores, quatro meio-campistas e dupla de ataque. Equilíbrio entre defesa e ataque.',
    slots: [
      ...back4(),
      { id: 'vol', pos: 'MEI', x: 37, y: 58, num: 5 },
      { id: 'mc', pos: 'MEI', x: 63, y: 58, num: 8 },
      { id: 'mei1', pos: 'MEI', x: 27, y: 38, num: 10 },
      { id: 'mei2', pos: 'MEI', x: 73, y: 38, num: 7 },
      { id: 'sa', pos: 'ATA', x: 37, y: 16, num: 11 },
      { id: 'ca', pos: 'ATA', x: 63, y: 16, num: 9 },
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
    description: 'Dupla de proteção, dois meio-campistas abertos e dois atacantes: um por dentro, atrás do homem de referência.',
    // vagas "pe" e "pd" são meio-campistas abertos; "mei" é o atacante por dentro
    slots: [
      ...back4(),
      { id: 'vol', pos: 'MEI', x: 37, y: 59, num: 5 },
      { id: 'mc', pos: 'MEI', x: 63, y: 59, num: 8 },
      { id: 'pe', pos: 'MEI', x: 15, y: 35, num: 11 },
      { id: 'mei', pos: 'ATA', x: 50, y: 33, num: 10 },
      { id: 'pd', pos: 'MEI', x: 85, y: 35, num: 7 },
      { id: 'ca', pos: 'ATA', x: 50, y: 13, num: 9 },
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
    description: 'Três defensores, cinco meio-campistas (com os alas percorrendo os corredores) e dois atacantes. Domina a posse.',
    // vagas "le" e "ld" são os alas, contados no meio-campo
    slots: [
      ...back3(),
      { id: 'le', pos: 'MEI', x: 9, y: 49, num: 6 },
      { id: 'vol', pos: 'MEI', x: 50, y: 59, num: 5 },
      { id: 'mc', pos: 'MEI', x: 31, y: 44, num: 8 },
      { id: 'mei', pos: 'MEI', x: 69, y: 44, num: 10 },
      { id: 'ld', pos: 'MEI', x: 91, y: 49, num: 7 },
      { id: 'sa', pos: 'ATA', x: 37, y: 16, num: 11 },
      { id: 'ca', pos: 'ATA', x: 63, y: 16, num: 9 },
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
    description: 'Um meio-campista de proteção à frente da defesa, mais quatro na linha de meio e um atacante. Difícil de ser vazado.',
    // vagas "pe" e "pd" são meio-campistas abertos
    slots: [
      ...back4(),
      { id: 'vol', pos: 'MEI', x: 50, y: 60, num: 5 },
      { id: 'pe', pos: 'MEI', x: 14, y: 36, num: 11 },
      { id: 'mc1', pos: 'MEI', x: 36, y: 42, num: 8 },
      { id: 'mc2', pos: 'MEI', x: 64, y: 42, num: 10 },
      { id: 'pd', pos: 'MEI', x: 86, y: 36, num: 7 },
      { id: 'ca', pos: 'ATA', x: 50, y: 14, num: 9 },
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
    description: 'Três defensores, quatro meio-campistas (com os alas) e trio de ataque. Muito perigoso, mas exposto nos contra-ataques.',
    // vagas "le" e "ld" são os alas, contados no meio-campo
    slots: [
      ...back3(),
      { id: 'le', pos: 'MEI', x: 11, y: 50, num: 6 },
      { id: 'vol', pos: 'MEI', x: 38, y: 55, num: 5 },
      { id: 'mc', pos: 'MEI', x: 62, y: 55, num: 8 },
      { id: 'ld', pos: 'MEI', x: 89, y: 50, num: 10 },
      { id: 'pe', pos: 'ATA', x: 17, y: 21, num: 11 },
      { id: 'ca', pos: 'ATA', x: 50, y: 14, num: 9 },
      { id: 'pd', pos: 'ATA', x: 83, y: 21, num: 7 },
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
  {
    id: '4-2-4',
    name: '4-2-4',
    tagline: 'Quatro na frente, à moda antiga',
    description:
      'Quatro defensores, dupla de meio-campo e quatro atacantes: dois pontas bem abertos e dois homens de área. O esquema da era de ouro do futebol brasileiro: ataque avassalador, mas o meio fica exposto.',
    slots: [
      ...back4(),
      { id: 'vol', pos: 'MEI', x: 36, y: 56, num: 5 },
      { id: 'mc', pos: 'MEI', x: 64, y: 52, num: 8 },
      { id: 'pe', pos: 'ATA', x: 13, y: 24, num: 11 },
      { id: 'sa', pos: 'ATA', x: 38, y: 16, num: 10 },
      { id: 'ca', pos: 'ATA', x: 62, y: 14, num: 9 },
      { id: 'pd', pos: 'ATA', x: 87, y: 24, num: 7 },
    ],
    links: [
      ...back4Links,
      ['vol', 'zag1'],
      ['mc', 'zag2'],
      ['vol', 'mc'],
      ['le', 'vol'],
      ['ld', 'mc'],
      ['le', 'pe'],
      ['ld', 'pd'],
      ['vol', 'sa'],
      ['mc', 'ca'],
      ['pe', 'sa'],
      ['sa', 'ca'],
      ['ca', 'pd'],
    ],
    style: { attack: 2, midfield: -1, defense: -1 },
  },
];

export const FORMATION_BY_ID: Record<FormationId, Formation> = Object.fromEntries(
  FORMATIONS.map((f) => [f.id, f]),
) as Record<FormationId, Formation>;

export function getFormation(id: FormationId): Formation {
  return FORMATION_BY_ID[id];
}

/** Quantidade de vagas por categoria (ex.: 4-3-3 → 1 GOL, 4 DEF, 3 MEI, 3 ATA). */
export function formationCounts(f: Formation): Record<Position, number> {
  const out: Record<Position, number> = { GOL: 0, DEF: 0, MEI: 0, ATA: 0 };
  for (const s of f.slots) out[s.pos]++;
  return out;
}
