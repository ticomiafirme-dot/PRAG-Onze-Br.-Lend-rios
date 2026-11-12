// Carrega a base (clubes + jogadores por clube) e monta os índices do jogo.
import { CLUBS } from './clubs';
import type { ClubPlayersFile, PlayerRecord } from './types';
import { Database } from '../engine/database';

const files = import.meta.glob<ClubPlayersFile>('./players/*.json', { eager: true, import: 'default' });

export const PLAYERS_BY_CLUB: Record<string, PlayerRecord[]> = Object.fromEntries(
  Object.values(files).map((f) => [f.club, f.players]),
);

export const db = new Database(CLUBS, PLAYERS_BY_CLUB);

/** Os 20 clubes do Brasileirão (sem os convidados dos estaduais). */
export const LEAGUE_CLUBS = CLUBS.filter((c) => !c.guest);
