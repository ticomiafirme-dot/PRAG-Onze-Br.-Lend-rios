# Onze BR Lendário PRAG

Jogo de futebol brasileiro em que você monta o **time dos sonhos com lendas de um clube, década a década**, e tenta a **temporada perfeita no Brasileirão: 38 jogos, 38 vitórias**.

Inspirado nas mecânicas de draft por sorteio do Perfect Season FC, com identidade própria e focado exclusivamente no futebol brasileiro.

## Como jogar

1. **Escolha o clube** — 20 clubes do Brasileirão (+ 4 convidados dos estaduais de PE e GO).
2. **Escolha a década** — "Todas as décadas" (modo Clássico, com sorteio) ou uma era específica (Era Única).
3. **Escolha a formação** — 4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 4-1-4-1, 3-4-3 ou 4-2-4 — e o nível dos rivais.
4. **Draft** — a cada rodada uma década é sorteada; escolha um jogador dela para uma vaga livre. 11 rodadas, **5 novos sorteios**. Sem repetir jogador e sempre na categoria em que ele jogou de verdade.
5. **Escalação e química** — ligações entre vizinhos por clube, década e nacionalidade. Jogadores da mesma categoria trocam de vaga livremente.
6. **Capitão** — +3 de overall, faixa de capitão e química em dobro.
7. **Pré-temporada** — força por setor, química e os 19 rivais (cada um escalado com lendas da própria história).
8. **Brasileirão** — 38 rodadas em turno e returno. Assista às partidas em 1x/2x/4x ou pule para o resultado.
9. **Estatísticas, resultado final e ranking.**
10. **Arte do resultado e da escalação** — cards PNG 1080 × 1350 gerados com os dados reais da temporada (o resultado e o time em campo na formação usada, com avatares, números, overall e capitão): baixar, copiar a imagem ou compartilhar direto (celular).

### Sua trajetória

- **Login com Google** (opcional): progresso, histórico, títulos, conquistas e recordes salvos na nuvem e sincronizados entre computador e celular. Também dá para jogar como visitante (dados no aparelho). Configuração em [`docs/CONTAS.md`](docs/CONTAS.md).
- **Meu Histórico** — cada temporada fica registrada para sempre, com escalação, tabela, jogos e estatísticas; dá para gerar de novo as artes (resultado e escalação) de qualquer temporada antiga.
- **Conquistas** — Temporada Perfeita, Muralha, Artilheiro, Lendas Reunidas, Invencível, Rei do Brasil e outras, com raridade (bronze, prata, ouro, lendária), comemoração animada e arte para compartilhar.
- **Meus Recordes** — campanha, ataque, defesa e elenco, sempre com a temporada em que foram alcançados.
- **Hall dos Lendários** — a sala de troféus pessoal: troféus por competição, medalhas, grandes campanhas e o maior elenco no campo.

### Modos

| Modo | Como funciona |
| --- | --- |
| Clássico | Você escolhe o clube; as décadas são sorteadas a cada rodada |
| Era Única | Clube e década fixos; três jogadores sorteados por categoria a cada rodada |
| Mistura Brasileira | Clube e década sorteados a cada rodada |
| Desafio Diário | Mesmo clube, década, formação e sorteios para todos; uma tentativa por dia (fuso de Brasília) |
| Desafio Semanal | Um clube por semana, nível Difícil, sorteios iguais para todos |
| Tríplice Coroa | Estadual + Copa do Brasil (mata-mata com pênaltis) + Brasileirão na mesma temporada |

O progresso é salvo automaticamente no navegador (localStorage) e, com login, também na nuvem.

### Posições: 4 categorias

| Categoria | Inclui |
| --- | --- |
| **GOL** — Goleiros | goleiros |
| **DEF** — Defensores | zagueiros e laterais |
| **MEI** — Meio-campistas | volantes, meias centrais, meias ofensivos |
| **ATA** — Atacantes | centroavantes, pontas e segundos atacantes |

Qualquer jogador de uma categoria ocupa qualquer vaga dela. Um jogador pertence às categorias da sua função principal e das secundárias registradas (ex.: lateral que também atuou no meio é DEF e MEI). Distribuição por formação: 4-3-3 (1/4/3/3), 4-4-2 (1/4/4/2), 4-2-3-1 (1/4/4/2), 3-5-2 (1/3/5/2), 4-1-4-1 (1/4/5/1), 3-4-3 (1/3/4/3) e 4-2-4 (1/4/2/4).

## Rodando

Requisitos: Node 20.19+ (ou 22).

```bash
npm install
npm run dev
```

Outros comandos:

