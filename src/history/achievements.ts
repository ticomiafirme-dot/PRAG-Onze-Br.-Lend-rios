// Catálogo de conquistas. Cada conquista tem um id único, raridade, os momentos
// em que é verificada (gatilhos) e a própria condição de desbloqueio. Para criar
// uma conquista nova basta acrescentar uma entrada em ACHIEVEMENT_DEFS: o motor,
// as telas, a sincronização e o Hall dos Lendários passam a considerá-la.
// Tudo é calculado com dados reais das temporadas do jogador.
import type { IconName } from '../components/icons';
import { CLUBS } from '../data/clubs';
import { isDerby } from '../data/rivals';
import { DECADES } from '../data/types';
import { USER_ID } from '../engine/campaign';
import { COMPETITIONS } from './competitions';
import type { AchievementTier, MatchLine, SeasonDetails, SeasonEntry, TitleRecord, UnlockRecord } from './types';

export type { AchievementTier } from './types';

/** Momentos do jogo em que as conquistas são verificadas. */
export type Trigger = 'elenco' | 'partida' | 'titulo' | 'temporada' | 'recorde' | 'ranking';

export interface AchievementContext {
  trigger: Trigger;
  /** Elenco recém-completado (overall médio arredondado, química se já houver capitão). */
  squad?: { runId: string; overall: number; chemistry: number | null };
  /** Partida recém-terminada, do ponto de vista do jogador. */
  match?: { runId: string; for: number; against: number; rival: string };
  /** Temporada recém-finalizada. */
  season?: SeasonEntry;
  /** Temporadas finalizadas antes desta (para comparar recordes). */
  previous: SeasonEntry[];
  /** Todos os títulos do jogador (incluindo os recém-conquistados). */
  titles: TitleRecord[];
  /** Detalhes da temporada (escalação, jogos com os gols e minutos, artilharia), quando disponíveis. */
  details?: SeasonDetails | null;
  /** Melhor posição do jogador no ranking global (só com conta). */
  ranking?: { position: number; runId: string | null };
}

export interface AchievementResult {
  value: number | null;
  detail: string | null;
  runId: string | null;
}

/** Dados para mostrar o que falta numa conquista bloqueada. */
export interface ProgressInput {
  finished: SeasonEntry[];
  titles: TitleRecord[];
}

export interface Progress {
  current: number;
  target: number;
  text: string;
}

export interface AchievementDef {
  id: string;
  name: string;
  /** O que é preciso fazer. */
  objective: string;
  /** Mensagem da comemoração (pode usar o valor que desbloqueou). */
  message: (u: { value: number | null; detail: string | null }) => string;
  icon: IconName;
  tier: AchievementTier;
  /** Recompensa exibida (ex.: medalha de ouro exclusiva). */
  reward?: string;
  triggers: Trigger[];
  check: (ctx: AchievementContext) => AchievementResult | null;
  progress?: (p: ProgressInput) => Progress | null;
}

export const TIER_LABEL: Record<AchievementTier, string> = { bronze: 'Bronze', prata: 'Prata', ouro: 'Ouro', lendaria: 'Lendária' };
export const TIER_ORDER: AchievementTier[] = ['lendaria', 'ouro', 'prata', 'bronze'];
/** Pontos de cada raridade no ranking de conquistas. */
export const TIER_POINTS: Record<AchievementTier, number> = { bronze: 1, prata: 2, ouro: 3, lendaria: 5 };
/** Pontuação de conquistas (bronze 1, prata 2, ouro 3, lendária 5). */
export function achievementScore(unlocks: { tier: AchievementTier }[]): number {
  return unlocks.reduce((a, u) => a + (TIER_POINTS[u.tier] ?? 0), 0);
}

