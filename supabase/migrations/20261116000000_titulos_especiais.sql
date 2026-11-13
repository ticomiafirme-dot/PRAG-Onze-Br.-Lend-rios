-- Títulos especiais (ex.: PRESIDENTE, para o fundador do jogo).
-- Ficam numa tabela separada do perfil: os jogadores podem ler, mas ninguém
-- consegue se dar um título pelo jogo. Só o dono do banco (SQL Editor do
-- Supabase) concede ou remove títulos:
--
--   insert into public.staff (user_id, title)
--   select id, 'Presidente' from public.profiles where display_name = 'SEU NICK';
--
--   delete from public.staff where user_id = (select id from public.profiles where display_name = 'SEU NICK');

create table if not exists public.staff (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 30),
  created_at timestamptz not null default now()
);

alter table public.staff enable row level security;

drop policy if exists "títulos especiais: jogadores logados veem" on public.staff;
create policy "títulos especiais: jogadores logados veem" on public.staff
  for select to authenticated using (true);

revoke all on table public.staff from anon, authenticated;
grant select on table public.staff to authenticated;

-- Avatar exclusivo do fundador: só quem tem título especial pode usá-lo.
create or replace function public.profiles_exclusive_avatar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.game_avatar = 'presidente@prag@2020s'
     and not exists (select 1 from public.staff s where s.user_id = new.id) then
    raise exception 'Este avatar é exclusivo do fundador do jogo.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_exclusive_avatar on public.profiles;
create trigger profiles_exclusive_avatar before insert or update of game_avatar on public.profiles
  for each row execute function public.profiles_exclusive_avatar();

revoke all on function public.profiles_exclusive_avatar() from public;
