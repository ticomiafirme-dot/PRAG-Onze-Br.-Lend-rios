import { describe, expect, it } from 'vitest';
import { ICONS } from '../components/icons';
import { DECADES, type Decade } from '../data/types';
import { USER_ID } from '../engine/campaign';
import { ACHIEVEMENT_BY_ID, ACHIEVEMENT_DEFS, evaluateAchievements, type AchievementContext, type Trigger } from './achievements';
import { rankingReached, RETROACTIVE_IDS, retroactiveUnlocks, EMPTY_HISTORY, type HistoryData } from './engine';
import type { LineupEntry, MatchLine, SeasonDetails, SeasonEntry, TitleRecord } from './types';

const at = (d: number) => new Date(Date.UTC(2026, 0, d)).toISOString();

function entry(over: Partial<SeasonEntry>): SeasonEntry {
  return {
    runId: 'x',
    status: 'finished',
    mode: 'classico',
    modeLabel: 'Clássico',
    challengeLabel: null,
    clubId: 'corinthians',
    teamName: 'Corinthians',
    teamShort: 'COR',
    colors: { primary: '#000', secondary: '#fff', accent: '#fff' },
    decades: ['1990s'],
    fixedDecade: null,
    formationId: '4-3-3',
    difficulty: 'normal',
    startedAt: at(1),
    finishedAt: at(2),
    played: 38,
    position: 5,
    points: 60,
    wins: 17,
    draws: 9,
    losses: 12,
    goalsFor: 50,
    goalsAgainst: 40,
    squadOverall: 86,
    teamOverall: 86,
    chemistry: 60,
    captainName: null,
    champion: false,
    perfect: false,
    unbeaten: false,
    copaChampion: false,
    estadualChampion: false,
    triple: false,
    achievements: [],
    metrics: null,
    ...over,
  };
}

function player(i: number, over: Partial<LineupEntry> = {}): LineupEntry {
  return {
    slotId: `s${i}`,
    pos: 'MEI',
    cardKey: `p${i}@corinthians@1990s`,
    personId: `p${i}`,
    name: `Jogador ${i}`,
    club: 'corinthians',
    decade: '1990s',
    nationality: 'BRA',
    number: i + 1,
    overall: 85,
    captain: i === 10,
    ...over,
  };
}

const lineup = (f: (i: number) => Partial<LineupEntry> = () => ({})) => Array.from({ length: 11 }, (_, i) => player(i, f(i)));

type G = MatchLine['goals'][number];
function match(over: Partial<MatchLine> & { score: [number, number] }): MatchLine {
  return { comp: 'brasileirao', label: 'Brasileirão · Rodada 1', home: USER_ID, away: 't1', homeName: 'Corinthians', awayName: 'Palmeiras', goals: [], ...over };
}
const goal = (side: 'home' | 'away', name: string, minute: number): G => ({ side, name, minute });

function details(over: Partial<SeasonDetails> = {}): SeasonDetails {
  return {
    lineup: lineup(),
    standings: [
      { team: USER_ID, name: 'Corinthians', short: 'COR', clubId: 'corinthians', label: 'Seu time', user: true, p: 38, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 },
      { team: 't1', name: 'Palmeiras', short: 'PAL', clubId: 'palmeiras', label: 'Palmeiras 90s', user: false, p: 38, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 },
      { team: 't2', name: 'Bahia', short: 'BAH', clubId: 'bahia', label: 'Bahia 80s', user: false, p: 38, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 },
    ],
    matches: [],
    players: [],
    sequence: [],
    topScorer: null,
    bestPlayer: null,
    leagueTopScorer: null,
    copa: null,
    estadual: null,
    marks: [],
    rounds: 38,
    ...over,
  };
}

/** Conquistas desbloqueadas por um gatilho (ids). */
function unlocked(trigger: Trigger, ctx: Partial<AchievementContext>): string[] {
  return evaluateAchievements({ trigger, previous: [], titles: [], ...ctx }, [], at(9)).map((u) => u.id);
}

describe('conquistas novas: catálogo', () => {
  it('ids únicos, ícones existentes e todas retroativas (menos o top 10)', () => {
    const ids = ACHIEVEMENT_DEFS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(30);
    for (const d of ACHIEVEMENT_DEFS) expect(ICONS[d.icon], d.id).toBeTruthy();
    for (const id of RETROACTIVE_IDS) expect(ACHIEVEMENT_BY_ID[id], id).toBeDefined();
    expect(RETROACTIVE_IDS.size).toBe(17);
    expect(RETROACTIVE_IDS.has('top-10-11brl')).toBe(false);
  });
});

