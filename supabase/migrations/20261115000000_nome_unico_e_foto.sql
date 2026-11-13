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