```bash
npm run build          # site estático em dist/ (caminhos relativos; serve em qualquer hospedagem)
npm run build:single   # um único HTML autocontido em dist-single/
npm run build:artifact # página autocontida para publicar no Claude (ranking compartilhado via db/user)
npm test               # testes do motor, do histórico/conquistas e das regras do banco (Vitest + PGlite)
npm run e2e            # fluxo completo no navegador (desktop e celular) — requer `npx vite preview --port 4173`
npm run e2e:modes      # Mistura, Diário, Era Única e Tríplice Coroa
npm run e2e:cloud      # login Google, salvamento automático e dois aparelhos (Supabase simulado; ver docs/CONTAS.md)
```

### Publicar

O `dist/` é estático. O repositório já traz o `netlify.toml`: no Netlify, basta importar o repositório do GitHub e publicar. O passo a passo, incluindo o login com Google e o domínio próprio, está em [docs/NETLIFY.md](docs/NETLIFY.md).

## Base de dados

- **24 clubes** (`src/data/clubs.ts`): nome, cores, emblema original, estádio, fundação, história, títulos (Brasileirão, Copa do Brasil, Libertadores até 2025) e décadas disponíveis.
- **4.726 registros jogador-clube** (`src/data/players/<clube>.json`, 2.872 jogadores diferentes, 5.659 cartas jogador-clube-década, elencos atualizados até 2026), cada um com: id, nome, nome completo, nacionalidade, posição principal e secundárias, passagem (anos), **overall por década**, jogos e gols pelo clube, jogos pela seleção, descrição, foto livre (com autor e licença) e **URL da fonte**.
- Tabela completa em [`docs/jogadores.csv`](docs/jogadores.csv).
- **Nenhuma passagem é inventada**: a década de cada jogador vem dos anos registrados na infobox da Wikipédia. Veja [`docs/FONTES.md`](docs/FONTES.md).
- **Notas editoriais** (não oficiais): 855 definidas pela curadoria (`data-src/curation/`) e as demais por fórmula documentada. Veja [`docs/METODOLOGIA.md`](docs/METODOLOGIA.md).

### Adicionando clubes e jogadores

1. Adicione o clube em `src/data/clubs.ts` e o mapeamento da categoria em `scripts/data/wiki-clubs.mjs`.
2. Rode `npm run data:harvest -- <id>`, `npm run data:extract`, `npm run data:photos` e `npm run data:build`.
3. Ajuste notas e posições em `data-src/curation/<id>.txt` (`Nome ou título | nota [década=nota] | posições | observação | nome de exibição`) e rode `npm run data:build` de novo.

## Arquitetura

```
src/
  data/        tipos, clubes, formações e base de jogadores (JSON por clube)
  engine/      lógica pura e testável
    rng.ts         gerador com semente (crypto para sorteios reais; data para desafios)
    database.ts    índices por clube/década e categorias de cada jogador
    draft.ts       sorteios, ofertas, novos sorteios e validação (inclui viabilidade das posições restantes)
    matching.ts    emparelhamento vagas × jogadores por categoria (Kuhn e algoritmo húngaro)
    chemistry.ts   ligações, química individual/do time e capitão
    team.ts        força por setor, times da IA e dificuldade
    match.ts       simulação minuto a minuto com eventos, estatísticas e notas
    league.ts      tabela em turno e returno, classificação e artilharia
    cup.ts         mata-mata ida e volta e pênaltis
    campaign.ts    calendário (Brasileirão, Copa do Brasil, estaduais) e estatísticas da temporada
    challenges.ts  desafios diário e semanal
  history/     temporadas, títulos, conquistas, recordes e estatísticas de carreira
  cloud/       login com Google (Supabase Auth), sincronização e acesso ao banco
  share/       artes de compartilhamento (canvas → PNG) e a janela de compartilhar
  state/       estado do jogo (Zustand + persistência) e ranking local
  screens/     as telas do jogo
  components/  carta de jogador, campo, emblemas, bandeiras, logotipo
scripts/data/  pipeline de coleta e montagem da base
supabase/      migração SQL (tabelas, relacionamentos, gatilhos e RLS)
```

O backend das contas é o Supabase (Auth + Postgres com RLS), configurado por variáveis de ambiente; sem elas, o jogo roda como visitante. O ranking é salvo no dispositivo (`state/storage.ts`). Quando o jogo roda como página publicada no Claude, `state/sharedRanking.ts` também grava as campanhas em um ranking compartilhado entre todos que abrem o link (um documento por jogador, nomes resolvidos pelo perfil). Outro serviço de ranking pode ser plugado no mesmo ponto.

## Créditos

Dados históricos: Wikipédia (pt/en). Avatares dos jogadores, emblemas e identidade visual: originais, sem fotos (veja [docs/AVATARES.md](docs/AVATARES.md)). Projeto de fã, sem vínculo com clubes, federações ou com o Perfect Season FC.