describe('conquistas novas: montagem do time', () => {
  it('Legião Estrangeira: título (qualquer um) com 7+ estrangeiros', () => {
    const d = details({ lineup: lineup((i) => (i < 7 ? { nationality: 'ARG' } : {})) });
    expect(unlocked('temporada', { season: entry({ copaChampion: true }), details: d })).toContain('legiao-estrangeira');
    expect(unlocked('temporada', { season: entry({}), details: d })).not.toContain('legiao-estrangeira');
    const six = details({ lineup: lineup((i) => (i < 6 ? { nationality: 'URU' } : {})) });
    expect(unlocked('temporada', { season: entry({ champion: true }), details: six })).not.toContain('legiao-estrangeira');
  });

  it('Seleção do Mundo: campeão brasileiro com os 11 estrangeiros', () => {
    const d = details({ lineup: lineup(() => ({ nationality: 'ARG' })) });
    expect(unlocked('temporada', { season: entry({ champion: true, mode: 'mistura' }), details: d })).toEqual(
      expect.arrayContaining(['selecao-do-mundo', 'legiao-estrangeira']),
    );
    expect(unlocked('temporada', { season: entry({ copaChampion: true }), details: d })).not.toContain('selecao-do-mundo');
  });

  it('Máquina do Tempo, Volta pelo Brasil e Azarão', () => {
    const decades: Decade[] = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s'];
    const d6 = details({ lineup: lineup((i) => ({ decade: decades[i % 6] })) });
    expect(unlocked('temporada', { season: entry({ champion: true }), details: d6 })).toContain('maquina-do-tempo');
    const clubs = ['santos', 'flamengo', 'vasco', 'gremio', 'bahia', 'sport', 'ceara', 'goias', 'coritiba', 'nautico', 'vitoria'];
    const d11 = details({ lineup: lineup((i) => ({ club: clubs[i] })) });
    expect(unlocked('temporada', { season: entry({ champion: true, mode: 'mistura', clubId: null }), details: d11 })).toContain('volta-pelo-brasil');
    expect(unlocked('temporada', { season: entry({ champion: true, mode: 'classico' }), details: d11 })).not.toContain('volta-pelo-brasil');
    expect(unlocked('temporada', { season: entry({ champion: true, squadOverall: 80.4 }) })).toContain('azarao');
    expect(unlocked('temporada', { season: entry({ champion: true, squadOverall: 80.6 }) })).not.toContain('azarao');
  });

  it('Capitão Artilheiro: o capitão é o artilheiro do Brasileirão', () => {
    const d = details({ leagueTopScorer: { name: 'Jogador 10', team: 'Corinthians', goals: 25, user: true } });
    expect(unlocked('temporada', { season: entry({}), details: d })).toContain('capitao-artilheiro');
    const other = details({ leagueTopScorer: { name: 'Jogador 3', team: 'Corinthians', goals: 25, user: true } });
    expect(unlocked('temporada', { season: entry({}), details: other })).not.toContain('capitao-artilheiro');
  });
});

