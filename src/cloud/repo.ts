// Acesso aos dados na nuvem (Supabase). Cada função opera só sobre o usuário
// logado; as políticas RLS do banco garantem isso também do lado do servidor.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { HistoryData } from '../history/engine';
import type { SeasonDetails, SeasonEntry, TitleRecord, UnlockRecord } from '../history/types';

export interface CloudProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
  created_at: string;
  /** Avatar de jogador escolhido como foto de perfil. */
  game_avatar?: string | null;
}

export interface CloudSave {
  payload: string | null;
  encoding: 'gzip-base64' | 'json';
  run_id: string | null;
  phase: string | null;
  revision: number;
  updated_at: string;
  device: string | null;
}

export class ConflictError extends Error {
  constructor() {
    super('O progresso foi alterado em outro aparelho.');
  }
}

function check<T>(r: { data: T; error: { message: string; code?: string } | null }): T {
  if (r.error) {
    const e = new Error(r.error.message) as Error & { code?: string };
    e.code = r.error.code;
    throw e;
  }
  return r.data;
}

const seasonRow = (uid: string, s: SeasonEntry, details: SeasonDetails | null) => ({
  user_id: uid,
  run_id: s.runId,
  status: s.status,
  mode: s.mode,
  club_id: s.clubId,
  team_name: s.teamName,
  decades: s.decades,
  fixed_decade: s.fixedDecade,
  formation: s.formationId,
  difficulty: s.difficulty,
  started_at: s.startedAt,
  finished_at: s.finishedAt,
  played: s.played,
  position: s.position,
  points: s.points,
  wins: s.wins,
  draws: s.draws,
  losses: s.losses,
  goals_for: s.goalsFor,
  goals_against: s.goalsAgainst,
  squad_overall: s.squadOverall,
  team_overall: s.teamOverall,
  chemistry: s.chemistry,
  captain_name: s.captainName,
  champion: s.champion,
  perfect: s.perfect,
  unbeaten: s.unbeaten,
  copa_champion: s.copaChampion,
  estadual_champion: s.estadualChampion,
  triple: s.triple,
  achievements: s.achievements,
  entry: s,
  ...(details ? { details } : {}),
});