const done = (runId: string | null, value: number | null = null, detail: string | null = null): AchievementResult => ({ runId, value, detail });
const maxOf = (xs: number[]) => (xs.length ? Math.max(...xs) : null);
const minOf = (xs: number[]) => (xs.length ? Math.min(...xs) : null);
const plural = (n: number, s: string, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // --- conquistas iniciais -------------------------------------------------
  {
    id: 'temporada-perfeita',
    name: 'Temporada Perfeita',
    objective: 'Conquiste 38 vitórias no Brasileirão, sem empates nem derrotas.',
    message: () => 'Você venceu as 38 partidas do Brasileirão e alcançou uma campanha histórica!',
    icon: 'star',
    tier: 'ouro',
    reward: 'Medalha de ouro exclusiva',
    triggers: ['temporada'],
    check: ({ season }) => (season?.perfect ? done(season.runId, season.wins, `${season.teamName} · 38 vitórias`) : null),
    progress: ({ finished }) => {
      const best = maxOf(finished.map((s) => s.wins)) ?? 0;
      return { current: best, target: 38, text: finished.length ? `Sua melhor campanha: ${plural(best, 'vitória')} de 38.` : 'Termine um Brasileirão vencendo todas as partidas.' };
    },
  },
  {
    id: 'muralha',
    name: 'Muralha',
    objective: 'Termine uma temporada sofrendo menos gols do que em todas as suas campanhas anteriores.',
    message: ({ value }) => `Só ${plural(value ?? 0, 'gol sofrido', 'gols sofridos')} no Brasileirão: a melhor defesa da sua carreira!`,
    icon: 'wall',
    tier: 'prata',
    triggers: ['temporada', 'recorde'],
    check: ({ season, previous }) => {
      const record = minOf(previous.map((s) => s.goalsAgainst));
      if (!season || record == null || season.goalsAgainst >= record) return null;
      return done(season.runId, season.goalsAgainst, `${plural(season.goalsAgainst, 'gol sofrido', 'gols sofridos')} · recorde anterior: ${record}`);
    },
    progress: ({ finished }) => {
      const record = minOf(finished.map((s) => s.goalsAgainst));
      if (record == null) return { current: 0, target: 1, text: 'Termine sua primeira temporada para ter um recorde de defesa a superar.' };
      return { current: 0, target: 1, text: `Seu recorde: ${plural(record, 'gol sofrido', 'gols sofridos')}. Sofra menos que isso numa temporada.` };
    },
  },
  {
    id: 'artilheiro',
    name: 'Artilheiro',
    objective: 'Estabeleça um novo recorde pessoal de gols marcados em uma temporada.',
    message: ({ value }) => `${plural(value ?? 0, 'gol')} no Brasileirão: o ataque mais goleador da sua carreira!`,
    icon: 'ball',
    tier: 'bronze',
    triggers: ['temporada', 'recorde'],
    check: ({ season, previous }) => {
      const record = maxOf(previous.map((s) => s.goalsFor));
      if (!season || record == null || season.goalsFor <= record) return null;
      return done(season.runId, season.goalsFor, `${plural(season.goalsFor, 'gol')} · recorde anterior: ${record}`);
    },
    progress: ({ finished }) => {
      const record = maxOf(finished.map((s) => s.goalsFor));
      if (record == null) return { current: 0, target: 1, text: 'Termine sua primeira temporada para ter um recorde de gols a superar.' };
      return { current: 0, target: 1, text: `Seu recorde: ${plural(record, 'gol')}. Marque ${record + 1} ou mais numa temporada.` };
    },
  },
  {
    id: 'lendas-reunidas',
    name: 'Lendas Reunidas',
    objective: 'Monte um elenco titular com overall médio igual ou superior a 90.',
    message: ({ value }) => `Seu time titular chegou a overall médio ${value}. Só lendas em campo!`,
    icon: 'team',
    tier: 'prata',
    triggers: ['elenco', 'temporada'],
    check: ({ squad, season }) => {
      if (squad && squad.overall >= 90) return done(squad.runId, squad.overall, `Overall médio ${squad.overall}`);
      if (season && Math.round(season.squadOverall) >= 90) return done(season.runId, Math.round(season.squadOverall), `Overall médio ${Math.round(season.squadOverall)}`);
      return null;
    },
    progress: ({ finished }) => {
      const best = maxOf(finished.map((s) => Math.round(s.squadOverall)));
      return { current: best ?? 0, target: 90, text: best == null ? 'Complete um elenco com overall médio 90 ou mais.' : `Seu melhor elenco: overall ${best}.${best < 90 ? ` Faltam ${90 - best}.` : ''}` };
    },
  },
  {
    id: 'invencivel',
    name: 'Invencível',
    objective: 'Termine uma temporada sem nenhuma derrota. Vitórias e empates valem.',
    message: () => 'Nenhuma derrota na temporada inteira. Ninguém conseguiu parar o seu time!',
    icon: 'shield',
    tier: 'prata',
    triggers: ['temporada'],
    check: ({ season }) => {
      if (!season || season.status !== 'finished') return null;
      const losses = season.metrics?.lossesAll ?? season.losses;
      return losses === 0 ? done(season.runId, season.wins, `${season.wins}V ${season.draws}E 0D`) : null;
    },
    progress: ({ finished }) => {
      const fewest = minOf(finished.map((s) => s.metrics?.lossesAll ?? s.losses));
      return { current: 0, target: 1, text: fewest == null ? 'Termine uma temporada sem perder nenhuma partida.' : `Sua temporada com menos derrotas teve ${plural(fewest, 'derrota')}.` };
    },
  },
  {
    id: 'rei-do-brasil',
    name: 'Rei do Brasil',
    objective: `Conquiste todos os ${COMPETITIONS.length} campeonatos do jogo pelo menos uma vez: Brasileirão, Copa do Brasil e os estaduais.`,
    message: () => 'Você venceu todos os campeonatos do catálogo. O futebol brasileiro tem um rei!',
    icon: 'crown',
    tier: 'lendaria',
    triggers: ['titulo', 'temporada'],
    check: ({ titles, season }) => {
      const won = new Set(titles.map((t) => t.competitionId));
      if (!COMPETITIONS.every((c) => won.has(c.id))) return null;
      const last = [...titles].sort((a, b) => b.wonAt.localeCompare(a.wonAt))[0];
      return done(season?.runId ?? last?.runId ?? null, COMPETITIONS.length, `${COMPETITIONS.length} campeonatos conquistados`);
    },
    progress: ({ titles }) => {
      const won = new Set(titles.map((t) => t.competitionId));
      const missing = COMPETITIONS.filter((c) => !won.has(c.id));
      const n = COMPETITIONS.length - missing.length;
      return {
        current: n,
        target: COMPETITIONS.length,
        text: missing.length ? `${n} de ${COMPETITIONS.length} campeonatos. Faltam: ${missing.map((c) => c.short).join(', ')}.` : 'Todos os campeonatos conquistados.',
      };
    },
  },
  // --- conquistas extras ---------------------------------------------------
  {
    id: 'estreia',
    name: 'Estreia',
    objective: 'Termine sua primeira temporada.',
    message: () => 'Primeira temporada concluída. A sua história no PRAG começou!',
    icon: 'check',
    tier: 'bronze',
    triggers: ['temporada'],
    check: ({ season }) => (season?.status === 'finished' ? done(season.runId) : null),
  },
  {
    id: 'campeao-brasileiro',
    name: 'Campeão Brasileiro',
    objective: 'Termine o Brasileirão em 1º lugar.',
    message: ({ detail }) => `${detail ?? 'Seu time'} é campeão brasileiro!`,
    icon: 'trophy',
    tier: 'bronze',
    triggers: ['titulo', 'temporada'],
    check: ({ titles }) => {
      const t = titles.find((x) => x.competitionId === 'brasileirao');
      return t ? done(t.runId, null, t.teamName) : null;
    },
  },
  {
    id: 'massacre',
    name: 'Massacre',
    objective: 'Vença uma partida por 6 gols de diferença ou mais.',
    message: ({ detail }) => `${detail ?? 'Goleada histórica'}. Que atropelo!`,
    icon: 'flame',
    tier: 'bronze',
    triggers: ['partida'],
    check: ({ match }) => (match && match.for - match.against >= 6 ? done(match.runId, match.for - match.against, `${match.for} × ${match.against} no ${match.rival}`) : null),
    progress: ({ finished }) => {
      const best = maxOf(finished.map((s) => s.metrics?.biggestWin?.diff ?? 0)) ?? 0;
      return { current: Math.min(best, 6), target: 6, text: best ? `Sua maior vitória foi por ${plural(best, 'gol')} de diferença.` : 'Vença uma partida por 6 gols de diferença.' };
    },
  },
  {
    id: 'quimica-total',
    name: 'Química Total',
    objective: 'Comece uma temporada com química 100.',
    message: () => 'Química 100: seu time joga de olhos fechados!',
    icon: 'flask',
    tier: 'prata',
    triggers: ['elenco'],
    check: ({ squad }) => (squad?.chemistry != null && squad.chemistry >= 100 ? done(squad.runId, squad.chemistry, 'Química 100') : null),
    progress: ({ finished }) => {
      const best = maxOf(finished.map((s) => s.chemistry)) ?? 0;
      return { current: best, target: 100, text: `Sua maior química: ${best}.` };
    },
  },
  {
    id: 'triplice-coroa',
    name: 'Tríplice Coroa',
    objective: 'Vença Estadual, Copa do Brasil e Brasileirão na mesma temporada.',
    message: () => 'Estadual, Copa do Brasil e Brasileirão: a temporada mais vitoriosa possível!',
    icon: 'medal',
    tier: 'ouro',
    triggers: ['temporada'],
    check: ({ season }) => (season?.triple ? done(season.runId, 3, `${season.teamName} · 3 títulos`) : null),
  },
  {
    id: 'lenda-do-lendario',
    name: 'Lenda do Lendário',
    objective: 'Seja campeão brasileiro no nível Lendário.',
    message: () => 'Campeão contra os rivais mais fortes do jogo. Lenda absoluta!',
    icon: 'bolt',
    tier: 'lendaria',
    triggers: ['temporada'],
    check: ({ season }) => (season?.champion && season.difficulty === 'lendario' ? done(season.runId, season.points, `${season.teamName} · ${season.points} pontos`) : null),
  },
];