describe('conquistas novas: dentro da temporada', () => {
  const run = { runId: 'r', for: 0, against: 0, rival: '' };

  it('Aos 45 do Segundo: o gol da vitória sai a partir dos 88 minutos', () => {
    const late = match({ score: [2, 1], goals: [goal('home', 'A', 10), goal('away', 'B', 50), goal('home', 'C', 89)] });
    expect(unlocked('partida', { match: run, details: details({ matches: [late] }) })).toContain('aos-45-do-segundo');
    // gol no fim de uma vitória já garantida não conta
    const garbage = match({ score: [3, 0], goals: [goal('home', 'A', 10), goal('home', 'A', 20), goal('home', 'C', 90)] });
    expect(unlocked('partida', { match: run, details: details({ matches: [garbage] }) })).not.toContain('aos-45-do-segundo');
    // jogando fora de casa
    const away = match({ home: 't1', away: USER_ID, score: [0, 1], goals: [goal('away', 'Z', 90)] });
    expect(unlocked('partida', { match: run, details: details({ matches: [away] }) })).toContain('aos-45-do-segundo');
  });

  it('Na Marca da Cal: vence a disputa de pênaltis', () => {
    const won = match({ comp: 'copa', label: 'Copa do Brasil · Oitavas (volta)', home: 't1', away: USER_ID, score: [1, 1], shootout: [3, 4] });
    expect(unlocked('partida', { match: run, details: details({ matches: [won] }) })).toContain('na-marca-da-cal');
    const lost = { ...won, shootout: [5, 4] as [number, number] };
    expect(unlocked('partida', { match: run, details: details({ matches: [lost] }) })).not.toContain('na-marca-da-cal');
  });

  it('Remontada: perde a ida e passa na Copa do Brasil (no agregado ou nos pênaltis)', () => {
    const ida = match({ comp: 'copa', label: 'Copa do Brasil · Quartas (ida)', home: 't1', away: USER_ID, score: [2, 0] });
    const volta = match({ comp: 'copa', label: 'Copa do Brasil · Quartas (volta)', score: [3, 0] });
    expect(unlocked('partida', { match: run, details: details({ matches: [ida, volta] }) })).toContain('remontada');
    const penaltis = match({ comp: 'copa', label: 'Copa do Brasil · Quartas (volta)', score: [2, 0], shootout: [4, 2] });
    expect(unlocked('partida', { match: run, details: details({ matches: [ida, penaltis] }) })).toContain('remontada');
    const fora = match({ comp: 'copa', label: 'Copa do Brasil · Quartas (volta)', score: [1, 0] });
    expect(unlocked('partida', { match: run, details: details({ matches: [ida, fora] }) })).not.toContain('remontada');
  });

  it('Pôquer: um jogador do seu time marca 4 gols', () => {
    const four = match({ score: [5, 0], goals: [1, 2, 3, 4].map((m) => goal('home', 'Artilheiro', m * 10)).concat(goal('home', 'Outro', 80)) });
    expect(unlocked('partida', { match: run, details: details({ matches: [four] }) })).toContain('poquer');
    const rival = match({ score: [0, 4], goals: [1, 2, 3, 4].map((m) => goal('away', 'Rival', m * 10)) });
    expect(unlocked('partida', { match: run, details: details({ matches: [rival] }) })).not.toContain('poquer');
  });

  it('Paredão: 20 jogos sem sofrer gols no Brasileirão', () => {
    const metrics = (cleanSheets: number) => ({ ...entry({}), metrics: { cleanSheets } as SeasonEntry['metrics'] }).metrics;
    expect(unlocked('temporada', { season: entry({ metrics: metrics(20) }) })).toContain('paredao');
    expect(unlocked('temporada', { season: entry({ metrics: metrics(19) }) })).not.toContain('paredao');
  });

  it('Dono do Clássico: vence todos os clássicos (pelo menos dois)', () => {
    const w1 = match({ score: [2, 0] });
    const w2 = match({ home: 't1', away: USER_ID, score: [0, 1] });
    const other = match({ away: 't2', awayName: 'Bahia', score: [0, 3] });
    expect(unlocked('temporada', { season: entry({}), details: details({ matches: [w1, w2, other] }) })).toContain('dono-do-classico');
    const draw = match({ home: 't1', away: USER_ID, score: [1, 1] });
    expect(unlocked('temporada', { season: entry({}), details: details({ matches: [w1, draw] }) })).not.toContain('dono-do-classico');
    expect(unlocked('temporada', { season: entry({}), details: details({ matches: [w1] }) })).not.toContain('dono-do-classico');
  });
});

