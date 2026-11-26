// Páginas estáticas de conteúdo (HTML de verdade, sem depender de JavaScript),
// geradas no build a partir dos mesmos dados do jogo: história e lendas de
// cada clube década a década, regras, conquistas e a metodologia das notas.
// Servem aos jogadores (para conhecer a história antes de montar o time) e aos
// buscadores e ao Google AdSense, que não enxergam o conteúdo do jogo (montado
// por JavaScript numa página só, com telas em "#").
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { CLUBS } from '../src/data/clubs';
import { FORMATIONS } from '../src/data/formations';
import type { Club, Decade } from '../src/data/types';
import { ACHIEVEMENT_DEFS, TIER_LABEL, TIER_ORDER, TIER_POINTS } from '../src/history/achievements';

export const SITE_URL = 'https://11brl.com.br';
const ADSENSE = 'ca-pub-6625644430029714';
const UPDATED = new Date().toISOString().slice(0, 10);

interface PlayerRec {
  id: string;
  name: string;
  fullName?: string;
  nationality: string;
  position: string;
  secondary: string[];
  years: string;
  eras: Partial<Record<Decade, number>>;
  apps: number | null;
  goals: number | null;
  description: string;
  editorial: boolean;
}

const POS: Record<string, string> = {
  GOL: 'Goleiro',
  LD: 'Lateral-direito',
  ZAG: 'Zagueiro',
  LE: 'Lateral-esquerdo',
  VOL: 'Volante',
  MC: 'Meio-campista',
  MEI: 'Meia',
  PD: 'Ponta-direita',
  PE: 'Ponta-esquerda',
  SA: 'Segundo atacante',
  CA: 'Centroavante',
};
const NAT: Record<string, string> = { BRA: 'Brasil', ARG: 'Argentina', URU: 'Uruguai', PAR: 'Paraguai', CHI: 'Chile', COL: 'Colômbia', PER: 'Peru', EQU: 'Equador' };