// --- auxiliares das conquistas de partida e de carreira ----------------------

const runOf = (ctx: AchievementContext): string | null => ctx.season?.runId ?? ctx.match?.runId ?? ctx.squad?.runId ?? null;
const userSide = (m: MatchLine): 'home' | 'away' => (m.home === USER_ID ? 'home' : 'away');
/** Placar do ponto de vista do jogador: [a favor, contra]. */
const forAgainst = (m: MatchLine): [number, number] => (m.home === USER_ID ? [m.score[0], m.score[1]] : [m.score[1], m.score[0]]);
const rivalOf = (m: MatchLine) => (m.home === USER_ID ? m.awayName : m.homeName);
const isUserMatch = (m: MatchLine) => m.home === USER_ID || m.away === USER_ID;
const userMatches = (ctx: AchievementContext): MatchLine[] => (ctx.details?.matches ?? []).filter(isUserMatch);
/** Pênaltis vencidos pelo jogador na disputa (null se não houve disputa). */
const shootoutWon = (m: MatchLine): boolean | null => {
  if (!m.shootout) return null;
  const [h, a] = m.shootout;
  return userSide(m) === 'home' ? h > a : a > h;
};
const anyTitle = (s: SeasonEntry) => s.champion || s.copaChampion || s.estadualChampion;
const foreigners = (d: SeasonDetails | null | undefined) => (d?.lineup ?? []).filter((p) => p.nationality !== 'BRA').length;
const byFinish = (a: SeasonEntry, b: SeasonEntry) => (a.finishedAt ?? '').localeCompare(b.finishedAt ?? '');
/** Temporadas finalizadas até esta (inclusive), em ordem. */
const careerSeasons = (ctx: AchievementContext): SeasonEntry[] => {
  const prev = ctx.previous.filter((s) => s.status === 'finished' && s.runId !== ctx.season?.runId);
  return [...prev, ...(ctx.season?.status === 'finished' ? [ctx.season] : [])].sort(byFinish);
};
/** Gol que deu a vitória (o que pôs o time na frente pela última vez), se houver. */
function winningGoal(m: MatchLine): { minute: number; name: string } | null {
  const [f, a] = forAgainst(m);
  if (f <= a) return null;
  const side = userSide(m);
  const goals = m.goals.map((g, i) => ({ g, i })).sort((x, y) => x.g.minute - y.g.minute || x.i - y.i);
  let us = 0;
  let them = 0;
  let decisive: { minute: number; name: string } | null = null;
  for (const { g } of goals) {
    const wasAhead = us > them;
    if (g.side === side) us++;
    else them++;
    if (!wasAhead && us > them) decisive = { minute: g.minute, name: g.name };
  }
  return us === f && them === a ? decisive : null;
}
/** Maior número de gols de um jogador do seu time numa partida. */
function bestHaul(ctx: AchievementContext): { name: string; goals: number; rival: string } | null {
  let best: { name: string; goals: number; rival: string } | null = null;
  for (const m of userMatches(ctx)) {
    const side = userSide(m);
    const count = new Map<string, number>();
    for (const g of m.goals) if (g.side === side) count.set(g.name, (count.get(g.name) ?? 0) + 1);
    for (const [name, goals] of count) if (!best || goals > best.goals) best = { name, goals, rival: rivalOf(m) };
  }
  return best;
}
/** Confronto de Copa do Brasil virado: perdeu a ida e passou de fase. */
function comeback(ctx: AchievementContext): { stage: string; rival: string; agg: [number, number] } | null {
  const ms = userMatches(ctx).filter((m) => m.comp === 'copa');
  for (const ida of ms) {
    if (!/\(ida\)$/.test(ida.label)) continue;
    const volta = ms.find((m) => m.label === ida.label.replace(/\(ida\)$/, '(volta)'));
    if (!volta) continue;
    const [f1, a1] = forAgainst(ida);
    if (f1 >= a1) continue;
    const [f2, a2] = forAgainst(volta);
    const agg: [number, number] = [f1 + f2, a1 + a2];
    const so = shootoutWon(volta);
    const advanced = agg[0] > agg[1] || (agg[0] === agg[1] && so === true);
    if (advanced) return { stage: ida.label.replace(/^Copa do Brasil · /, '').replace(/ \(ida\)$/, ''), rival: rivalOf(ida), agg };
  }
  return null;
}
/** Clube de um time adversário (pela tabela; nas copas, pelo nome). */
function clubOfTeam(teamId: string, name: string, d: SeasonDetails | null | undefined): string | null {
  const row = d?.standings.find((r) => r.team === teamId);
  if (row?.clubId) return row.clubId;
  const club = CLUBS.find((c) => name === c.name || name.startsWith(`${c.name} `) || name === c.short);
  return club?.id ?? null;
}
/** Datas (AAAA-MM-DD) dos Desafios Diários concluídos. */
function dailyDates(seasons: SeasonEntry[]): string[] {
  const out = new Set<string>();
  for (const s of seasons) {
    if (s.mode !== 'diario' || s.status !== 'finished') continue;
    const m = s.challengeLabel?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) out.add(`${m[3]}-${m[2]}-${m[1]}`);
  }
  return [...out].sort();
}
/** Maior sequência de dias consecutivos numa lista de datas ordenadas. */
function longestDayStreak(dates: string[]): number {
  let best = 0;
  let cur = 0;
  let prev: number | null = null;
  for (const d of dates) {
    const t = Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86400000;
    cur = prev != null && t - prev === 1 ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = t;
  }
  return best;
}
/** Maior sequência de títulos brasileiros seguidos (temporadas finalizadas em ordem). */
function longestTitleStreak(seasons: SeasonEntry[]): number {
  let best = 0;
  let cur = 0;
  for (const s of seasons) {
    cur = s.champion ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
}
const eraDecadesWon = (seasons: SeasonEntry[]) => new Set(seasons.filter((s) => s.mode === 'era' && s.champion && s.fixedDecade).map((s) => s.fixedDecade!));
const brClubsWon = (titles: TitleRecord[]) => new Set(titles.filter((t) => t.competitionId === 'brasileirao' && t.clubId).map((t) => t.clubId!));
function personsUsed(ctx: AchievementContext): Set<string> {
  const out = new Set<string>();
  for (const s of careerSeasons(ctx)) for (const p of s.metrics?.persons ?? []) out.add(p);
  for (const p of ctx.details?.lineup ?? []) if (ctx.season?.status === 'finished') out.add(p.personId);
  return out;
}

ACHIEVEMENT_DEFS.push(
  // --- montagem do time ------------------------------------------------------
  {
    id: 'legiao-estrangeira',
    name: 'Legião Estrangeira',
    objective: 'Ganhe um título com 7 ou mais estrangeiros no time titular.',
    message: ({ value }) => `${value ?? 7} gringos no time titular e taça na mão!`,
    icon: 'globe',
    tier: 'ouro',
    triggers: ['temporada'],
    check: ({ season, details }) => {
      if (!season || season.status !== 'finished' || !anyTitle(season)) return null;
      const n = foreigners(details);
      return n >= 7 ? done(season.runId, n, `${n} estrangeiros · ${season.teamName}`) : null;
    },
  },
  {
    id: 'selecao-do-mundo',
    name: 'Seleção do Mundo',
    objective: 'Ganhe o Brasileirão com os 11 titulares estrangeiros (possível na Mistura Brasileira).',
    message: () => 'Onze estrangeiros e o título brasileiro. Uma seleção do mundo!',
    icon: 'globe',
    tier: 'lendaria',
    triggers: ['temporada'],
    check: ({ season, details }) =>
      season?.champion && details?.lineup.length && foreigners(details) === details.lineup.length ? done(season.runId, details.lineup.length, `${season.teamName} · 11 estrangeiros`) : null,
  },
  {
    id: 'maquina-do-tempo',
    name: 'Máquina do Tempo',
    objective: 'Seja campeão brasileiro com jogadores de 6 ou mais décadas diferentes no time titular.',
    message: ({ value }) => `Craques de ${value ?? 6} décadas jogando juntos, e campeões!`,
    icon: 'hourglass',
    tier: 'prata',
    triggers: ['temporada'],
    check: ({ season, details }) => {
      if (!season?.champion) return null;
      const n = details ? new Set(details.lineup.map((p) => p.decade)).size : Object.keys(season.metrics?.decadeCounts ?? {}).length;
      return n >= 6 ? done(season.runId, n, `${n} décadas · ${season.teamName}`) : null;
    },
  },
  {
    id: 'volta-pelo-brasil',
    name: 'Volta pelo Brasil',
    objective: 'Na Mistura Brasileira, seja campeão brasileiro com 11 jogadores de 11 clubes diferentes.',
    message: () => 'Um jogador de cada canto do país, e o título brasileiro!',
    icon: 'route',
    tier: 'ouro',
    triggers: ['temporada'],
    check: ({ season, details }) => {
      if (!season?.champion || season.mode !== 'mistura' || !details?.lineup.length) return null;
      const n = new Set(details.lineup.map((p) => p.club)).size;
      return n >= 11 ? done(season.runId, n, `${n} clubes diferentes`) : null;
    },
  },
  {
    id: 'azarao',
    name: 'Azarão',
    objective: 'Ganhe o Brasileirão com overall médio do time titular de 80 ou menos.',
    message: ({ value }) => `Ninguém apostava num time de overall ${value}. Campeão!`,
    icon: 'dice',
    tier: 'ouro',
    triggers: ['temporada'],
    check: ({ season }) => {
      if (!season?.champion) return null;
      const ovr = Math.round(season.squadOverall);
      return ovr <= 80 ? done(season.runId, ovr, `Overall médio ${ovr} · ${season.teamName}`) : null;
    },
  },
  {
    id: 'capitao-artilheiro',
    name: 'Capitão Artilheiro',
    objective: 'Termine o Brasileirão com o seu capitão como artilheiro do campeonato.',
    message: ({ detail }) => `${detail ?? 'O capitão'}: braçadeira e artilharia!`,
    icon: 'captain',
    tier: 'prata',
    triggers: ['temporada'],
    check: ({ season, details }) => {
      const ts = details?.leagueTopScorer;
      const captain = details?.lineup.find((p) => p.captain)?.name ?? season?.captainName;
      if (!season || season.status !== 'finished' || !ts?.user || !captain || ts.name !== captain) return null;
      return done(season.runId, ts.goals, `${ts.name}, ${plural(ts.goals, 'gol')}`);
    },
  },
  // --- dentro da temporada -----------------------------------------------------
  {
    id: 'aos-45-do-segundo',
    name: 'Aos 45 do Segundo',
    objective: 'Vença uma partida com o gol da vitória a partir dos 88 minutos (ou nos acréscimos).',
    message: ({ detail }) => `${detail ?? 'Gol no finzinho'}. Quem sai antes do apito final perde essa!`,
    icon: 'clock',
    tier: 'bronze',
    triggers: ['partida', 'temporada'],
    check: (ctx) => {
      for (const m of userMatches(ctx)) {
        const g = winningGoal(m);
        if (g && g.minute >= 88) {
          const [f, a] = forAgainst(m);
          return done(runOf(ctx), g.minute, `${g.name} aos ${g.minute}' · ${f} × ${a} no ${rivalOf(m)}`);
        }
      }
      return null;
    },
  },
  {
    id: 'na-marca-da-cal',
    name: 'Na Marca da Cal',
    objective: 'Vença uma disputa de pênaltis num mata-mata de ida e volta.',
    message: () => 'Frieza na marca da cal: classificado nos pênaltis!',
    icon: 'target',
    tier: 'bronze',
    triggers: ['partida', 'temporada'],
    check: (ctx) => {
      const m = userMatches(ctx).find((x) => shootoutWon(x) === true);
      if (!m) return null;
      const [h, a] = m.shootout!;
      const [f, c] = userSide(m) === 'home' ? [h, a] : [a, h];
      return done(runOf(ctx), f, `${f} × ${c} nos pênaltis contra o ${rivalOf(m)}`);
    },
  },
  {
    id: 'remontada',
    name: 'Remontada',
    objective: 'Passe de fase na Copa do Brasil depois de perder o jogo de ida.',
    message: ({ detail }) => `${detail ?? 'Virada no confronto'}. A volta foi épica!`,
    icon: 'comeback',
    tier: 'ouro',
    triggers: ['partida', 'temporada'],
    check: (ctx) => {
      const c = comeback(ctx);
      return c ? done(runOf(ctx), c.agg[0] - c.agg[1], `${c.stage}: ${c.agg[0]} × ${c.agg[1]} no agregado contra o ${c.rival}`) : null;
    },
  },
  {
    id: 'poquer',
    name: 'Pôquer',
    objective: 'Tenha um jogador marcando 4 gols ou mais numa mesma partida.',
    message: ({ detail }) => `${detail ?? 'Quatro gols numa partida'}. Noite inesquecível!`,
    icon: 'four',
    tier: 'bronze',
    triggers: ['partida', 'temporada'],
    check: (ctx) => {
      const b = bestHaul(ctx);
      return b && b.goals >= 4 ? done(runOf(ctx), b.goals, `${b.name} marcou ${b.goals} contra o ${b.rival}`) : null;
    },
  },
  {
    id: 'paredao',
    name: 'Paredão',
    objective: 'Termine o Brasileirão sem sofrer gols em 20 jogos ou mais.',
    message: ({ value }) => `${value} jogos sem sofrer gols no Brasileirão. Ninguém passa!`,
    icon: 'glove',
    tier: 'prata',
    triggers: ['temporada'],
    check: ({ season }) => {
      const n = season?.status === 'finished' ? (season.metrics?.cleanSheets ?? 0) : 0;
      return n >= 20 ? done(season!.runId, n, `${n} jogos sem sofrer gols`) : null;
    },
    progress: ({ finished }) => {
      const best = maxOf(finished.map((s) => s.metrics?.cleanSheets ?? 0)) ?? 0;
      return { current: Math.min(best, 20), target: 20, text: `Seu recorde: ${plural(best, 'jogo')} sem sofrer gols no Brasileirão.` };
    },
  },
  {
    id: 'dono-do-classico',
    name: 'Dono do Clássico',
    objective: 'Vença todos os clássicos da temporada contra os rivais do seu clube (pelo menos dois).',
    message: ({ value }) => `${plural(value ?? 2, 'clássico')}, ${plural(value ?? 2, 'vitória')}. A cidade é sua!`,
    icon: 'versus',
    tier: 'prata',
    triggers: ['temporada'],
    check: (ctx) => {
      const { season, details } = ctx;
      if (!season || season.status !== 'finished' || !season.clubId) return null;
      const derbies = userMatches(ctx).filter((m) => {
        const rival = m.home === USER_ID ? clubOfTeam(m.away, m.awayName, details) : clubOfTeam(m.home, m.homeName, details);
        return isDerby(season.clubId, rival);
      });
      if (derbies.length < 2 || !derbies.every((m) => forAgainst(m)[0] > forAgainst(m)[1])) return null;
      return done(season.runId, derbies.length, `${plural(derbies.length, 'clássico')} vencidos · ${season.teamName}`);
    },
  },
  // --- carreira ------------------------------------------------------------------
  {
    id: 'dinastia',
    name: 'Dinastia',
    objective: 'Ganhe o Brasileirão em 3 temporadas seguidas.',
    message: () => 'Tricampeão brasileiro em sequência. Uma dinastia!',
    icon: 'dynasty',
    tier: 'ouro',
    triggers: ['temporada'],
    check: (ctx) => {
      if (!ctx.season?.champion) return null;
      const seasons = careerSeasons(ctx);
      const i = seasons.findIndex((s) => s.runId === ctx.season!.runId);
      if (i < 2) return null;
      return seasons.slice(i - 2, i + 1).every((s) => s.champion) ? done(ctx.season.runId, 3, 'Tricampeão em sequência') : null;
    },
    progress: ({ finished }) => {
      const best = longestTitleStreak([...finished].sort(byFinish));
      return { current: Math.min(best, 3), target: 3, text: `Sua maior sequência: ${plural(best, 'título', 'títulos')} brasileiros seguidos.` };
    },
  },
  {
    id: 'volta-ao-mundo-das-eras',
    name: 'Volta ao Mundo das Eras',
    objective: `Seja campeão brasileiro na Era Única com cada uma das ${DECADES.length} décadas, dos anos 50 aos anos 2020.`,
    message: () => 'Campeão em todas as eras do futebol brasileiro!',
    icon: 'history',
    tier: 'lendaria',
    triggers: ['temporada'],
    check: (ctx) => {
      if (ctx.season?.mode !== 'era' || !ctx.season.champion) return null;
      const won = eraDecadesWon(careerSeasons(ctx));
      return DECADES.every((d) => won.has(d)) ? done(ctx.season.runId, DECADES.length, `${DECADES.length} décadas conquistadas`) : null;
    },
    progress: ({ finished }) => {
      const won = eraDecadesWon(finished);
      const missing = DECADES.filter((d) => !won.has(d));
      return {
        current: won.size,
        target: DECADES.length,
        text: missing.length ? `${won.size} de ${DECADES.length} décadas. Faltam: ${missing.map((d) => `anos ${d.slice(2, 4)}`).join(', ')}.` : 'Todas as eras conquistadas.',
      };
    },
  },
  {
    id: 'rodando-o-brasil',
    name: 'Rodando o Brasil',
    objective: 'Ganhe o Brasileirão com 10 clubes diferentes.',
    message: () => 'Campeão brasileiro com 10 camisas diferentes!',
    icon: 'pin',
    tier: 'ouro',
    triggers: ['titulo', 'temporada'],
    check: (ctx) => {
      const clubs = brClubsWon(ctx.titles);
      if (clubs.size < 10) return null;
      const last = [...ctx.titles].filter((t) => t.competitionId === 'brasileirao').sort((a, b) => b.wonAt.localeCompare(a.wonAt))[0];
      return done(ctx.season?.runId ?? last?.runId ?? null, clubs.size, `${clubs.size} clubes campeões`);
    },
    progress: ({ titles }) => {
      const n = brClubsWon(titles).size;
      return { current: Math.min(n, 10), target: 10, text: `Campeão brasileiro com ${plural(n, 'clube')} de 10.` };
    },
  },
  {
    id: 'colecionador',
    name: 'Colecionador',
    objective: 'Escale 100 jogadores diferentes somando as suas temporadas.',
    message: ({ value }) => `${value} jogadores diferentes já vestiram a sua camisa!`,
    icon: 'cards',
    tier: 'prata',
    triggers: ['temporada'],
    check: (ctx) => {
      const n = personsUsed(ctx).size;
      return ctx.season && n >= 100 ? done(ctx.season.runId, n, `${n} jogadores diferentes`) : null;
    },
    progress: ({ finished }) => {
      const n = new Set(finished.flatMap((s) => s.metrics?.persons ?? [])).size;
      return { current: Math.min(n, 100), target: 100, text: `${plural(n, 'jogador')} diferentes escalados de 100.` };
    },
  },
  {
    id: 'fiel-ao-desafio',
    name: 'Fiel ao Desafio',
    objective: 'Complete o Desafio Diário 7 dias seguidos.',
    message: () => 'Uma semana inteira de Desafio Diário. Isso é fidelidade!',
    icon: 'calendar',
    tier: 'prata',
    triggers: ['temporada'],
    check: (ctx) => {
      if (ctx.season?.mode !== 'diario') return null;
      const streak = longestDayStreak(dailyDates(careerSeasons(ctx)));
      return streak >= 7 ? done(ctx.season.runId, streak, `${streak} dias seguidos`) : null;
    },
    progress: ({ finished }) => {
      const best = longestDayStreak(dailyDates(finished));
      return { current: Math.min(best, 7), target: 7, text: `Sua maior sequência: ${plural(best, 'dia')} seguidos.` };
    },
  },
  {
    id: 'top-10-11brl',
    name: 'Top 10 do 11BRL',
    objective: 'Coloque uma temporada no top 10 do ranking de todos os jogadores, na dificuldade em que jogou (é preciso entrar com a sua conta).',
    message: ({ value }) => `${value}º lugar no ranking de todos os jogadores do 11BRL!`,
    icon: 'podium',
    tier: 'lendaria',
    triggers: ['ranking'],
    check: ({ ranking }) => (ranking && ranking.position >= 1 && ranking.position <= 10 ? done(ranking.runId, ranking.position, `${ranking.position}º no ranking global`) : null),
  },
);

export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENT_DEFS.map((a) => [a.id, a]));

