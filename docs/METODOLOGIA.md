# Metodologia — Onze BR Lendário PRAG

Este documento descreve como a base de jogadores foi construída, como as notas (overall) foram definidas e como funcionam química, capitão e o motor de simulação.

## 1. Elegibilidade histórica (clube e década)

- A fonte das passagens é a **infobox** do artigo de cada jogador na Wikipédia em português (`Info/Futebolista`, `Info/Futebol`, `Info/Treinador de futebol`). Quando o artigo em português não tem infobox de futebolista (ex.: Pelé e Romário, cujos artigos usam infobox de biografia/político), usa-se a `Infobox football biography` do artigo equivalente na Wikipédia em inglês.
- Os candidatos vêm das categorias `Futebolistas do <clube>` e `Goleiros do <clube>`, além de qualquer artigo coletado cuja infobox registre passagem pelo clube.
- Um jogador só entra em uma década se **os anos da passagem registrada na fonte** tocam aquela década. Ex.: passagem 2008–2012 → elegível para Anos 00 e Anos 10.
- Passagens por empréstimo com menos de 15 jogos não entram na seleção automática.
- Nenhuma passagem é criada manualmente. A curadoria só ajusta nota, posições e texto, e uma entrada da curadoria só é aplicada se o jogador já tiver a passagem verificada (o script de build acusa qualquer nome não encontrado).

## 2. Seleção por década

Para cada clube e década oferecida, o script `scripts/data/build.mjs` escolhe:

1. todos os jogadores da curadoria editorial com passagem naquela década;
2. os mais relevantes por posição (cotas: 3 GOL, 2 LD, 4 ZAG, 2 LE, 3 VOL, 2 MC, 3 MEI, 2 PD, 2 PE, 1 SA, 3 CA), ordenados por relevância = jogos na década + metade dos gols + 3 × jogos pela seleção (até 60);
3. completa até 18 jogadores e cobre posições vazias com quem tenha a posição como secundária.

Posições secundárias naturais: volante → meio-campista; meia → meio-campista; centroavante ↔ segundo atacante.

### Categorias usadas no jogo

A base guarda a função histórica de cada jogador (como registrada na fonte), mas o jogo usa só quatro categorias:

| Funções históricas | Categoria |
| --- | --- |
| Goleiro | GOL |
| Zagueiro, lateral direito, lateral esquerdo | DEF |
| Volante, meio-campista, meia | MEI |
| Ponta direita, ponta esquerda, segundo atacante, centroavante | ATA |

O jogador pertence à categoria da função principal e às das funções secundárias registradas, e pode ocupar qualquer vaga dessas categorias. A função histórica só dá nuances à simulação (um centroavante finaliza mais que um ponta, um zagueiro cabeceia mais que um lateral); quando o jogador atua numa categoria que não é a da sua função principal, vale a média da categoria. As notas, clubes e décadas não mudam com a categoria.

## 3. Notas (overall de 1 a 99)

As notas são **avaliações editoriais do jogo, não notas oficiais**.

### 3.1 Curadoria editorial (855 registros)

Ídolos e jogadores marcantes têm nota definida manualmente em `data-src/curation/<clube>.txt`, considerando:

| Critério | O que pesa |
| --- | --- |
| Qualidade técnica | nível do jogador no auge |
| Importância histórica no clube | idolatria, longevidade, recordes |
| Desempenho na passagem | jogos, gols, protagonismo |
| Reconhecimento e títulos | conquistas pelo clube e pela seleção |
| Auge da carreira | se a passagem coincidiu com o melhor momento |

A curadoria pode definir notas diferentes por década (ex.: Rogério Ceni `92 1990s=84 2010s=88`).

Faixas de referência: **90–99 Lenda** (gênios do futebol mundial no auge pelo clube), **85–89 Ídolo**, **80–84 Craque**, **75–79 Titular**, **até 74 Elenco**.

### 3.2 Fórmula editorial (demais registros)

