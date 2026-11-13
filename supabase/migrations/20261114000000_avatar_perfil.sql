-- Foto de perfil: avatar de jogador escolhido pelo usuário.
-- Guarda só a chave da carta (jogador@clube@década); a imagem é gerada no jogo.
-- As políticas de "perfil: editar o próprio" já cobrem a coluna nova.

alter table public.profiles
  add column if not exists game_avatar text
  constraint profiles_game_avatar_format check (
    game_avatar is null
    or (char_length(game_avatar) <= 160 and game_avatar ~ '^[a-z0-9-]+@[a-z0-9-]+@(19|20)[0-9]0s$')
  );
