// Testa o esquema do banco (tabelas, gatilhos e políticas RLS) num Postgres
// real embutido (PGlite), simulando o ambiente do Supabase: esquema auth,
// função auth.uid() e os papéis anon/authenticated.
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
let db: PGlite;

async function as(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec('reset role');
  if (user) {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user]);
    await db.exec('set role authenticated');
  } else {
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
    await db.exec('set role anon');
  }
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}

const season = (user: string, runId: string, extra: Record<string, unknown> = {}) => ({
  user_id: user,
  run_id: runId,
  status: 'in_progress',
  mode: 'classico',
  club_id: 'santos',
  team_name: 'Santos',
  formation: '4-3-3',
  difficulty: 'normal',
  started_at: '2026-11-01T12:00:00Z',
  entry: JSON.stringify({ runId }),
  ...extra,
});

async function insertSeason(user: string, s: Record<string, unknown>) {
  const cols = Object.keys(s);
  return as(user, `insert into public.seasons (${cols.join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(s));
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
  `);
  await db.exec(fs.readFileSync('supabase/migrations/20261113000000_contas.sql', 'utf8'));
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values ($1, 'a@exemplo.com', '{"full_name":"Jogador A","avatar_url":"https://exemplo.com/a.png"}'), ($2, 'b@exemplo.com', '{"name":"Jogador B"}')`,
    [A, B],
  );
}, 60_000);

describe('esquema e segurança (RLS)', () => {
  it('primeiro login cria o perfil com os dados da conta Google', async () => {
    const r = await as(A, 'select display_name, avatar_url, email from public.profiles');
    expect(r.rows).toEqual([{ display_name: 'Jogador A', avatar_url: 'https://exemplo.com/a.png', email: 'a@exemplo.com' }]);
    const rb = await as(B, 'select display_name from public.profiles');
    expect(rb.rows).toEqual([{ display_name: 'Jogador B' }]);
  });

  it('visitante sem login não acessa nada', async () => {
    await expect(as(null, 'select * from public.seasons')).rejects.toThrow(/permission denied/);
    await expect(as(null, 'select * from public.profiles')).rejects.toThrow(/permission denied/);
  });

  it('cada usuário só vê e altera os próprios dados', async () => {
    await insertSeason(A, season(A, 'run-a1'));
    expect((await as(A, 'select run_id from public.seasons')).rows).toEqual([{ run_id: 'run-a1' }]);
    expect((await as(B, 'select run_id from public.seasons')).rows).toEqual([]);
    await expect(insertSeason(B, season(A, 'run-falsa'))).rejects.toThrow(/row-level security/);
    const upd = await as(B, `update public.seasons set points = 99 where run_id = 'run-a1'`);
    expect(upd.affectedRows).toBe(0);
    const prof = await as(B, `update public.profiles set display_name = 'outro' where id = $1`, [A]);
    expect(prof.affectedRows).toBe(0);
  });

  it('temporada finalizada é permanente', async () => {
    await insertSeason(A, season(A, 'run-a2'));
    const fin = await as(A, `update public.seasons set status = 'finished', finished_at = now(), points = 100 where run_id = 'run-a2' and status = 'in_progress'`);
    expect(fin.affectedRows).toBe(1);
    const again = await as(A, `update public.seasons set points = 0 where run_id = 'run-a2'`);
    expect(again.affectedRows).toBe(0);
    await expect(db.query(`update public.seasons set points = 0 where run_id = 'run-a2'`)).rejects.toThrow(/permanente/);
    await expect(as(A, `delete from public.seasons where run_id = 'run-a2'`)).rejects.toThrow(/permission denied/);
    expect((await as(A, `select points from public.seasons where run_id = 'run-a2'`)).rows).toEqual([{ points: 100 }]);
  });

  it('títulos ligados à temporada e conquistas sem duplicar', async () => {
    const sql = `insert into public.titles (user_id, id, competition_id, competition_name, run_id, club_id, team_name, formation, won_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`;
    await as(A, sql, [A, 'run-a2:brasileirao', 'brasileirao', 'Campeonato Brasileiro', 'run-a2', 'santos', 'Santos', '4-3-3', '2026-11-02T00:00:00Z']);
    await expect(as(A, sql, [A, 'x:brasileirao', 'brasileirao', 'Campeonato Brasileiro', 'nao-existe', 'santos', 'Santos', '4-3-3', '2026-11-02T00:00:00Z'])).rejects.toThrow(/foreign key/);
    expect((await as(B, 'select id from public.titles')).rows).toEqual([]);

    const ach = `insert into public.user_achievements (user_id, achievement_id, name, tier, unlocked_at, run_id, value) values ($1, 'artilheiro', 'Artilheiro', 'bronze', $2, 'run-a2', 120) on conflict do nothing`;
    await as(A, ach, [A, '2026-11-02T00:00:00Z']);
    await as(A, ach, [A, '2026-12-25T00:00:00Z']);
    const rows = (await as(A, 'select achievement_id, unlocked_at from public.user_achievements')).rows as { unlocked_at: Date }[];
    expect(rows).toHaveLength(1);
    expect(new Date(rows[0].unlocked_at).toISOString()).toBe('2026-11-02T00:00:00.000Z');
    await expect(as(A, `update public.user_achievements set unlocked_at = now()`)).rejects.toThrow(/permission denied/);
    await expect(as(A, `delete from public.user_achievements`)).rejects.toThrow(/permission denied/);
  });

  it('progresso salvo: revisão sobe a cada gravação e é privado', async () => {
    await as(A, `insert into public.game_saves (user_id, payload, run_id, phase) values ($1, 'abc', 'run-a3', 'draft')`, [A]);
    await as(A, `update public.game_saves set payload = 'def' where user_id = $1`, [A]);
    await as(A, `update public.game_saves set payload = 'ghi' where user_id = $1 and revision = 2`, [A]);
    expect((await as(A, 'select payload, revision from public.game_saves')).rows).toEqual([{ payload: 'ghi', revision: 3 }]);
    const stale = await as(A, `update public.game_saves set payload = 'velho' where user_id = $1 and revision = 2`, [A]);
    expect(stale.affectedRows).toBe(0);
    expect((await as(B, 'select payload from public.game_saves')).rows).toEqual([]);
  });
});
