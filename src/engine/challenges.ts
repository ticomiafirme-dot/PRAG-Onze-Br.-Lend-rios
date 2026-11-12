// Desafios Diário e Semanal: todos os jogadores recebem a mesma configuração,
// derivada da data (fuso de Brasília). Os sorteios do draft usam a mesma semente.

import type { Decade } from '../data/types';
import { FORMATIONS, type FormationId } from '../data/formations';
import type { Database } from './database';
import { feasibleFormationsForDecade } from './draft';
import { Rng, hashString } from './rng';
import type { Difficulty } from './team';

export interface ChallengeConfig {
  key: string;
  kind: 'diario' | 'semanal';
  label: string;
  clubId: string;
  decade: Decade | null;
  formationId: FormationId;
  difficulty: Difficulty;
  seed: number;
}

/** Data (AAAA-MM-DD) no fuso de Brasília. */
export function brazilDateKey(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** Semana ISO (AAAA-Www) no fuso de Brasília. */
export function brazilWeekKey(d: Date = new Date()): string {
  const [y, m, day] = brazilDateKey(d).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, day));
  const dow = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function dailyChallenge(db: Database, leagueClubIds: string[], dateKey = brazilDateKey()): ChallengeConfig {
  const seed = hashString(`diario:${dateKey}`);
  const rng = new Rng(seed);
  const all = FORMATIONS.map((f) => f.id);
  const options: { clubId: string; decade: Decade; formations: FormationId[] }[] = [];
  for (const clubId of leagueClubIds) {
    for (const d of db.decadesOf(clubId)) {
      const formations = feasibleFormationsForDecade(db, clubId, d, all);
      if (formations.length >= 2) options.push({ clubId, decade: d, formations });
    }
  }
  const choice = rng.pick(options);
  const formationId = rng.pick(choice.formations);
  const [y, m, d] = dateKey.split('-');
  return {
    key: `diario:${dateKey}`,
    kind: 'diario',
    label: `Desafio Diário · ${d}/${m}/${y}`,
    clubId: choice.clubId,
    decade: choice.decade,
    formationId,
    difficulty: 'normal',
    seed,
  };
}

export function weeklyChallenge(leagueClubIds: string[], weekKey = brazilWeekKey()): ChallengeConfig {
  const seed = hashString(`semanal:${weekKey}`);
  const [year, w] = weekKey.split('-W').map(Number);
  // Rodízio: cada semana um clube diferente (ordem embaralhada por ano)
  const order = new Rng(hashString(`semanal-ordem:${year}`)).shuffle(leagueClubIds);
  const clubId = order[(w - 1) % order.length];
  const rng = new Rng(seed);
  const formationId = rng.pick(FORMATIONS.map((f) => f.id));
  return {
    key: `semanal:${weekKey}`,
    kind: 'semanal',
    label: `Desafio Semanal · Semana ${w}/${year}`,
    clubId,
    decade: null,
    formationId,
    difficulty: 'dificil',
    seed,
  };
}
