// Tipos centrais do banco de dados do jogo.

/** Posições (nomenclatura brasileira). */
export type Position = 'GOL' | 'LD' | 'ZAG' | 'LE' | 'VOL' | 'MC' | 'MEI' | 'PD' | 'PE' | 'SA' | 'CA';

export const POSITIONS: Position[] = ['GOL', 'LD', 'ZAG', 'LE', 'VOL', 'MC', 'MEI', 'PD', 'PE', 'SA', 'CA'];

export const POSITION_NAMES: Record<Position, string> = {
  GOL: 'Goleiro',
  LD: 'Lateral-direito',
  ZAG: 'Zagueiro',
  LE: 'Lateral-esquerdo',
  VOL: 'Volante',
  MC: 'Meio-campista',
  MEI: 'Meia',
  PD: 'Ponta-direita',
  PE: 'Ponta-esquerda',
  SA: 'Segundo atacante',
  CA: 'Centroavante',
};

export type Line = 'GOL' | 'DEF' | 'MEI' | 'ATA';

export const POSITION_LINE: Record<Position, Line> = {
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
  position: Position;
  secondary: Position[];
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
}