describe('conquistas novas: carreira', () => {
  it('Dinastia: três títulos brasileiros seguidos', () => {
    const s = (n: number, champion: boolean) => entry({ runId: `s${n}`, champion, finishedAt: at(n) });
    expect(unlocked('temporada', { season: s(3, true), previous: [s(1, true), s(2, true)] })).toContain('dinastia');
    expect(unlocked('temporada', { season: s(4, true), previous: [s(1, true), s(2, false), s(3, true)] })).not.toContain('dinastia');
  });

  it('Volta ao Mundo das Eras: campeão na Era Única com as 8 décadas', () => {
    const eras = DECADES.map((d, i) => entry({ runId: `e${i}`, mode: 'era', fixedDecade: d, champion: true, finishedAt: at(i + 1) }));
    expect(unlocked('temporada', { season: eras[7], previous: eras.slice(0, 7) })).toContain('volta-ao-mundo-das-eras');
    expect(unlocked('temporada', { season: eras[6], previous: eras.slice(0, 6) })).not.toContain('volta-ao-mundo-das-eras');
  });

  it('Rodando o Brasil: campeão brasileiro com 10 clubes diferentes', () => {
    const clubs = ['santos', 'flamengo', 'vasco', 'gremio', 'bahia', 'sport', 'ceara', 'goias', 'coritiba', 'nautico'];
    const titles: TitleRecord[] = clubs.map((c, i) => ({
      id: `r${i}:brasileirao`,
      competitionId: 'brasileirao',
      competitionName: 'Brasileirão',
      runId: `r${i}`,
      clubId: c,
      teamName: c,
      decades: [],
      fixedDecade: null,
      formationId: '4-3-3',
      wonAt: at(i + 1),
    }));
    expect(unlocked('titulo', { titles })).toContain('rodando-o-brasil');
    expect(unlocked('titulo', { titles: titles.slice(1) })).not.toContain('rodando-o-brasil');
  });

  it('Colecionador: 100 jogadores diferentes escalados', () => {
    const seasons = Array.from({ length: 9 }, (_, i) =>
      entry({ runId: `c${i}`, finishedAt: at(i + 1), metrics: { persons: Array.from({ length: 11 }, (_, j) => `p${i * 11 + j}`) } as SeasonEntry['metrics'] }),
    );
    // 9 × 11 = 99 + 1 jogador novo nesta temporada = 100
    const last = details({ lineup: lineup((i) => ({ personId: i === 0 ? 'novo' : `p${i}` })) });
    expect(unlocked('temporada', { season: entry({ runId: 'c9', finishedAt: at(20) }), previous: seasons, details: last })).toContain('colecionador');
    expect(unlocked('temporada', { season: entry({ runId: 'c9', finishedAt: at(20) }), previous: seasons, details: details() })).not.toContain('colecionador');
  });

  it('Fiel ao Desafio: 7 Desafios Diários em dias seguidos', () => {
    const daily = (day: number) =>
      entry({ runId: `d${day}`, mode: 'diario', challengeLabel: `Desafio Diário · ${String(day).padStart(2, '0')}/11/2026`, finishedAt: at(day) });
    const week = [1, 2, 3, 4, 5, 6, 7].map(daily);
    expect(unlocked('temporada', { season: week[6], previous: week.slice(0, 6) })).toContain('fiel-ao-desafio');
    const gap = [1, 2, 3, 5, 6, 7, 8].map(daily);
    expect(unlocked('temporada', { season: gap[6], previous: gap.slice(0, 6) })).not.toContain('fiel-ao-desafio');
  });

  it('Top 10 do 11BRL: só entre os 10 primeiros do ranking global', () => {
    expect(rankingReached(EMPTY_HISTORY, { position: 7, runId: 'r' }, at(1)).newUnlocks.map((u) => u.id)).toEqual(['top-10-11brl']);
    expect(rankingReached(EMPTY_HISTORY, { position: 11, runId: 'r' }, at(1)).newUnlocks).toEqual([]);
  });
});

describe('conquistas retroativas', () => {
  const s1 = entry({ runId: 'a', finishedAt: at(3), champion: true, squadOverall: 79 });
  const s2 = entry({ runId: 'b', finishedAt: at(5), metrics: { cleanSheets: 22 } as SeasonEntry['metrics'] });
  const s3 = entry({ runId: 'c', finishedAt: at(7), status: 'abandoned', champion: true, squadOverall: 70 });
  const four = match({ score: [4, 0], goals: [1, 2, 3, 4].map((m) => goal('home', 'Artilheiro', m * 10)) });
  const det: Record<string, SeasonDetails> = { b: details({ matches: [four] }) };
  const data: HistoryData = { seasons: [s1, s2, s3], titles: [], unlocks: [] };

  it('dá as conquistas novas com a data da temporada em que foram cumpridas', () => {
    const got = retroactiveUnlocks(data, (id) => det[id] ?? null, at(30));
    const byId = Object.fromEntries(got.map((u) => [u.id, u]));
    expect(Object.keys(byId).sort()).toEqual(['azarao', 'paredao', 'poquer']);
    expect(byId.azarao.runId).toBe('a');
    expect(byId.azarao.unlockedAt).toBe(at(3));
    expect(byId.poquer.runId).toBe('b');
    expect(byId.paredao.unlockedAt).toBe(at(5));
  });

  it('não repete o que já foi desbloqueado nem considera temporadas não finalizadas', () => {
    const with1 = { ...data, unlocks: [{ id: 'azarao', name: 'Azarão', tier: 'ouro' as const, unlockedAt: at(4), runId: 'a', value: 79, detail: null }] };
    const got = retroactiveUnlocks(with1, (id) => det[id] ?? null, at(30)).map((u) => u.id);
    expect(got).not.toContain('azarao');
    expect(got.sort()).toEqual(['paredao', 'poquer']);
    // sem os detalhes, só o que dá para saber pela lista de temporadas
    expect(retroactiveUnlocks(data, () => null, at(30)).map((u) => u.id).sort()).toEqual(['azarao', 'paredao']);
  });

  it('não dá conquistas antigas (só as criadas depois)', () => {
    const perfect = entry({ runId: 'p', perfect: true, champion: true, finishedAt: at(2) });
    const got = retroactiveUnlocks({ seasons: [perfect], titles: [], unlocks: [] }, () => null, at(30)).map((u) => u.id);
    expect(got).not.toContain('temporada-perfeita');
  });
});
