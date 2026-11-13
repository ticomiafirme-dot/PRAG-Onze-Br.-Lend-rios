-- PRAG Onze BR Lendário: instalação completa do banco (todas as migrações, em ordem).
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run. Rode uma vez só.
-- Gerado a partir de supabase/migrations/ (não edite à mão).

-- ===== 20261113000000_contas.sql =====
-- PRAG Onze BR Lendário — contas, progresso salvo, histórico de temporadas,
-- títulos e conquistas. Rode este arquivo uma vez no SQL Editor do Supabase
-- (ou com `supabase db push`). Todas as tabelas têm Row Level Security: cada
-- usuário só enxerga e altera os próprios dados.

-- ---------------------------------------------------------------------------
-- 1. Perfis (1:1 com auth.users, criados automaticamente no primeiro login)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 1000),
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Progresso salvo: a partida em andamento (draft, elenco, temporada...)
-- ---------------------------------------------------------------------------
create table public.game_saves (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  payload text,
  encoding text not null default 'gzip-base64' check (encoding in ('gzip-base64', 'json')),
  run_id text check (run_id is null or char_length(run_id) <= 64),
  phase text check (phase is null or char_length(phase) <= 20),
  revision bigint not null default 1,
  device text check (device is null or char_length(device) <= 120),
  updated_at timestamptz not null default now(),
  constraint game_saves_payload_size check (payload is null or octet_length(payload) <= 3000000)
);

-- ---------------------------------------------------------------------------
-- 3. Temporadas: registro permanente de cada campanha
-- ---------------------------------------------------------------------------
create table public.seasons (
  user_id uuid not null references public.profiles (id) on delete cascade,
  run_id text not null check (char_length(run_id) between 1 and 64),
  status text not null check (status in ('in_progress', 'finished', 'abandoned')),
  mode text not null,
  club_id text,
  team_name text not null,
  decades text[] not null default '{}',
  fixed_decade text,
  formation text not null,
  difficulty text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  played int not null default 0 check (played between 0 and 80),
  position int check (position between 1 and 40),
  points int not null default 0 check (points between 0 and 240),
  wins int not null default 0 check (wins >= 0),
  draws int not null default 0 check (draws >= 0),
  losses int not null default 0 check (losses >= 0),
  goals_for int not null default 0 check (goals_for >= 0),
  goals_against int not null default 0 check (goals_against >= 0),
  squad_overall numeric(4, 1) not null default 0 check (squad_overall between 0 and 99),
  team_overall int not null default 0 check (team_overall between 0 and 99),
  chemistry int not null default 0 check (chemistry between 0 and 100),
  captain_name text,
  champion boolean not null default false,
  perfect boolean not null default false,
  unbeaten boolean not null default false,
  copa_champion boolean not null default false,
  estadual_champion boolean not null default false,
  triple boolean not null default false,
  achievements text[] not null default '{}',
  -- registro completo (formato do jogo) e detalhes (escalação, tabela, jogos, estatísticas)
  entry jsonb not null,
  details jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, run_id),
  constraint seasons_entry_size check (pg_column_size(entry) <= 20000),
  constraint seasons_details_size check (details is null or pg_column_size(details) <= 400000),
  constraint seasons_finished_date check (status = 'in_progress' or finished_at is not null)
);

create index seasons_user_started_idx on public.seasons (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- 4. Títulos (cada troféu conquistado, ligado à sua temporada)
-- ---------------------------------------------------------------------------
create table public.titles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  id text not null check (char_length(id) <= 140),
  competition_id text not null check (char_length(competition_id) <= 60),
  competition_name text not null,
  run_id text not null,
  club_id text,
  team_name text not null,
  decades text[] not null default '{}',
  fixed_decade text,
  formation text not null,
  won_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, run_id, competition_id),
  foreign key (user_id, run_id) references public.seasons (user_id, run_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- 5. Conquistas desbloqueadas (nome e raridade guardados como eram no desbloqueio)
-- ---------------------------------------------------------------------------
create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null check (char_length(achievement_id) <= 60),
  name text not null check (char_length(name) <= 80),
  tier text not null check (tier in ('bronze', 'prata', 'ouro', 'lendaria')),
  unlocked_at timestamptz not null,
  run_id text check (run_id is null or char_length(run_id) <= 64),
  value numeric,
  detail text check (detail is null or char_length(detail) <= 200),
  created_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- ---------------------------------------------------------------------------
-- Gatilhos
-- ---------------------------------------------------------------------------

-- perfil criado no primeiro login com os dados da conta Google
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url, email)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1), ''), 60),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- perfil: data de criação e dono não mudam
create function public.profiles_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.id := old.id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- progresso: cada gravação incrementa a revisão (controle de concorrência entre aparelhos)
create function public.game_saves_bump() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.user_id := old.user_id;
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;

create trigger game_saves_bump before update on public.game_saves
  for each row execute function public.game_saves_bump();

-- temporada finalizada ou abandonada é permanente: não pode ser alterada
create function public.seasons_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status <> 'in_progress' then
    raise exception 'Temporada % já está registrada como %, e o registro é permanente.', old.run_id, old.status
      using errcode = 'check_violation';
  end if;
  new.user_id := old.user_id;
  new.run_id := old.run_id;
  new.started_at := old.started_at;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger seasons_guard before update on public.seasons
  for each row execute function public.seasons_guard();

-- ---------------------------------------------------------------------------
-- Row Level Security: cada usuário só acessa os próprios registros
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.game_saves enable row level security;
alter table public.seasons enable row level security;
alter table public.titles enable row level security;
alter table public.user_achievements enable row level security;