```
nota = 61
     + jogos pelo clube:   min(13, 12 · log10(1 + jogos) / log10(401))
     + gols pelo clube:    min(7, gols / 18)
     + seleção principal:  min(14, 14 · √(jogos_seleção / 100)) · fator_país · fator_auge
limitada a 60–86
```

- `fator_país`: 1,0 Brasil; 0,9 Argentina; 0,85 Uruguai; 0,7 demais.
- `fator_auge`: reduz o peso da seleção quando a passagem foi no início (até 21 anos: ×0,4; até 23: ×0,65) ou no fim da carreira (a partir de 32 anos: ×0,85; 34: ×0,65; 36: ×0,45).
- Números de seleção acima de 180 são descartados (indicam outras modalidades, como futebol de areia).
- Se a fonte não tem o número de jogos, estima-se 22 por ano de passagem (até 250).

## 4. Química

Ligações entre posições vizinhas na formação. Cada ligação vale de 0 a 3:

- +1 mesmo clube (o clube da carta ou qualquer clube da base em que ambos têm passagem registrada);
- +1 mesma década;
- +1 mesma nacionalidade.

Química individual (0–10) = 10 × soma ponderada das ligações / máximo possível. Bônus no overall: 9–10 → +2; 7–8 → +1; 4–6 → 0; 2–3 → −1; 0–1 → −2.

Química do time (0–100) = média ponderada das químicas individuais. Efeito coletivo: (química − 50) / 20 pontos em cada setor (−2,5 a +2,5).

**Capitão**: +3 de overall; ligações com o capitão contam em dobro; a química individual do capitão pesa em dobro na química do time.

## 5. Força do time

- Goleiro: overall efetivo do goleiro.
- Defesa: 80% média dos defensores + 20% volantes.
- Meio-campo: média de volantes, meio-campistas e meias.
- Ataque: 78% média dos atacantes + 22% meias.
- Ajustes da formação (ex.: 3-4-3 +2 ataque / −1,5 defesa; 4-1-4-1 +1 meio / +1 defesa) e da química.

## 6. Motor de simulação

Simulação minuto a minuto (90 minutos + acréscimos), determinística a partir de uma semente:

1. Posse do minuto pelo duelo de meio-campo (+ fator casa).
2. Faltas e cartões (segundo amarelo e vermelho direto reduzem a força do time).
3. Ataques (~27% dos minutos): quem ataca depende da posse e do duelo ataque × defesa.
4. Ataque → pênalti, impedimento, finalização ou jogada neutralizada.
5. Finalização → no alvo (qualidade do finalizador vs. defesa) → gol (finalizador vs. goleiro) ou defesa; fora, trave.
6. Autor do gol ponderado pela posição e qualidade; assistência na maioria dos gols.
7. Notas individuais (0–10), craque do jogo e estatísticas (posse, finalizações, no alvo, defesas, escanteios, faltas, cartões, xG).

Mata-mata (Copa do Brasil e estaduais): ida e volta; empate no agregado vai para os pênaltis (5 cobranças e alternadas).

### 6.1 Calibragem (Monte Carlo, 120 temporadas por cenário)

`CALIBRATE=1 npx vitest run src/engine/calibrate.test.ts`

| Cenário (draft forte, ~88 de overall) | Título | Temporada perfeita | Gols/jogo na liga | Artilheiro |
| --- | --- | --- | --- | --- |
| Normal | ~92–97% | ~2–3% | ~2,6 | ~37 gols |
| Difícil | ~33–47% | <1% | ~2,5 | ~30 gols |
| Lendário | ~0–5% | ~0% | ~2,5 | ~26 gols |

Os rivais escalam o melhor time de uma década sorteada da própria história (Normal: −6 no overall; Difícil: melhor de duas décadas sorteadas, −3; Lendário: seleção de todos os tempos, −1). Otimizar a química (montar com companheiros da mesma época) aumenta as chances.