const esc = (s: string | number) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const decadeLabel = (d: Decade) => (d === '2020s' || d === '2010s' || d === '2000s' ? `Anos ${d.slice(0, 4)}` : `Anos ${d.slice(2, 4)}`);
const inDecade = (years: number[], d: Decade) => years.filter((y) => Math.floor(y / 10) * 10 === Number(d.slice(0, 4)));
const list = (xs: (string | number)[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`);
const plural = (n: number, s: string, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;
const tierOf = (o: number) => (o >= 90 ? 'Lenda' : o >= 85 ? 'Ídolo' : o >= 80 ? 'Craque' : o >= 75 ? 'Titular' : 'Elenco');
/** Só a parte editorial da descrição (sem a frase automática "X que defendeu o clube em..."). */
const note = (p: PlayerRec, club: Club) => {
  const auto = p.description.lastIndexOf(` que defendeu o ${club.name} em`);
  if (!p.editorial) return '';
  const cut = auto > 0 ? p.description.slice(0, p.description.lastIndexOf('.', auto) + 1) : p.description;
  return cut.trim();
};

function loadPlayers(root: string, club: string): PlayerRec[] {
  const f = path.join(root, 'src/data/players', `${club}.json`);
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')).players as PlayerRec[]) : [];
}

const CSS = `:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#040a1c linear-gradient(180deg,#0a1b42,#040a1c) fixed;color:#dfe6f3;font:16px/1.6 Barlow,system-ui,-apple-system,'Segoe UI',Arial,sans-serif}
a{color:#ffcf1f}header.top{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:980px;margin:0 auto;padding:14px 16px;border-bottom:1px solid rgba(173,196,255,.14)}
header.top .brand{color:#fff;text-decoration:none;font-weight:800;letter-spacing:.02em}header.top .brand span{color:#ffcf1f}
.play{display:inline-block;background:#ffcf1f;color:#1a1300;font-weight:800;text-decoration:none;padding:8px 16px;border-radius:999px;white-space:nowrap}
main{max-width:980px;margin:0 auto;padding:24px 16px 64px}h1{font-size:32px;line-height:1.15;margin:8px 0 6px;color:#fff}h2{font-size:22px;margin:34px 0 8px;color:#ffcf1f}h3{font-size:18px;margin:22px 0 6px;color:#fff}
p,li{color:#c9d3e6}.dim{color:#8796b5;font-size:14px}.lead{font-size:18px;color:#dfe6f3}nav.crumbs{font-size:14px;color:#8796b5}nav.crumbs a{color:#8bb1ff}
.bar{height:6px;border-radius:999px;margin:10px 0 18px}.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:14px 0}
.fact{background:rgba(13,33,82,.7);border:1px solid rgba(173,196,255,.14);border-radius:12px;padding:10px 12px}.fact b{display:block;color:#fff;font-size:15px}.fact span{color:#8796b5;font-size:13px}
table{width:100%;border-collapse:collapse;margin:8px 0 6px;font-size:15px}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid rgba(173,196,255,.12);vertical-align:top}th{color:#8796b5;font-weight:600;font-size:13px}
td.n{text-align:right;color:#fff;font-weight:700;white-space:nowrap}.wrap{overflow-x:auto}.tag{display:inline-block;font-size:12px;border:1px solid currentColor;border-radius:999px;padding:0 8px;margin-left:6px;color:#ffcf1f}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;padding:0;list-style:none}.grid li a{display:block;padding:12px 14px;border-radius:12px;background:rgba(13,33,82,.7);border:1px solid rgba(173,196,255,.14);text-decoration:none;color:#fff}
.grid li a small{display:block;color:#8796b5}.cta{margin:30px 0;padding:18px;border-radius:14px;background:rgba(255,207,31,.08);border:1px solid rgba(255,207,31,.35)}
footer.bottom{max-width:980px;margin:0 auto;padding:18px 16px 40px;border-top:1px solid rgba(173,196,255,.14);font-size:14px;color:#8796b5}footer.bottom a{color:#8bb1ff;margin-right:14px}
@media(max-width:600px){h1{font-size:26px}td.hide{display:none}}`;

function layout(o: { title: string; description: string; canonical: string; body: string; jsonLd?: object }): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="theme-color" content="#030a1f" />
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}" />
<link rel="canonical" href="${SITE_URL}${o.canonical}" />
<meta property="og:type" content="article" />
<meta property="og:locale" content="pt_BR" />
<meta property="og:site_name" content="Onze BR Lendário" />
<meta property="og:title" content="${esc(o.title)}" />
<meta property="og:description" content="${esc(o.description)}" />
<meta property="og:url" content="${SITE_URL}${o.canonical}" />
<meta name="google-adsense-account" content="${ADSENSE}" />
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE}" crossorigin="anonymous"></script>
<link rel="stylesheet" href="/site.css" />
${o.jsonLd ? `<script type="application/ld+json">${JSON.stringify(o.jsonLd)}</script>` : ''}
</head>
<body>
<header class="top"><a class="brand" href="/">Onze BR <span>Lendário</span></a><a class="play" href="/">Jogar agora</a></header>
<main>
${o.body}
</main>
<footer class="bottom">
<a href="/">Jogar</a><a href="/como-jogar/">Como jogar</a><a href="/clubes/">Lendas por clube</a><a href="/conquistas/">Conquistas</a><a href="/sobre/">Sobre e metodologia</a><a href="/privacidade.html">Privacidade</a>
<p>Onze BR Lendário é um projeto de fã, sem vínculo com clubes, federações ou atletas. Dados históricos de fontes públicas (Wikipédia). Atualizado em ${UPDATED.split('-').reverse().join('/')}.</p>
</footer>
</body>
</html>
`;
}

function clubPage(club: Club, players: PlayerRec[], others: Club[]): string {
  const t = club.titles;
  const totalBr = t.brasileirao.length;
  const decades = club.decades.filter((d) => players.some((p) => p.eras[d] != null));
  const idols = players
    .filter((p) => p.editorial && note(p, club))
    .map((p) => ({ p, best: Math.max(...Object.values(p.eras).map(Number)) }))
    .sort((a, b) => b.best - a.best)
    .slice(0, 12);

  const titleLine = (label: string, years: number[]) =>
    `<li><b>${label}</b>: ${years.length ? `${plural(years.length, 'título', 'títulos')} (${list(years)})` : 'nenhum título até 2025'}</li>`;

  const decadeSections = decades
    .map((d) => {
      const ps = players
        .filter((p) => p.eras[d] != null)
        .sort((a, b) => b.eras[d]! - a.eras[d]! || a.name.localeCompare(b.name));
      const top = ps.slice(0, 11);
      const br = inDecade(t.brasileirao, d);
      const cb = inDecade(t.copaDoBrasil, d);
      const li = inDecade(t.libertadores, d);
      const conquests = [
        br.length ? `${plural(br.length, 'Brasileiro', 'Brasileiros')} (${list(br)})` : '',
        cb.length ? `${cb.length === 1 ? 'a Copa do Brasil' : `${cb.length} Copas do Brasil`} (${list(cb)})` : '',
        li.length ? `${li.length === 1 ? 'a Libertadores' : `${li.length} Libertadores`} (${list(li)})` : '',
      ].filter(Boolean);
      const lider = top[0];
      const intro =
        `Nos ${decadeLabel(d).toLowerCase()}, o ${esc(club.name)} tem ${plural(ps.length, 'jogador marcante', 'jogadores marcantes')} na base do jogo. ` +
        (conquests.length ? `Foi a década em que o clube conquistou ${list(conquests)}. ` : 'O clube não levantou taças nacionais ou continentais nessa década, mas formou nomes queridos pela torcida. ') +
        (lider ? `A carta mais forte da época é ${esc(lider.name)}, ${POS[lider.position]?.toLowerCase() ?? 'jogador'} com overall ${lider.eras[d]}.` : '');
      const rows = top
        .map((p) => {
          const n = note(p, club);
          return `<tr><td><b>${esc(p.name)}</b>${p.eras[d]! >= 85 ? `<span class="tag">${tierOf(p.eras[d]!)}</span>` : ''}${n ? `<br><span class="dim">${esc(n)}</span>` : ''}</td><td>${esc(POS[p.position] ?? p.position)}</td><td class="hide">${esc(p.years)}</td><td class="hide">${esc(NAT[p.nationality] ?? p.nationality)}</td><td class="n">${p.eras[d]}</td></tr>`;
        })
        .join('');
      return `<section id="${d}">
<h3>${decadeLabel(d)}: o Onze Lendário do ${esc(club.name)}</h3>
<p>${intro}</p>
<div class="wrap"><table><thead><tr><th>Jogador</th><th>Posição</th><th class="hide">Passagem</th><th class="hide">País</th><th>OVR</th></tr></thead><tbody>${rows}</tbody></table></div>
</section>`;
    })
    .join('\n');

  const idolList = idols
    .map(({ p, best }) => `<li><b>${esc(p.name)}</b> (${esc(POS[p.position] ?? p.position)}, ${esc(p.years)}, overall ${best}): ${esc(note(p, club))}</li>`)
    .join('');

  const body = `<nav class="crumbs"><a href="/">Início</a> › <a href="/clubes/">Lendas por clube</a> › ${esc(club.name)}</nav>
<h1>Lendas do ${esc(club.name)}: os maiores ídolos de cada década</h1>
<div class="bar" style="background:linear-gradient(90deg,${club.colors.primary},${club.colors.secondary},${club.colors.accent})"></div>
<p class="lead">${esc(club.history)}</p>
<div class="facts">
<div class="fact"><b>${esc(club.fullName)}</b><span>Nome oficial</span></div>
<div class="fact"><b>${club.founded}</b><span>Fundação</span></div>
<div class="fact"><b>${esc(club.city)} (${club.state})</b><span>Cidade</span></div>
<div class="fact"><b>${esc(club.stadium)}</b><span>Estádio</span></div>
<div class="fact"><b>${esc(club.nickname)}</b><span>Apelido</span></div>
<div class="fact"><b>${plural(players.length, 'jogador', 'jogadores')}</b><span>Na base do Onze BR Lendário</span></div>
</div>
<h2>Títulos nacionais e continentais</h2>
<ul>
${titleLine('Campeonato Brasileiro', t.brasileirao)}
${titleLine('Copa do Brasil', t.copaDoBrasil)}
${titleLine('Copa Libertadores', t.libertadores)}
<li><b>Estadual</b>: disputa o ${esc(club.stateCup)} no modo Tríplice Coroa do jogo.</li>
</ul>
<p>${totalBr ? `Com ${plural(totalBr, 'título brasileiro', 'títulos brasileiros')}, o ${esc(club.name)} ` : `Mesmo sem título brasileiro, o ${esc(club.name)} `}aparece no jogo com elencos de ${plural(decades.length, 'década', 'décadas')}: ${list(decades.map(decadeLabel))}.</p>
${idolList ? `<h2>Ídolos da torcida</h2><p>Os jogadores com a história mais marcante no clube, avaliados pela importância para a torcida, títulos e números.</p><ul>${idolList}</ul>` : ''}
<h2>Década a década</h2>
<p>As notas (overall) são avaliações editoriais do jogo, baseadas no que cada jogador fez pelo clube naquela década: jogos, gols, tempo de casa, títulos e a importância para a torcida. Veja a <a href="/sobre/">metodologia</a>.</p>
${decadeSections}
<div class="cta"><b>Monte o seu Onze Lendário do ${esc(club.name)}.</b> Escolha o clube, sorteie as décadas, faça o draft dos 11 titulares e tente o Brasileirão perfeito de 38 vitórias. <a href="/#clube-${club.id}">Jogar com o ${esc(club.name)} →</a></div>
<h2>Outros clubes</h2>
<ul class="grid">${others.map((c) => `<li><a href="/clubes/${c.id}/">${esc(c.name)}<small>${esc(c.city)} · ${c.titles.brasileirao.length} Brasileiros</small></a></li>`).join('')}</ul>`;
  return layout({
    title: `Lendas do ${club.name}: maiores ídolos por década | Onze BR Lendário`,
    description: `Os maiores jogadores da história do ${club.name}, década a década: ídolos, títulos (${totalBr} Brasileiros, ${t.copaDoBrasil.length} Copas do Brasil, ${t.libertadores.length} Libertadores) e o Onze Lendário de cada época.`,
    canonical: `/clubes/${club.id}/`,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SportsTeam',
      name: club.fullName,
      alternateName: club.name,
      sport: 'Futebol',
      foundingDate: String(club.founded),
      location: `${club.city}, ${club.state}, Brasil`,
    },
  });
}

function clubsIndex(clubs: Club[], counts: Record<string, number>): string {
  const byState = new Map<string, Club[]>();
  for (const c of clubs) byState.set(c.state, [...(byState.get(c.state) ?? []), c]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const body = `<nav class="crumbs"><a href="/">Início</a> › Lendas por clube</nav>
<h1>Lendas do futebol brasileiro, clube por clube</h1>
<p class="lead">A história de ${clubs.length} clubes brasileiros contada pelos jogadores que marcaram cada década, dos anos 50 aos dias de hoje. São ${total.toLocaleString('pt-BR')} jogadores na base do Onze BR Lendário, com títulos, ídolos e o time ideal de cada época.</p>
${[...byState.entries()]
  .map(
    ([uf, cs]) =>
      `<h2>${uf}</h2><ul class="grid">${cs
        .map((c) => `<li><a href="/clubes/${c.id}/">${esc(c.name)}<small>${c.titles.brasileirao.length} Brasileiros · ${c.titles.copaDoBrasil.length} Copas do Brasil · ${c.titles.libertadores.length} Libertadores · ${counts[c.id] ?? 0} jogadores</small></a></li>`)
        .join('')}</ul>`,
  )
  .join('\n')}
<div class="cta"><b>Já sabe quem escalaria?</b> No Onze BR Lendário você faz o draft das lendas do seu clube e disputa o Brasileirão. <a href="/">Jogar agora →</a></div>`;
  return layout({
    title: 'Lendas do futebol brasileiro por clube | Onze BR Lendário',
    description: `Ídolos, títulos e o time ideal de cada década de ${clubs.length} clubes brasileiros: Corinthians, Flamengo, Palmeiras, São Paulo, Santos, Vasco, Grêmio, Inter e mais.`,
    canonical: '/clubes/',
    body,
  });
}

function howToPage(): string {
  const formations = FORMATIONS.map((f) => `<li><b>${esc(f.name)}</b>: ${esc(f.description)}</li>`).join('');
  const body = `<nav class="crumbs"><a href="/">Início</a> › Como jogar</nav>
<h1>Como jogar o Onze BR Lendário</h1>
<p class="lead">O Onze BR Lendário é um jogo de navegador gratuito de draft e simulação: você monta o time dos sonhos com as lendas de um clube brasileiro, década a década, e disputa o Campeonato Brasileiro de 38 rodadas em busca da campanha perfeita.</p>
<h2>1. Escolha o clube e a formação</h2>
<p>São ${CLUBS.length} clubes, cada um com as décadas em que fez história. Escolha <b>todas as décadas</b> (modo Clássico) ou uma década específica (Era Única). Depois, escolha uma das ${FORMATIONS.length} formações:</p>
<ul>${formations}</ul>
<h2>2. Faça o draft dos 11 titulares</h2>
<ul>
<li>A cada rodada o jogo sorteia uma década do clube (na Mistura Brasileira, um clube e uma década).</li>
<li>As vagas são divididas em quatro categorias: goleiros, defensores, meio-campistas e atacantes. Cada jogador só atua na categoria em que jogou de verdade.</li>
<li>Você tem 5 novos sorteios por draft. Na Era Única, todos os jogadores da década aparecem em todas as rodadas.</li>
<li>Um mesmo jogador nunca aparece duas vezes no seu time, mesmo que tenha passado por várias décadas.</li>
</ul>
<h2>3. Química e capitão</h2>
<p>Jogadores vizinhos no campo formam ligações: mesmo clube, mesma década e mesma nacionalidade somam pontos de química. Química alta aumenta o overall do time; química baixa atrapalha. O capitão ganha +3 de overall e as ligações com ele contam em dobro.</p>
<h2>4. Dispute o Brasileirão</h2>
<p>Seu time enfrenta 19 rivais, cada um escalado com lendas da própria história, em turno e returno. As partidas são simuladas lance a lance: dá para assistir em velocidade 1x, 2x ou 4x, ou pular para o resultado. No modo Tríplice Coroa, você também disputa o estadual e a Copa do Brasil, com jogos de ida e volta e disputa de pênaltis.</p>
<h2>Modos de jogo</h2>
<ul>
<li><b>Clássico</b>: um clube, décadas sorteadas a cada rodada.</li>
<li><b>Era Única</b>: um clube e uma década fixa.</li>
<li><b>Mistura Brasileira</b>: clube e década sorteados a cada rodada.</li>
<li><b>Desafio Diário</b> e <b>Desafio Semanal</b>: o mesmo desafio para todos os jogadores, com ranking próprio.</li>
<li><b>Tríplice Coroa</b>: estadual, Copa do Brasil e Brasileirão na mesma temporada.</li>
</ul>
<h2>Dificuldades e ranking</h2>
<p>Há três níveis: Normal, Difícil e Lendário, cada um com rivais mais fortes. O ranking de campanhas é separado por dificuldade, com o líder de cada uma em destaque, e há também um ranking de conquistas. Para aparecer no ranking de todos os jogadores, entre com a sua conta Google.</p>
<div class="cta"><b>Pronto para montar o seu time?</b> <a href="/">Jogar agora →</a> · <a href="/conquistas/">Ver as ${ACHIEVEMENT_DEFS.length} conquistas</a></div>`;
  return layout({
    title: 'Como jogar | Onze BR Lendário',
    description: 'Regras do Onze BR Lendário: draft das lendas do seu clube, formações, química, capitão, modos de jogo, dificuldades e o Brasileirão de 38 rodadas.',
    canonical: '/como-jogar/',
    body,
  });
}

function achievementsPage(): string {
  const sections = TIER_ORDER.map((tier) => {
    const defs = ACHIEVEMENT_DEFS.filter((a) => a.tier === tier);
    return `<h2>${TIER_LABEL[tier]} <span class="dim">(${TIER_POINTS[tier]} ${TIER_POINTS[tier] === 1 ? 'ponto' : 'pontos'} cada)</span></h2><ul>${defs
      .map((a) => `<li><b>${esc(a.name)}</b>: ${esc(a.objective)}${a.reward ? ` <span class="dim">Recompensa: ${esc(a.reward)}.</span>` : ''}</li>`)
      .join('')}</ul>`;
  }).join('\n');
  const body = `<nav class="crumbs"><a href="/">Início</a> › Conquistas</nav>
<h1>As ${ACHIEVEMENT_DEFS.length} conquistas do Onze BR Lendário</h1>
<p class="lead">As conquistas são verificadas automaticamente ao completar o elenco, a cada partida, a cada título e no fim da temporada. Cada uma tem uma raridade e vale pontos no ranking de conquistas: bronze 1, prata 2, ouro 3 e lendária 5.</p>
${sections}
<div class="cta"><b>Quantas você consegue?</b> <a href="/">Jogar agora →</a></div>`;
  return layout({
    title: 'Conquistas | Onze BR Lendário',
    description: `Lista das ${ACHIEVEMENT_DEFS.length} conquistas do Onze BR Lendário, de Temporada Perfeita a Seleção do Mundo, com raridade e pontos do ranking.`,
    canonical: '/conquistas/',
    body,
  });
}

function aboutPage(totalPlayers: number): string {
  const body = `<nav class="crumbs"><a href="/">Início</a> › Sobre</nav>
<h1>Sobre o Onze BR Lendário</h1>
<p class="lead">Já imaginou aquele craque da década de 50 jogando ao lado de um craque da nova geração do seu clube? O Onze BR Lendário nasceu dessa ideia: um jogo para os amantes do futebol brasileiro, em que cada time é montado com as lendas da história do clube.</p>
<h2>A base de jogadores</h2>
<p>São ${totalPlayers.toLocaleString('pt-BR')} jogadores de ${CLUBS.length} clubes, dos anos 50 aos elencos de 2026. Os dados de passagens, jogos e gols vêm de fontes públicas (Wikipédia, em português e inglês). Cada clube tem os jogadores mais conhecidos e importantes de cada década, mais os titulares do elenco atual.</p>
<h2>Como as notas (overall) são definidas</h2>
<p>As notas são <b>avaliações editoriais do jogo, não notas oficiais</b>. Elas medem o que o jogador fez <b>pelo clube</b>, não a carreira inteira:</p>
<ul>
<li><b>Ídolos e jogadores marcantes</b> têm nota definida manualmente, considerando a importância para a torcida, os títulos, os números e o protagonismo na passagem.</li>
<li><b>Os demais</b> recebem nota por uma fórmula: jogos pelo clube, gols (ou regularidade, para goleiros e defensores), tempo de casa, títulos conquistados no clube (Libertadores, Brasileirão e Copa do Brasil) e, com peso menor, jogos pela seleção.</li>
<li>A nota pode mudar de uma década para outra: um jogador pode ser titular numa época e ídolo em outra.</li>
</ul>
<p>Faixas: <b>90–99 Lenda</b>, <b>85–89 Ídolo</b>, <b>80–84 Craque</b>, <b>75–79 Titular</b>, até 74 Elenco.</p>
<h2>Visual</h2>
<p>Os avatares dos jogadores são ilustrações originais do jogo, feitas a partir de pesquisa de aparência (tom de pele, cabelo, barba e cor dos olhos de cada época), com o uniforme de cada clube. Os emblemas também são desenhos originais, não reproduções dos escudos oficiais.</p>
<h2>Contas, ranking e privacidade</h2>
<p>Dá para jogar como visitante (tudo fica salvo no navegador) ou entrar com Google para salvar progresso, histórico e conquistas na nuvem e aparecer no ranking de todos os jogadores. Veja a <a href="/privacidade.html">política de privacidade</a>.</p>
<p class="dim">Projeto de fã, sem vínculo com clubes, federações ou atletas.</p>
<div class="cta"><a href="/clubes/">Conheça as lendas de cada clube →</a></div>`;
  return layout({
    title: 'Sobre e metodologia | Onze BR Lendário',
    description: 'Como o Onze BR Lendário escolhe os jogadores e define as notas: importância no clube, títulos, jogos e gols, década a década.',
    canonical: '/sobre/',
    body,
  });
}

/** Plugin do Vite: escreve as páginas em dist/ no build normal (não no arquivo único). */
export function staticPages(): Plugin {
  let root = process.cwd();
  return {
    name: 'onze-static-pages',
    apply: 'build',
    configResolved(c) {
      root = c.root;
    },
    generateBundle() {
      const clubs = CLUBS.filter((c) => !c.guest).concat(CLUBS.filter((c) => c.guest));
      const players = Object.fromEntries(clubs.map((c) => [c.id, loadPlayers(root, c.id)]));
      const counts = Object.fromEntries(clubs.map((c) => [c.id, players[c.id].length]));
      const distinct = new Set(Object.values(players).flatMap((ps) => ps.map((p) => p.id))).size;
      const emit = (fileName: string, source: string) => this.emitFile({ type: 'asset', fileName, source });
      emit('site.css', CSS);
      emit('clubes/index.html', clubsIndex(clubs, counts));
      for (const c of clubs) emit(`clubes/${c.id}/index.html`, clubPage(c, players[c.id], clubs.filter((o) => o.id !== c.id)));
      emit('como-jogar/index.html', howToPage());
      emit('conquistas/index.html', achievementsPage());
      emit('sobre/index.html', aboutPage(distinct));
      const urls = ['/', '/como-jogar/', '/clubes/', ...clubs.map((c) => `/clubes/${c.id}/`), '/conquistas/', '/sobre/', '/privacidade.html'];
      emit(
        'sitemap.xml',
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE_URL}${u}</loc><lastmod>${UPDATED}</lastmod></url>`).join('\n')}\n</urlset>\n`,
      );
      emit('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
    },
  };
}
