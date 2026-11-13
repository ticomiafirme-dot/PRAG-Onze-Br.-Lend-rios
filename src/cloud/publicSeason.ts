// Campanha pública de uma temporada do ranking (função public_season do banco).
import type { SeasonDetails, SeasonEntry } from '../history/types';
import { getSupabase } from './supabase';

export interface PublicPlayer {
  name: string;
  avatar: string | null;
  title: string | null;
  since: string | null;
  isMe: boolean;
  seasons: number;
  titles: number;
  perfect: number;
  bestPoints: number | null;
}

export interface PublicSeason {
  player: PublicPlayer;
  entry: SeasonEntry;
  details: SeasonDetails | null;
}

/** null: não encontrada (ou não finalizada); undefined: sem conexão com a nuvem. */
export async function loadPublicSeason(runId: string): Promise<PublicSeason | null | undefined> {
  const sb = getSupabase();
  if (!sb) return undefined;
  const { data, error } = await sb.rpc('public_season', { p_run_id: runId });
  if (error) return undefined;
  if (!data) return null;
  const j = data as { player: Record<string, unknown>; entry: SeasonEntry; details: SeasonDetails | null };
  const p = j.player;
  return {
    player: {
      name: String(p.name ?? 'Jogador'),
      avatar: (p.avatar as string | null) ?? null,
      title: (p.title as string | null) ?? null,
      since: (p.since as string | null) ?? null,
      isMe: Boolean(p.isMe),
      seasons: Number(p.seasons ?? 0),
      titles: Number(p.titles ?? 0),
      perfect: Number(p.perfect ?? 0),
      bestPoints: p.bestPoints == null ? null : Number(p.bestPoints),
    },
    entry: j.entry,
    details: j.details,
  };
}