/**
 * Verifica as conquistas ligadas a um gatilho e devolve só as novas
 * (nunca duplica uma conquista já desbloqueada).
 */
export function evaluateAchievements(ctx: AchievementContext, unlocked: Iterable<string>, at: string): UnlockRecord[] {
  const have = new Set(unlocked);
  const out: UnlockRecord[] = [];
  for (const def of ACHIEVEMENT_DEFS) {
    if (have.has(def.id) || !def.triggers.includes(ctx.trigger)) continue;
    const r = def.check(ctx);
    if (!r) continue;
    have.add(def.id);
    out.push({ id: def.id, name: def.name, tier: def.tier, unlockedAt: at, runId: r.runId, value: r.value, detail: r.detail });
  }
  return out;
}

/** Junta desbloqueios sem duplicar: o mais antigo de cada conquista prevalece. */
export function mergeUnlocks(a: UnlockRecord[], b: UnlockRecord[]): UnlockRecord[] {
  const map = new Map<string, UnlockRecord>();
  for (const u of [...a, ...b]) {
    const cur = map.get(u.id);
    if (!cur || u.unlockedAt < cur.unlockedAt) map.set(u.id, u);
  }
  return [...map.values()].sort((x, y) => x.unlockedAt.localeCompare(y.unlockedAt));
}
