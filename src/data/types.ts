// Tipos centrais do banco de dados do jogo.

/**
 * Posições oficiais do jogo: quatro categorias. Qualquer jogador de uma
 * categoria pode ocupar qualquer vaga daquela categoria na formação.
 */
export type Position = 'GOL' | 'DEF' | 'MEI' | 'ATA';

export const POSITIONS: Position[] = ['GOL', 'DEF', 'MEI', 'ATA'];

export const POSITION_NAMES: Record<Position, string> = {
  GOL: 'Goleiro',
  DEF: 'Defensor',
  MEI: 'Meio-campista',
  ATA: 'Atacante',
};

export const POSITION_PLURAL: Record<Position, string> = {
  GOL: 'Goleiros',
  DEF: 'Defensores',
  MEI: 'Meio-campistas',
  ATA: 'Atacantes',
};

/**
 * Função histórica do atleta, como registrada na fonte (lateral, volante,
 * ponta...). Não é posição de jogo: serve apenas para classificar o jogador
 * em uma categoria e dar nuances à simulação (um centroavante finaliza mais
 * que um volante, por exemplo).
 */
export type Role = 'GOL' | 'LD' | 'ZAG' | 'LE' | 'VOL' | 'MC' | 'MEI' | 'PD' | 'PE' | 'SA' | 'CA';

export const ROLES: Role[] = ['GOL', 'LD', 'ZAG', 'LE', 'VOL', 'MC', 'MEI', 'PD', 'PE', 'SA', 'CA'];

/** Classificação: goleiros; defensores (zagueiros e laterais); meio-campistas
 *  (volantes, meio-campistas e meias); atacantes (pontas, segundos atacantes e centroavantes). */
export const ROLE_CATEGORY: Record<Role, Position> = {
  GOL: 'GOL',
  LD: 'DEF',
  ZAG: 'DEF',
  LE: 'DEF',
  VOL: 'MEI',
  MC: 'MEI',
  MEI: 'MEI',
  PD: 'ATA',
  PE: 'ATA',
  SA: 'ATA',
  CA: 'ATA',
};

/** Converte uma categoria ou função antiga (dados salvos) na categoria oficial. */
export function toPosition(value: string): Position {
  if ((POSITIONS as string[]).includes(value)) return value as Position;
  return ROLE_CATEGORY[value as Role] ?? 'MEI';
}

export type Decade = '1950s' | '1960s' | '1970s' | '1980s' | '1990s' | '2000s' | '2010s' | '2020s';

export const DECADES: Decade[] = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];

export function decadeLabel(d: Decade): string {
  return `Anos ${d.slice(2, 4)}`;
}

export function decadeOfYear(year: number): Decade | null {
  const d = `${Math.floor(year / 10) * 10}s` as Decade;
  return DECADES.includes(d) ? d : null;
}

export interface PlayerPhoto {
  url: string;
  author?: string | null;
  license?: string | null;
  page?: string | null;
}

/** Registro de um jogador em um clube (um arquivo JSON por clube). */
export interface PlayerRecord {
  /** Identificador da pessoa (o mesmo em todos os clubes por onde passou). */
  id: string;
  name: string;
  fullName?: string;
  /** Código FIFA de 3 letras (BRA, ARG, URU...). */
  nationality: string;
  /** Função histórica principal (fonte). A categoria de jogo deriva dela. */
  position: Role;
  /** Outras funções históricas; se pertencem a outra categoria, o jogador também pode atuar nela. */
  secondary: Role[];
  /** Passagem(ns) pelo clube, como aparece na fonte. Ex.: "2012–2024". */
  years: string;
  /** Overall editorial por década em que atuou pelo clube. */
  eras: Partial<Record<Decade, number>>;
  /** Jogos e gols pelo clube segundo a fonte (quando disponíveis). */
  apps?: number | null;
  goals?: number | null;
  description: string;
  photo?: PlayerPhoto | null;
  /** URL do artigo usado como fonte da passagem. */
  source: string;
  wikidata?: string | null;
  /** Seleção principal: jogos (quando disponível). */
  caps?: number | null;
  /** true quando a nota foi definida manualmente pela curadoria editorial. */
  editorial?: boolean;
}

export interface ClubPlayersFile {
  club: string;
  generatedAt: string;
  players: PlayerRecord[];
}

export type UF = 'SP' | 'RJ' | 'MG' | 'RS' | 'PR' | 'BA' | 'PE' | 'CE' | 'GO';

export type CrestShape = 'shield' | 'round' | 'classic' | 'pointed' | 'badge';
export type CrestPattern = 'solid' | 'stripes' | 'hoops' | 'half' | 'diagonal' | 'cross' | 'chevron' | 'ring';

export interface CrestSpec {
  shape: CrestShape;
  pattern: CrestPattern;
  /** Sigla exibida no emblema. */
  initials: string;
  stars?: number;
}

export interface ClubTitles {
  brasileirao: number[];
  copaDoBrasil: number[];
  libertadores: number[];
}

export interface Club {
  id: string;
  name: string;
  fullName: string;
  short: string;
  city: string;
  state: UF;
  founded: number;
  stadium: string;
  nickname: string;
  colors: { primary: string; secondary: string; accent: string };
  crest: CrestSpec;
  /** Décadas disponíveis para draft. */
  decades: Decade[];
  stateCup: string;
  titles: ClubTitles;
  history: string;
  sources: string[];
  /** Clube convidado: fora dos 20 do Brasileirão, completa os estaduais. */
  guest?: boolean;
}

/** Carta de draft: um jogador em um clube e década específicos. */
export interface Card {
  key: string; // `${id}@${club}@${decade}`
  id: string;
  club: string;
  decade: Decade;
  overall: number;
  player: PlayerRecord;
  /** Categorias em que pode atuar (a primeira é a principal). */
  positions: Position[];
}
