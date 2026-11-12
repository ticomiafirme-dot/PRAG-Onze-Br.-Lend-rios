# Fontes

## Jogadores

- **Wikipédia em português** — infobox dos artigos dos jogadores (passagens por clube com anos, jogos e gols; posição; nacionalidade; jogos pela seleção). Categorias consultadas: `Futebolistas do <clube>` e `Goleiros do <clube>` para os 24 clubes da base.
- **Wikipédia em inglês** — `Infobox football biography`, apenas para artigos em português sem infobox de futebolista (ex.: Pelé, Romário, João Leite, Donato).
- Cada registro em `src/data/players/<clube>.json` traz o campo `source` com a URL do artigo usado. A tabela completa está em [`docs/jogadores.csv`](jogadores.csv).
- Data da coleta: novembro de 2026. As infobox podem ter sido atualizadas depois.

### Correções conhecidas da fonte

- Sidney Moraes: a infobox registra 97 jogos pela seleção brasileira, número incompatível com a carreira; a nota foi definida pela curadoria (77).

## Fotos

- **Wikimedia Commons** — apenas imagens hospedadas no Commons (que exige licenças livres), a partir do campo de imagem da infobox. Autor e licença de cada foto ficam no próprio registro do jogador (`photo.author`, `photo.license`, `photo.page`) e são listados na tela **Fontes** do jogo.
- Sem foto livre, o jogo mostra um avatar com as iniciais nas cores do clube.

## Clubes e títulos

- Artigos dos clubes na Wikipédia em português (fundação, estádio, apelido, história).
- Listas de campeões: Campeonato Brasileiro (com a unificação de 2010 da Taça Brasil e do Torneio Roberto Gomes Pedrosa), Copa do Brasil e Copa Libertadores — até a temporada 2025. Os campeões de 2025 (Brasileirão e Libertadores: Flamengo; Copa do Brasil: Corinthians) foram conferidos nos artigos das edições.
- Em 1987, considera-se o campeão oficial reconhecido pela CBF (Sport).

## Identidade visual

- Emblemas dos clubes: desenhos originais do jogo (forma, padrão e sigla nas cores de cada clube). Não reproduzem escudos oficiais.
- Paleta inspirada nas cores do Brasileirão (azul royal, amarelo-ouro, prata e branco) — sem uso do logotipo oficial.
- Fontes tipográficas: Barlow e Barlow Condensed (SIL Open Font License), empacotadas via `@fontsource`.

## Reproduzir a coleta

```bash
npm run data:harvest   # categorias + wikitexto (pt.wikipedia, action=raw)
npm run data:enwiki    # complemento en.wikipedia para artigos sem infobox
npm run data:extract   # passagens por clube -> data-src/cache/persons.json
npm run data:photos    # licenças/autoria no Wikimedia Commons
npm run data:build     # gera src/data/players/*.json (aplica a curadoria)
npm run data:csv       # gera docs/jogadores.csv
```

O cache bruto (`data-src/cache/`) não é versionado. A curadoria editorial fica em `data-src/curation/`.
