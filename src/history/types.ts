// Registro de temporada: o "retrato" permanente de uma campanha, salvo quando
// ela começa e completado quando termina (ou é abandonada). É a base do
// histórico, das conquistas, das estatísticas de carreira e da arte de
// compartilhamento — sempre com os dados originais daquela temporada.
import type { Decade, Position } from '../data/types';
import type { FormationId } from '../data/formations';
import type { GameMode } from '../engine/draft';
import type { Difficulty } from '../engine/team';

export type SeasonStatus = 'in_progress' | 'finished' | 'abandoned';

/** Dados de lista (o que aparece nos cards do histórico). */
export interface SeasonEntry {
  runId: string;
  status: SeasonStatus;
  mode: GameMode;
  modeLabel: string;
  challengeLabel: string | null;
  clubId: string | null;
  teamName: string;
  teamShort: string;
  colors: { primary: string; secondary: string; accent: string };
  /** Décadas dos jogadores escalados, da mais usada para a menos usada. */
  decades: Decade[];
  /** Década fixa (Era Única e desafios de uma década). */
  fixedDecade: Decade | null;
  formationId: FormationId;
  difficulty: Difficulty;
  startedAt: string;
  finishedAt: string | null;
  /** Jogos do Brasileirão disputados. */
  played: number;
  position: number | null;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  /** Overall médio dos 11 titulares (nota das cartas, como no draft). */
  squadOverall: number;
  /** Força do time em campo (com capitão e química). */
  teamOverall: number;
  chemistry: number;
  captainName: string | null;
  champion: boolean;
  perfect: boolean;
  unbeaten: boolean;
  copaChampion: boolean;
  estadualChampion: boolean;
  triple: boolean;
  /** Conquistas desbloqueadas nesta temporada (ids do catálogo). */
  achievements: string[];
  /** Marcas da temporada usadas pelos recordes pessoais. */
  metrics: SeasonMetrics | null;
}

/** Números de uma temporada para os recordes (Brasileirão, salvo indicação). */
export interface SeasonMetrics {
  /** Aproveitamento em %. */
  efficiency: number;
  winStreak: number;
  unbeatenStreak: number;
  cleanSheets: number;
  cleanSheetStreak: number;
  /** Maior vitória (todas as competições). */
  biggestWin: { diff: number; for: number; against: number; rival: string } | null;
  /** Jogo com mais gols marcados pelo seu time (todas as competições). */
  mostGoalsMatch: { goals: number; against: number; rival: string } | null;
  /** Artilheiro do seu time no Brasileirão. */
  topScorer: { name: string; goals: number } | null;
  /** Jogador de maior overall escalado. */
  bestCard: { name: string; overall: number; club: string; decade: Decade } | null;
  /** Derrotas em todas as competições (Invencível considera a temporada inteira). */
  lossesAll: number;
  /** Quantos titulares de cada década. */
  decadeCounts: Partial<Record<Decade, number>>;
}

/** Título conquistado (registro permanente). */
export interface TitleRecord {
  /** `${runId}:${competitionId}` */
  id: string;
  competitionId: string;
  competitionName: string;
  runId: string;
  clubId: string | null;
  teamName: string;
  decades: Decade[];
  fixedDecade: Decade | null;
  formationId: FormationId;
  wonAt: string;
}

/** Conquista desbloqueada (registro permanente; guarda nome e raridade da época). */
export interface UnlockRecord {
  id: string;
  name: string;
  tier: AchievementTier;
  unlockedAt: string;
  runId: string | null;
  /** Valor que motivou o desbloqueio (ex.: gols, overall). */
  value: number | null;
  detail: string | null;
}

export type AchievementTier = 'bronze' | 'prata' | 'ouro' | 'lendaria';

export interface LineupEntry {
  slotId: string;
  pos: Position;
  cardKey: string;
  personId: string;
  name: string;
  club: string;
  decade: Decade;
  nationality: string;
  number: number;
  overall: number;
  captain: boolean;
}

export interface StandingRow {
  team: string;
  name: string;
  short: string;
  clubId: string | null;
  label: string;
  user: boolean;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}

export interface MatchLine {
  comp: 'brasileirao' | 'copa' | 'estadual';
  label: string;
  home: string;
  away: string;
  homeName: string;
  awayName: string;
  score: [number, number];
  shootout?: [number, number];
  /** Gols do jogo (lado, autor, minuto). */
  goals: { side: 'home' | 'away'; name: string; minute: number; penalty?: boolean }[];
}

export interface PlayerSeasonLine {
  personId: string;
  name: string;
  pos: Position;
  number: number;
  games: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  saves: number;
  cleanSheets: number;
  mvps: number;
  rating: number;
}

export interface CupSummary {
  name: string;
  champion: string | null;
  /** Até onde o seu time chegou (ex.: "Campeão", "Vice-campeão", "Semifinal"). */
  userResult: string;
}

/** Recordes e marcas da temporada (texto pronto para exibir). */
export interface SeasonMark {
  id: string;
  label: string;
  value: string;
}

export interface SeasonDetails {
  lineup: LineupEntry[];
  standings: StandingRow[];
  matches: MatchLine[];
  players: PlayerSeasonLine[];
  /** Sequência V/E/D no Brasileirão. */
  sequence: ('V' | 'E' | 'D')[];
  topScorer: { name: string; goals: number } | null;
  bestPlayer: { name: string; rating: number } | null;
  leagueTopScorer: { name: string; team: string; goals: number; user: boolean } | null;
  copa: CupSummary | null;
  estadual: CupSummary | null;
  marks: SeasonMark[];
  rounds: number;
}

export interface SeasonRecord extends SeasonEntry {
  details: SeasonDetails | null;
}