create policy "perfil: ler o próprio" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "perfil: criar o próprio" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "perfil: editar o próprio" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "progresso: ler o próprio" on public.game_saves
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "progresso: criar o próprio" on public.game_saves
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "progresso: atualizar o próprio" on public.game_saves
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "progresso: apagar o próprio" on public.game_saves
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "temporadas: ler as próprias" on public.seasons
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "temporadas: registrar as próprias" on public.seasons
  for insert to authenticated with check ((select auth.uid()) = user_id);
-- só uma temporada em andamento pode ser concluída/abandonada (sem exclusão)
create policy "temporadas: concluir as próprias em andamento" on public.seasons
  for update to authenticated using ((select auth.uid()) = user_id and status = 'in_progress') with check ((select auth.uid()) = user_id);

create policy "títulos: ler os próprios" on public.titles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "títulos: registrar os próprios" on public.titles
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "conquistas: ler as próprias" on public.user_achievements
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "conquistas: registrar as próprias" on public.user_achievements
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- visitantes sem login não acessam nenhuma tabela; usuários logados só têm
-- os privilégios necessários (sem exclusão de histórico, títulos ou conquistas)
revoke all on table public.profiles, public.game_saves, public.seasons, public.titles, public.user_achievements from anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.game_saves to authenticated;
grant select, insert, update on table public.seasons to authenticated;
grant select, insert on table public.titles to authenticated;
grant select, insert on table public.user_achievements to authenticated;

-- ===== 20261114000000_avatar_perfil.sql =====
-- Foto de perfil: avatar de jogador escolhido pelo usuário.
-- Guarda só a chave da carta (jogador@clube@década); a imagem é gerada no jogo.
-- As políticas de "perfil: editar o próprio" já cobrem a coluna nova.

alter table public.profiles
  add column if not exists game_avatar text
  constraint profiles_game_avatar_format check (
    game_avatar is null
    or (char_length(game_avatar) <= 160 and game_avatar ~ '^[a-z0-9-]+@[a-z0-9-]+@(19|20)[0-9]0s$')
  );

-- ===== 20261115000000_nome_unico_e_foto.sql =====
-- 1. Nome de exibição único: dois jogadores não podem usar o mesmo nome.
--    A comparação ignora maiúsculas, acentos e espaços repetidos
--    ("João Silva" = "joao  silva").
-- 2. Foto de perfil só com avatar de jogador: o jogo deixa de guardar e de
--    mostrar a foto da conta Google.

update public.profiles set avatar_url = null where avatar_url is not null;

-- chave de comparação do nome
create or replace function public.name_key(n text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select regexp_replace(
    lower(translate(btrim(coalesce(n, '')),
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')),
    '\s+', ' ', 'g')
$$;

-- nomes repetidos que já existam ganham um número ("Nome 2", "Nome 3"...)
with repetidos as (
  select id, row_number() over (partition by public.name_key(display_name) order by created_at, id) as n
  from public.profiles
  where public.name_key(display_name) <> ''
)
update public.profiles p
set display_name = left(p.display_name, 55) || ' ' || r.n
from repetidos r
where r.id = p.id and r.n > 1;

create unique index if not exists profiles_display_name_unique
  on public.profiles (public.name_key(display_name))
  where public.name_key(display_name) <> '';

-- primeiro nome livre a partir do desejado: "Nome", "Nome 2", "Nome 3"...
create or replace function public.unique_display_name(wanted text, me uuid default null) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  base text := left(nullif(btrim(regexp_replace(coalesce(wanted, ''), '\s+', ' ', 'g')), ''), 50);
  candidate text;
  n int := 1;
begin
  if base is null then
    base := 'Jogador';
  end if;
  candidate := base;
  while exists (
    select 1 from public.profiles p
    where public.name_key(p.display_name) = public.name_key(candidate)
      and (me is null or p.id <> me)
  ) loop
    n := n + 1;
    candidate := base || ' ' || n;
  end loop;
  return candidate;
end;
$$;

-- perfil criado no primeiro login: usa o nome da conta Google, ou o próximo livre (sem a foto)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wanted text := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(coalesce(new.email, ''), '@', 1),
    ''
  );
  tries int := 0;
begin
  loop
    begin
      insert into public.profiles (id, display_name, avatar_url, email)
      values (
        new.id,
        public.unique_display_name(wanted, new.id),
        null, -- a foto do Google não é usada: a foto de perfil é um avatar de jogador
        new.email
      )
      on conflict (id) do nothing;
      exit;
    exception when unique_violation then
      -- outro cadastro simultâneo pegou o mesmo nome: tenta de novo
      tries := tries + 1;
      if tries >= 5 then
        wanted := left(wanted, 40) || ' ' || substr(replace(new.id::text, '-', ''), 1, 4);
      end if;
      if tries >= 10 then
        raise;
      end if;
    end;
  end loop;
  return new;
end;
$$;

-- o jogo pergunta se um nome está livre (sem expor de quem é)
create or replace function public.display_name_available(wanted text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.name_key(wanted) <> ''
    and not exists (
      select 1 from public.profiles p
      where public.name_key(p.display_name) = public.name_key(wanted)
        and p.id is distinct from auth.uid()
    )
$$;

revoke all on function public.unique_display_name(text, uuid) from public;
revoke all on function public.display_name_available(text) from public;
grant execute on function public.display_name_available(text) to authenticated;

-- ===== 20261116000000_titulos_especiais.sql =====
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

