// Ranking global (todas as temporadas finalizadas de jogadores com conta),
// lido pela função ranking_global do banco. Visitantes também veem.
import { MODE_INFO } from '../state/modes';
import type { RankingEntry } from '../state/storage';
import type { GameMode } from '../engine/draft';
import { getSupabase } from './supabase';

export interface GlobalEntry extends RankingEntry {
  /** Rótulo do desafio (ex.: "Desafio Diário · 14/11/2026"). */
  challengeLabel: string | null;
  who: string;
  title: string | null;
  isMe: boolean;
}

interface Row {
  run_id: string;
  is_me: boolean;
  display_name: string;
  game_avatar: string | null;
  title: string | null;
  mode: string;
  challenge_label: string | null;
  club_id: string | null;
  team_name: string;
  formation: string;
  difficulty: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  final_position: number | null;
  perfect: boolean;
  champion: boolean;
  triple: boolean;
  team_overall: number;
  chemistry: number;
  captain_name: string | null;
  finished_at: string | null;
}

/** Rótulos dos desafios do dia e da semana (os mesmos gravados na temporada). */
export function challengeLabels(dateKey: string, weekKey: string): { day: string; week: string } {
  const [y, m, d] = dateKey.split('-');
  const [year, w] = weekKey.split('-W').map(Number);
  return { day: `Desafio Diário · ${d}/${m}/${y}`, week: `Desafio Semanal · Semana ${w}/${year}` };
}

export async function loadGlobalRanking(keys: { today: string; week: string; dateKey: string; weekKey: string }): Promise<GlobalEntry[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('ranking_global', { lim: 500 });
  if (error || !Array.isArray(data)) return null;
  const labels = challengeLabels(keys.dateKey, keys.weekKey);
  return (data as Row[]).map((r) => ({
    id: r.run_id,
    date: r.finished_at ?? new Date().toISOString(),
    mode: r.mode,
    modeLabel: MODE_INFO[r.mode as GameMode]?.name ?? r.mode,
    challengeKey: r.challenge_label === labels.day ? keys.today : r.challenge_label === labels.week ? keys.week : null,
    challengeLabel: r.challenge_label,
    clubId: r.club_id,
    teamName: r.team_name,
    formationId: r.formation,
    difficulty: r.difficulty,
    points: r.points,
    wins: r.wins,
    draws: r.draws,
    losses: r.losses,
    gf: r.goals_for,
    ga: r.goals_against,
    position: r.final_position ?? 0,
    perfect: r.perfect,
    champion: r.champion,
    triple: r.triple,
    overall: r.team_overall,
    chem: r.chemistry,
    captain: r.captain_name ?? '—',
    playerName: r.display_name,
    avatar: r.game_avatar,
    who: r.display_name || 'Jogador',
    title: r.title,
    isMe: r.is_me,
  }));
}

/**
 * Melhor posição do jogador logado no ranking de todos, dentro da
 * dificuldade de cada campanha (Normal, Difícil e Lendário têm rankings próprios).
 */
export async function myBestPosition(lim = 500): Promise<{ position: number; runId: string } | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('ranking_global', { lim });
  if (error || !Array.isArray(data)) return null;
  let best: { position: number; runId: string } | null = null;
  const seen: Record<string, number> = {};
  for (const r of data as Row[]) {
    const pos = (seen[r.difficulty] = (seen[r.difficulty] ?? 0) + 1);
    if (r.is_me && (!best || pos < best.position)) best = { position: pos, runId: r.run_id };
  }
  return best;
}

export interface AchievementRankingEntry {
  isMe: boolean;
  who: string;
  avatar: string | null;
  title: string | null;
  points: number;
  total: number;
  bronze: number;
  prata: number;
  ouro: number;
  lendaria: number;
  bestRunId: string | null;
}

/** Ranking de conquistas (pontos por raridade), o mesmo para todos. */
export async function loadAchievementRanking(lim = 300): Promise<AchievementRankingEntry[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('ranking_conquistas', { lim });
  if (error || !Array.isArray(data)) return null;
  return (data as Record<string, unknown>[]).map((r) => ({
    isMe: !!r.is_me,
    who: (r.display_name as string) || 'Jogador',
    avatar: (r.game_avatar as string) ?? null,
    title: (r.title as string) ?? null,
    points: Number(r.points ?? 0),
    total: Number(r.total ?? 0),
    bronze: Number(r.bronze ?? 0),
    prata: Number(r.prata ?? 0),
    ouro: Number(r.ouro ?? 0),
    lendaria: Number(r.lendaria ?? 0),
    bestRunId: (r.best_run_id as string) ?? null,
  }));
}
