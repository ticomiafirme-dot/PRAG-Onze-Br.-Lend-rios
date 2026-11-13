// Catálogo de conquistas. Cada conquista tem um id único, raridade, os momentos
// em que é verificada (gatilhos) e a própria condição de desbloqueio. Para criar
// uma conquista nova basta acrescentar uma entrada em ACHIEVEMENT_DEFS: o motor,
// as telas, a sincronização e o Hall dos Lendários passam a considerá-la.
// Tudo é calculado com dados reais das temporadas do jogador.
import type { IconName } from '../components/icons';
import { COMPETITIONS } from './competitions';
import type { AchievementTier, SeasonEntry, TitleRecord, UnlockRecord } from './types';

export type { AchievementTier } from './types';

/** Momentos do jogo em que as conquistas são verificadas. */
export type Trigger = 'elenco' | 'partida' | 'titulo' | 'temporada' | 'recorde';

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
