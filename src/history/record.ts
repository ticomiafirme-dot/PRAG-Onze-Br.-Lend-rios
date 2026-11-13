// Monta o registro (SeasonRecord) a partir da campanha real do jogador.
import { DECADES, toPosition, type Decade } from '../data/types';
import { leagueStandings, summarize, USER_ID, userPlayerStats, type Campaign } from '../engine/campaign';
import type { CupState } from '../engine/cup';
import { topScorers, type PlayedMatch } from '../engine/league';
import { MODE_INFO } from '../state/modes';
import type { Run } from '../state/store';
import type { CupSummary, MatchLine, SeasonDetails, SeasonMark, SeasonMetrics, SeasonRecord, SeasonStatus } from './types';

const pct = (x: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/** Aproveitamento em % (pontos conquistados ÷ pontos disputados). */
export function efficiency(points: number, played: number): number {
  return played > 0 ? Math.round((points / (played * 3)) * 1000) / 10 : 0;
}

function decadesByUse(decades: Decade[]): Decade[] {
  const count = new Map<Decade, number>();
  for (const d of decades) count.set(d, (count.get(d) ?? 0) + 1);
  return [...count.keys()].sort((a, b) => count.get(b)! - count.get(a)! || DECADES.indexOf(a) - DECADES.indexOf(b));
}

function cupSummary(c: Campaign, cup: CupState | null): CupSummary | null {
  if (!cup) return null;
  const champion = cup.champion ? (c.teams[cup.champion]?.name ?? null) : null;
  if (cup.champion === USER_ID) return { name: cup.name, champion, userResult: 'Campeão' };
  let last: { name: string; lost: boolean } | null = null;
  for (const st of cup.stages) {
    const tie = st.ties.find((t) => t.a === USER_ID || t.b === USER_ID);
    if (tie) last = { name: st.name, lost: !!tie.winner && tie.winner !== USER_ID };
  }
  let userResult = 'Não disputou';
  if (last) userResult = last.lost ? (last.name === 'Final' ? 'Vice-campeão' : `Eliminado: ${last.name}`) : `Em disputa: ${last.name}`;
  else if (cup.groupStage?.teams.includes(USER_ID)) userResult = cup.groupStage.fixtures.every((f) => f.key) ? 'Eliminado no triangular' : 'Triangular';
  return { name: cup.name, champion, userResult };
}

/** Placar do ponto de vista do usuário: [a favor, contra]. */
function userScore(m: { home: string; score: [number, number] }): [number, number] {
  return m.home === USER_ID ? [m.score[0], m.score[1]] : [m.score[1], m.score[0]];
}

function longest<T>(xs: T[], ok: (x: T) => boolean): number {
  let best = 0;
  let cur = 0;
  for (const x of xs) {
    cur = ok(x) ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
}

function computeMetrics(matches: MatchLine[], details: Pick<SeasonDetails, 'sequence' | 'lineup' | 'topScorer'>, points: number): SeasonMetrics {
  const league = matches.filter((m) => m.comp === 'brasileirao');
  const scored = matches.map((m) => ({ m, s: userScore(m), rival: m.home === USER_ID ? m.awayName : m.homeName }));
  const wins = scored.filter(({ s }) => s[0] > s[1]).sort((a, b) => b.s[0] - b.s[1] - (a.s[0] - a.s[1]) || b.s[0] - a.s[0]);
  const most = [...scored].sort((a, b) => b.s[0] - a.s[0] || a.s[1] - b.s[1])[0];
  const best = [...details.lineup].sort((a, b) => b.overall - a.overall)[0];
  const decadeCounts: SeasonMetrics['decadeCounts'] = {};
  for (const p of details.lineup) decadeCounts[p.decade] = (decadeCounts[p.decade] ?? 0) + 1;
  return {
    efficiency: efficiency(points, league.length),
    winStreak: longest(details.sequence, (r) => r === 'V'),
    unbeatenStreak: longest(details.sequence, (r) => r !== 'D'),
    cleanSheets: league.filter((m) => userScore(m)[1] === 0).length,
    cleanSheetStreak: longest(league, (m) => userScore(m)[1] === 0),
    biggestWin: wins[0] ? { diff: wins[0].s[0] - wins[0].s[1], for: wins[0].s[0], against: wins[0].s[1], rival: wins[0].rival } : null,
    mostGoalsMatch: most && most.s[0] > 0 ? { goals: most.s[0], against: most.s[1], rival: most.rival } : null,
    topScorer: details.topScorer,
    bestCard: best ? { name: best.name, overall: best.overall, club: best.club, decade: best.decade } : null,
    lossesAll: scored.filter(({ s }) => s[0] < s[1]).length,
    decadeCounts,
  };
}

function seasonMarks(c: Campaign, metrics: SeasonMetrics, details: Pick<SeasonDetails, 'standings' | 'leagueTopScorer' | 'sequence'>): SeasonMark[] {
  const marks: SeasonMark[] = [];
  const played = details.sequence.length;
  const complete = played === c.league.fixtures.length;
  if (played) marks.push({ id: 'aproveitamento', label: 'Aproveitamento', value: `${pct(metrics.efficiency)}%` });
  const bw = metrics.biggestWin;
  if (bw) marks.push({ id: 'goleada', label: 'Maior goleada', value: `${bw.for} × ${bw.against} no ${bw.rival}` });
  if (metrics.winStreak >= 3) marks.push({ id: 'sequencia', label: 'Maior sequência de vitórias', value: `${metrics.winStreak} jogos` });
  if (metrics.unbeatenStreak > metrics.winStreak && metrics.unbeatenStreak < played && metrics.unbeatenStreak >= 5)
    marks.push({ id: 'invencibilidade', label: 'Maior invencibilidade', value: `${metrics.unbeatenStreak} jogos` });
  if (metrics.cleanSheets) marks.push({ id: 'sem-sofrer', label: 'Jogos sem sofrer gols', value: String(metrics.cleanSheets) });
  const table = details.standings;
  const me = table.find((r) => r.user);
  if (me && complete) {
    if ([...table].sort((a, b) => b.gf - a.gf)[0].user) marks.push({ id: 'ataque', label: 'Melhor ataque do campeonato', value: `${me.gf} gols` });
    if ([...table].sort((a, b) => a.ga - b.ga)[0].user) marks.push({ id: 'defesa', label: 'Melhor defesa do campeonato', value: `${me.ga} gols sofridos` });
  }
  const ts = details.leagueTopScorer;
  if (ts?.user && complete) marks.push({ id: 'artilheiro', label: 'Artilheiro do Brasileirão', value: `${ts.name} (${ts.goals} gols)` });
  return marks;
}

/**
 * Registro da temporada da partida `run`. Retorna null se a temporada ainda
 * não começou (sem campanha).
 */
export function buildSeasonRecord(run: Run, status: SeasonStatus, now: string = new Date().toISOString()): SeasonRecord | null {
  const c = run.campaign;
  if (!c || !run.formationId) return null;
  const user = c.teams[USER_ID];
  const s = summarize(c);
  const name = (id: string) => c.teams[id]?.name ?? id;
  const byKey = new Map<string, PlayedMatch>(c.results.map((m) => [m.key, m]));

  const matches: MatchLine[] = c.userMatches.map((um) => {
    const compact = byKey.get(um.key);
    return {
      comp: um.comp,
      label: um.label,
      home: um.home,
      away: um.away,
      homeName: name(um.home),
      awayName: name(um.away),
      score: [um.result.score[0], um.result.score[1]],
      ...(um.shootout ? { shootout: um.shootout.score } : compact?.shootout ? { shootout: compact.shootout } : {}),
      goals: (compact?.goals ?? []).map((g) => ({ side: g.side, name: g.name, minute: g.minute, ...(g.penalty ? { penalty: true } : {}) })),
    };
  });

  const sequence = c.results
    .filter((m) => m.comp === 'brasileirao' && (m.home === USER_ID || m.away === USER_ID))
    .map((m) => {
      const [f, a] = userScore(m);
      return f > a ? 'V' : f === a ? 'E' : 'D';
    }) as SeasonDetails['sequence'];

  const standings = leagueStandings(c).map((r) => {
    const t = c.teams[r.team];
    return { team: r.team, name: t.name, short: t.short, clubId: t.clubId, label: t.label, user: r.team === USER_ID, p: r.p, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, pts: r.pts };
  });

  const players = userPlayerStats(c).map((p) => ({ ...p, pos: toPosition(p.pos) }));
  const leaguePlayers = userPlayerStats(c, 'brasileirao');
  const scorer = [...leaguePlayers].sort((a, b) => b.goals - a.goals || b.assists - a.assists)[0];
  const maxGames = Math.max(0, ...players.map((p) => p.games));
  const best = players.filter((p) => p.games > 0 && p.games >= maxGames / 2).sort((a, b) => b.rating - a.rating)[0];
  const lts = topScorers(c.results.filter((m) => m.comp === 'brasileirao'))[0];
  const leagueTopScorer = lts ? { name: lts.name, team: name(lts.team), goals: lts.goals, user: lts.team === USER_ID } : null;

  const details: SeasonDetails = {
    lineup: user.players.map((p) => ({
      slotId: p.slotId,
      pos: toPosition(p.pos),
      cardKey: p.cardKey,
      personId: p.personId,
      name: p.name,
      club: p.club,
      decade: p.decade,
      nationality: p.nationality,
      number: p.number,
      overall: p.base,
      captain: p.captain,
    })),
    standings,
    matches,
    players,
    sequence,
    topScorer: scorer && scorer.goals > 0 ? { name: scorer.name, goals: scorer.goals } : null,
    bestPlayer: best ? { name: best.name, rating: best.rating } : null,
    leagueTopScorer,
    copa: cupSummary(c, c.copa),
    estadual: cupSummary(c, c.estadual),
    marks: [],
    rounds: c.league.fixtures.length,
  };
  const metrics = computeMetrics(matches, details, s.points);
  details.marks = seasonMarks(c, metrics, details);
  const squadOverall = Math.round((user.players.reduce((a, p) => a + p.base, 0) / Math.max(1, user.players.length)) * 10) / 10;

  const finished = status === 'finished';
  const record: SeasonRecord = {
    runId: run.id,
    status,
    mode: run.mode,
    modeLabel: MODE_INFO[run.mode].name,
    challengeLabel: run.challenge?.label ?? null,
    clubId: run.clubId,
    teamName: user.name,
    teamShort: user.short,
    colors: user.colors,
    decades: decadesByUse(user.players.map((p) => p.decade)),
    fixedDecade: run.decade ?? run.challenge?.decade ?? null,
    formationId: run.formationId,
    difficulty: run.difficulty,
    startedAt: c.createdAt,
    finishedAt: status === 'in_progress' ? null : now,
    played: s.played,
    position: s.played > 0 ? s.position : null,
    points: s.points,
    wins: s.wins,
    draws: s.draws,
    losses: s.losses,
    goalsFor: s.gf,
    goalsAgainst: s.ga,
    squadOverall,
    teamOverall: user.ratings.overall,
    chemistry: user.chem,
    captainName: user.players.find((p) => p.captain)?.name ?? null,
    champion: finished && s.champion,
    perfect: finished && s.perfect,
    unbeaten: finished && s.unbeaten,
    copaChampion: s.copaChampion,
    estadualChampion: s.estadualChampion,
    triple: finished && s.triple,
    achievements: [],
    metrics,
    details,
  };
  return record;
}

/** Só os dados de lista (sem os detalhes). */
export function toEntry(r: SeasonRecord): Omit<SeasonRecord, 'details'> {
  const { details: _details, ...entry } = r;
  void _details;
  return entry;
}

/** Rótulo curto das décadas da temporada (ex.: "Anos 80" ou "Anos 70 · 80 · 90"). */
export function decadesLabel(r: { decades: Decade[]; fixedDecade: Decade | null }, max = 3): string {
  const list = r.fixedDecade ? [r.fixedDecade] : r.decades;
  if (!list.length) return '';
  if (list.length === 1) return `Anos ${list[0].slice(2, 4)}`;
  const shown = [...list.slice(0, max)].sort((a, b) => DECADES.indexOf(a) - DECADES.indexOf(b));
  return `Anos ${shown.map((d) => d.slice(2, 4)).join(' · ')}${list.length > max ? ' +' : ''}`;
}
