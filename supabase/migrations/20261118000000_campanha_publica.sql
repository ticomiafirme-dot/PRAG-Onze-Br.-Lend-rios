-- Campanha pública: ao clicar numa temporada do ranking, qualquer pessoa vê o
-- perfil do jogador (nick, avatar, título e números da carreira) e a
-- escalação e os destaques daquela temporada. Só temporadas finalizadas (as
-- que estão no ranking). O e-mail e o progresso em andamento nunca aparecem.

create or replace function public.public_season(p_run_id text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'player', jsonb_build_object(
      'name', p.display_name,
      'avatar', p.game_avatar,
      'title', st.title,
      'since', p.created_at,
      'isMe', coalesce(s.user_id = auth.uid(), false),
      'seasons', (select count(*) from public.seasons x where x.user_id = s.user_id and x.status = 'finished'),
      'titles', (select count(*) from public.titles t where t.user_id = s.user_id),
      'perfect', (select count(*) from public.seasons x where x.user_id = s.user_id and x.status = 'finished' and x.perfect),
      'bestPoints', (select max(x.points) from public.seasons x where x.user_id = s.user_id and x.status = 'finished')
    ),
    'entry', s.entry,
    'details', case when s.details is null then null else jsonb_build_object(
      'lineup', coalesce(s.details -> 'lineup', '[]'::jsonb),
      'sequence', coalesce(s.details -> 'sequence', '[]'::jsonb),
      'topScorer', s.details -> 'topScorer',
      'bestPlayer', s.details -> 'bestPlayer',
      'leagueTopScorer', s.details -> 'leagueTopScorer',
      'marks', coalesce(s.details -> 'marks', '[]'::jsonb),
      'copa', s.details -> 'copa',
      'estadual', s.details -> 'estadual',
      'standings', coalesce(s.details -> 'standings', '[]'::jsonb),
      'players', coalesce(s.details -> 'players', '[]'::jsonb),
      'matches', '[]'::jsonb,
      'rounds', s.details -> 'rounds'
    ) end
  )
  from public.seasons s
  join public.profiles p on p.id = s.user_id
  left join public.staff st on st.user_id = s.user_id
  where s.run_id = p_run_id and s.status = 'finished'
  order by s.finished_at
  limit 1
$$;

revoke all on function public.public_season(text) from public;
grant execute on function public.public_season(text) to anon, authenticated;
