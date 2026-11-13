-- Ranking global: as melhores temporadas finalizadas de todos os jogadores com
-- conta, visível para todos (inclusive visitantes). Mostra só o necessário
-- para o ranking: nick, avatar, título especial e os números da campanha.
-- E-mail, progresso em andamento e detalhes das partidas não aparecem.

create or replace function public.ranking_global(lim int default 300)
returns table (
  run_id text,
  is_me boolean,
  display_name text,
  game_avatar text,
  title text,
  mode text,
  challenge_label text,
  club_id text,
  team_name text,
  formation text,
  difficulty text,
  points int,
  wins int,
  draws int,
  losses int,
  goals_for int,
  goals_against int,
  final_position int,
  perfect boolean,
  champion boolean,
  triple boolean,
  team_overall int,
  chemistry int,
  captain_name text,
  finished_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select
    s.run_id,
    coalesce(s.user_id = auth.uid(), false),
    p.display_name,
    p.game_avatar,
    st.title,
    s.mode,
    s.entry ->> 'challengeLabel',
    s.club_id,
    s.team_name,
    s.formation,
    s.difficulty,
    s.points,
    s.wins,
    s.draws,
    s.losses,
    s.goals_for,
    s.goals_against,
    s.position,
    s.perfect,
    s.champion,
    s.triple,
    s.team_overall,
    s.chemistry,
    s.captain_name,
    s.finished_at
  from public.seasons s
  join public.profiles p on p.id = s.user_id
  left join public.staff st on st.user_id = s.user_id
  where s.status = 'finished'
  order by s.points desc, s.wins desc, (s.goals_for - s.goals_against) desc, s.goals_for desc, s.finished_at asc
  limit least(greatest(coalesce(lim, 300), 1), 500)
$$;

revoke all on function public.ranking_global(int) from public;
grant execute on function public.ranking_global(int) to anon, authenticated;
