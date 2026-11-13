# Avatares dos jogadores

Cada jogador tem um avatar ilustrado em estilo vetorial (traço escuro, sombras chapadas, enquadramento circular com cabeça, ombros e peito), como uma figurinha de álbum. Os avatares são desenhados por código, em SVG: não usam fotos, não fazem requisições e nunca aparecem quebrados.

## Um avatar por jogador e clube

O avatar é definido por **jogador + clube + década** (a mesma chave da carta do draft, `id@clube@década`):

- **Camisa do clube**: cores e desenho tradicionais da camisa 1 (listras, faixas, faixa diagonal, listras com filete), com o emblema do clube no peito. Uniformes em `src/avatars/kits.ts`.
- **Gola da época**: polo com cordão (anos 50), gola redonda (60), gola canelada (70), gola V (80), gola polo (90), V moderna (2000) e gola redonda moderna (2010 em diante).
- **Goleiros** usam camisa de goleiro (cores típicas da época), com gola e detalhes nas cores do clube.
- **Fundo e aro na cor da carta**: Lenda (dourado), Ídolo (ouro escuro), Craque (prata), Titular (azul) e Elenco (grafite).

Assim, Sócrates aparece com a camisa do Corinthians, do Flamengo e do Santos, cada uma com seu avatar, e o rosto é o mesmo nos três.

## Aparência

`src/avatars/looksData.ts` guarda os traços gerais e públicos dos jogadores mais conhecidos (tom de pele, penteado marcante, cor do cabelo, barba ou bigode, faixa na cabeça), para lembrar o jogador sem reproduzir o rosto real. Quando o visual mudou na carreira, cada época ou clube tem o seu:

```ts
'ronaldinho-gaucho': { base: '4Wk0h+', '1990s': '4Sk0+', '2000s': '4Sk0+' },  // curto no Grêmio, longo com faixa no Atlético-MG
'ronaldo-nazario': { base: '4Bk0+', '1990s': '4Zk0+' },                        // curto no Cruzeiro, raspado no Corinthians
neymar: { base: '3Tds+', '2000s': '3Xd0+', '2010s': '3Xd0+' },                 // moicano no Santos
```

O código tem quatro partes: tom de pele (1 a 6), penteado, cor do cabelo e barba, mais marcadores opcionais (`h` faixa, `+` sorriso aberto, `=` sério). A legenda completa está no topo do arquivo. A prioridade é `clube@década`, depois `clube`, depois `década` e por fim `base`.

Os jogadores fora da lista recebem um visual **gerado** a partir do próprio id, coerente com a época em que começaram (mais bigodes e cabelos volumosos nos anos 70 e 80, topetes e barbas nos anos 2010...). Para ajustar qualquer jogador, basta incluir o código dele no arquivo.

## Ilustrações próprias

Uma imagem em `src/assets/players/<id-do-jogador>/<id-do-clube>.png` (ou `-<década>.png`) substitui o avatar gerado daquela combinação, com o mesmo fundo e aro da carta. Veja `src/assets/players/README.md`.

## Onde aparecem

Cartas do draft (incluindo a aba Todos), escalação, capitão, pré-temporada, resultado, campo do Hall dos Lendários, escalações das partidas, estatísticas, artilharia, detalhes de temporada do histórico e a lista de jogadores de cada clube.

## Foto de perfil

Qualquer avatar pode virar a foto de perfil: em **Meu Perfil → Trocar foto**, com busca pelo nome do jogador e filtros por clube e por década. Com conta Google, a escolha fica na coluna `profiles.game_avatar` e aparece em todos os aparelhos; como visitante, fica salva no aparelho. A foto aparece no cabeçalho, no menu, no Meu Perfil e no Hall dos Lendários (e, com conta, também na tela inicial).

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `src/avatars/svg.ts` | desenho do avatar (rosto, cabelo, barba, camisa, gola, emblema, fundo e aro) |
| `src/avatars/kits.ts` | camisa de cada clube, camisa de goleiro e gola por década |
| `src/avatars/looks.ts` | códigos de aparência e visual gerado |
| `src/avatars/looksData.ts` | aparência dos jogadores conhecidos, por época e clube |
| `src/avatars/index.ts` | chave do avatar, cache e ilustrações próprias |
| `src/components/PlayerFace.tsx` | componente do avatar |
| `src/components/AvatarPicker.tsx` | escolha da foto de perfil com filtros |
| `supabase/migrations/20261114000000_avatar_perfil.sql` | coluna da foto de perfil na conta |
