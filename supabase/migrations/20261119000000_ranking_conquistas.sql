-- Ranking de conquistas: os jogadores com conta ordenados pela pontuação das
-- medalhas (bronze 1, prata 2, ouro 3, lendária 5). Visível para todos.
-- Mostra só nick, avatar, título especial, contagem por raridade e a melhor
-- campanha (para abrir o perfil). E-mail e ids de usuário não aparecem.
-- Desempate: mais lendárias, mais ouros, mais conquistas, quem chegou antes.

create or replace function public.ranking_conquistas(lim int default 100)
returns table (
  is_me boolean,
  display_name text,
  game_avatar text,
  title text,
  points int,
  total int,
  bronze int,
  prata int,
  ouro int,
  lendaria int,
  best_run_id text,
  last_unlocked_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select
    coalesce(a.user_id = auth.uid(), false),
    p.display_name,
    p.game_avatar,
    st.title,
    sum(case a.tier when 'bronze' then 1 when 'prata' then 2 when 'ouro' then 3 when 'lendaria' then 5 else 0 end)::int,
    count(*)::int,
    (count(*) filter (where a.tier = 'bronze'))::int,
    (count(*) filter (where a.tier = 'prata'))::int,
    (count(*) filter (where a.tier = 'ouro'))::int,
    (count(*) filter (where a.tier = 'lendaria'))::int,
    (
      select s.run_id from public.seasons s
      where s.user_id = a.user_id and s.status = 'finished'
      order by s.points desc, s.wins desc, s.finished_at asc
      limit 1
    ),
    max(a.unlocked_at)
  from public.user_achievements a
  join public.profiles p on p.id = a.user_id
  left join public.staff st on st.user_id = a.user_id
  group by a.user_id, p.display_name, p.game_avatar, st.title
  order by 5 desc, 10 desc, 9 desc, 6 desc, 12 asc
  limit least(greatest(coalesce(lim, 100), 1), 500)
$$;

revoke all on function public.ranking_conquistas(int) from public;
grant execute on function public.ranking_conquistas(int) to anon, authenticated;