export function createRepo(sb: SupabaseClient, uid: string) {
  return {
    async profile(): Promise<CloudProfile | null> {
      return check(await sb.from('profiles').select('*').eq('id', uid).maybeSingle()) as CloudProfile | null;
    },

    /** Garante o perfil (o gatilho do banco cria no primeiro login; isto cobre bancos sem o gatilho). */
    async ensureProfile(p: { name: string; avatarUrl: string | null; email: string | null }): Promise<CloudProfile> {
      const current = await this.profile();
      if (!current) {
        await sb.from('profiles').insert({ id: uid, display_name: p.name.slice(0, 60), avatar_url: p.avatarUrl, email: p.email });
        return (await this.profile())!;
      }
      // mantém a foto atualizada com a da conta Google
      if (p.avatarUrl && p.avatarUrl !== current.avatar_url) {
        await sb.from('profiles').update({ avatar_url: p.avatarUrl }).eq('id', uid);
        return { ...current, avatar_url: p.avatarUrl };
      }
      return current;
    },

    async setGameAvatar(key: string | null): Promise<void> {
      check(await sb.from('profiles').update({ game_avatar: key }).eq('id', uid));
    },

    async setDisplayName(name: string): Promise<void> {
      check(await sb.from('profiles').update({ display_name: name.slice(0, 60) }).eq('id', uid));
    },

    async history(): Promise<HistoryData> {
      const [seasons, titles, unlocks] = await Promise.all([
        sb.from('seasons').select('entry').eq('user_id', uid).order('started_at'),
        sb.from('titles').select('*').eq('user_id', uid).order('won_at'),
        sb.from('user_achievements').select('*').eq('user_id', uid).order('unlocked_at'),
      ]);
      return {
        seasons: (check(seasons) as { entry: SeasonEntry }[]).map((r) => r.entry),
        titles: (check(titles) as Record<string, unknown>[]).map((t) => ({
          id: t.id as string,
          competitionId: t.competition_id as string,
          competitionName: t.competition_name as string,
          runId: t.run_id as string,
          clubId: (t.club_id as string) ?? null,
          teamName: t.team_name as string,
          decades: (t.decades as TitleRecord['decades']) ?? [],
          fixedDecade: (t.fixed_decade as TitleRecord['fixedDecade']) ?? null,
          formationId: t.formation as TitleRecord['formationId'],
          wonAt: new Date(t.won_at as string).toISOString(),
        })),
        unlocks: (check(unlocks) as Record<string, unknown>[]).map((u) => ({
          id: u.achievement_id as string,
          name: u.name as string,
          tier: u.tier as UnlockRecord['tier'],
          unlockedAt: new Date(u.unlocked_at as string).toISOString(),
          runId: (u.run_id as string) ?? null,
          value: u.value == null ? null : Number(u.value),
          detail: (u.detail as string) ?? null,
        })),
      };
    },

    async details(runId: string): Promise<SeasonDetails | null> {
      const r = check(await sb.from('seasons').select('details').eq('user_id', uid).eq('run_id', runId).maybeSingle()) as { details: SeasonDetails | null } | null;
      return r?.details ?? null;
    },

    /**
     * Grava uma temporada. Em andamento: cria se não existir. Finalizada ou
     * abandonada: conclui a que está em andamento (ou cria já concluída); se
     * já estiver concluída na nuvem, nada muda (registro permanente).
     */
    async putSeason(s: SeasonEntry, details: SeasonDetails | null): Promise<void> {
      const row = seasonRow(uid, s, details);
      if (s.status === 'in_progress') {
        check(await sb.from('seasons').upsert(row, { onConflict: 'user_id,run_id', ignoreDuplicates: true }));
        return;
      }
      const upd = check(await sb.from('seasons').update(row).eq('user_id', uid).eq('run_id', s.runId).eq('status', 'in_progress').select('run_id')) as unknown[];
      if (upd.length) return;
      check(await sb.from('seasons').upsert(row, { onConflict: 'user_id,run_id', ignoreDuplicates: true }));
    },

    async putTitles(titles: TitleRecord[]): Promise<void> {
      if (!titles.length) return;
      const rows = titles.map((t) => ({
        user_id: uid,
        id: t.id,
        competition_id: t.competitionId,
        competition_name: t.competitionName,
        run_id: t.runId,
        club_id: t.clubId,
        team_name: t.teamName,
        decades: t.decades,
        fixed_decade: t.fixedDecade,
        formation: t.formationId,
        won_at: t.wonAt,
      }));
      check(await sb.from('titles').upsert(rows, { onConflict: 'user_id,id', ignoreDuplicates: true }));
    },

    async putUnlocks(unlocks: UnlockRecord[]): Promise<void> {
      if (!unlocks.length) return;
      const rows = unlocks.map((u) => ({
        user_id: uid,
        achievement_id: u.id,
        name: u.name,
        tier: u.tier,
        unlocked_at: u.unlockedAt,
        run_id: u.runId,
        value: u.value,
        detail: u.detail,
      }));
      check(await sb.from('user_achievements').upsert(rows, { onConflict: 'user_id,achievement_id', ignoreDuplicates: true }));
    },

    async loadSave(): Promise<CloudSave | null> {
      return check(await sb.from('game_saves').select('payload, encoding, run_id, phase, revision, updated_at, device').eq('user_id', uid).maybeSingle()) as CloudSave | null;
    },

    /**
     * Grava o progresso com controle de concorrência: só sobrescreve se a
     * nuvem ainda estiver na revisão em que este aparelho se baseou.
     */
    async writeSave(save: { payload: string | null; run_id: string | null; phase: string | null; device: string }, baseRevision: number | null): Promise<{ revision: number; updated_at: string }> {
      if (baseRevision == null) {
        const r = await sb.from('game_saves').insert({ user_id: uid, ...save }).select('revision, updated_at').single();
        if (r.error?.code === '23505') throw new ConflictError();
        return check(r) as { revision: number; updated_at: string };
      }
      const rows = check(await sb.from('game_saves').update(save).eq('user_id', uid).eq('revision', baseRevision).select('revision, updated_at')) as { revision: number; updated_at: string }[];
      if (!rows.length) throw new ConflictError();
      return rows[0];
    },
  };
}

export type CloudRepo = ReturnType<typeof createRepo>;
