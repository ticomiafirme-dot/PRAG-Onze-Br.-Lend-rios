import { describe, expect, it } from 'vitest';
import { db, LEAGUE_CLUBS } from '../data/db';
import { CLUBS } from '../data/clubs';
import type { Card } from '../data/types';
import { createDraft, isDraftComplete, pick, slotsWithOffers } from '../engine/draft';
import { buildSheet, type Difficulty } from '../engine/team';
import { createCampaign, simulateRest, summarize, USER_ID } from '../engine/campaign';
import type { Run } from '../state/store';
import { buildSeasonRecord } from './record';
import { ACHIEVEMENT_DEFS, evaluateAchievements } from './achievements';
import { COMPETITIONS } from './competitions';
import { EMPTY_HISTORY, mergeHistory, seasonAbandoned, seasonFinished, seasonStarted, squadReady, titlesWon, type HistoryData } from './engine';
import { careerStats, greatCampaigns, personalRecords } from './records';
import type { SeasonEntry, TitleRecord } from './types';

/** Temporada real: draft automático (melhor oferta) e campanha simulada. */
function playRun(opts: { id: string; clubId: string; seed: number; difficulty?: Difficulty; triple?: boolean; finish?: boolean }): Run {
  let st = createDraft(db, { mode: opts.triple ? 'triplice' : 'classico', clubId: opts.clubId, decade: null, formationId: '4-3-3', seed: opts.seed, rerolls: 5 });
  while (!isDraftComplete(st)) {
    const s = slotsWithOffers(st)[0];
    st = pick(db, st, st.draw!.offers[s.pos]![0], s.id);
  }
  const lineup: Record<string, Card> = Object.fromEntries(Object.entries(st.picks).map(([s, k]) => [s, db.card(k)]));
  const club = CLUBS.find((c) => c.id === opts.clubId)!;
  const user = buildSheet(db, { id: USER_ID, name: club.name, label: 'Seu time', clubId: club.id, short: club.short, colors: club.colors, formationId: '4-3-3', lineup, captainSlot: 'ca', isUser: true });
  let campaign = createCampaign({
    db,
    mode: opts.triple ? 'triplice' : 'classico',
    difficulty: opts.difficulty ?? 'normal',
    seed: opts.seed,
    user,
    userClubId: club.id,
    leagueClubs: LEAGUE_CLUBS.filter((c) => c.id !== club.id).slice(0, 19),
    triple: !!opts.triple,
    stateClubs: opts.triple ? CLUBS.filter((c) => c.state === club.state) : [],
    stateCupName: club.stateCup,
  });
  if (opts.finish !== false) campaign = simulateRest(campaign);
  return {
    id: opts.id,
    mode: opts.triple ? 'triplice' : 'classico',
    clubId: club.id,
    decade: null,
    formationId: '4-3-3',
    difficulty: opts.difficulty ?? 'normal',
    seed: opts.seed,
    challenge: null,
    draft: st,
    captainSlot: 'ca',
    campaign,
    phase: campaign.finished ? 'finished' : 'season',
    createdAt: '2026-01-01T00:00:00.000Z',
    rankingSaved: false,
  };
}

const at = (d: number) => new Date(Date.UTC(2026, 0, d)).toISOString();

function entry(over: Partial<SeasonEntry>): SeasonEntry {
  return {
    runId: 'x',
    status: 'finished',
    mode: 'classico',
    modeLabel: 'Clássico',
    challengeLabel: null,
    clubId: 'santos',
    teamName: 'Santos',
    teamShort: 'SAN',
    colors: { primary: '#000', secondary: '#fff', accent: '#fff' },
    decades: ['1960s'],
    fixedDecade: null,
    formationId: '4-3-3',
    difficulty: 'normal',
    startedAt: at(1),
    finishedAt: at(2),
    played: 38,
    position: 1,
    points: 100,
    wins: 32,
    draws: 4,
    losses: 2,
    goalsFor: 100,
    goalsAgainst: 20,
    squadOverall: 88,
    teamOverall: 88,
    chemistry: 70,
    captainName: 'Pelé',
    champion: true,
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

describe('registro da temporada', () => {
  const run = playRun({ id: 'r1', clubId: 'santos', seed: 11 });
  const rec = buildSeasonRecord(run, 'finished', at(5))!;

  it('copia os números reais da campanha', () => {
    const s = summarize(run.campaign!);
    expect([rec.wins, rec.draws, rec.losses, rec.points, rec.goalsFor, rec.goalsAgainst, rec.position]).toEqual([s.wins, s.draws, s.losses, s.points, s.gf, s.ga, s.position]);
    expect(rec.played).toBe(38);
    expect(rec.details!.lineup).toHaveLength(11);
    expect(rec.details!.standings).toHaveLength(20);
    expect(rec.details!.matches.filter((m) => m.comp === 'brasileirao')).toHaveLength(38);
    expect(rec.details!.sequence).toHaveLength(38);
    expect(rec.captainName).toBe(run.campaign!.teams[USER_ID].players.find((p) => p.captain)!.name);
  });

  it('métricas coerentes com os jogos', () => {
    const m = rec.metrics!;
    expect(m.efficiency).toBeCloseTo((rec.points / 114) * 100, 0);
    expect(m.winStreak).toBeLessThanOrEqual(rec.wins);
    expect(m.unbeatenStreak).toBeGreaterThanOrEqual(m.winStreak);
    expect(m.cleanSheetStreak).toBeLessThanOrEqual(m.cleanSheets);
    expect(Object.values(m.decadeCounts).reduce((a, b) => a + b!, 0)).toBe(11);
    const goalsInMatches = rec.details!.matches.filter((x) => x.comp === 'brasileirao').reduce((a, x) => a + (x.home === USER_ID ? x.score[0] : x.score[1]), 0);
    expect(goalsInMatches).toBe(rec.goalsFor);
    expect(rec.squadOverall).toBeGreaterThan(60);
  });
});

describe('conquistas, títulos e recordes', () => {
  it('primeira temporada: estreia e títulos; recordes de gols só a partir da segunda', () => {
    const r1 = buildSeasonRecord(playRun({ id: 'a', clubId: 'flamengo', seed: 3 }), 'finished', at(3))!;
    let h: HistoryData = seasonStarted(EMPTY_HISTORY, r1).data;
    const u1 = seasonFinished(h, r1, at(3));
    h = u1.data;
    const ids1 = u1.newUnlocks.map((u) => u.id);
    expect(ids1).toContain('estreia');
    expect(ids1).not.toContain('muralha');
    expect(ids1).not.toContain('artilheiro');
    if (r1.champion) {
      expect(ids1).toContain('campeao-brasileiro');
      expect(h.titles.map((t) => t.competitionId)).toContain('brasileirao');
    }
    expect(h.seasons.find((s) => s.runId === 'a')!.status).toBe('finished');
    expect(h.seasons.find((s) => s.runId === 'a')!.achievements).toEqual(expect.arrayContaining(ids1));

    // segunda temporada sintética: mais gols e menos gols sofridos que a primeira
    const r2 = { ...r1, runId: 'b', goalsFor: r1.goalsFor + 5, goalsAgainst: Math.max(0, r1.goalsAgainst - 1), startedAt: at(4) };
    const u2 = seasonFinished(h, r2, at(4));
    const art = u2.newUnlocks.find((u) => u.id === 'artilheiro');
    expect(art?.value).toBe(r1.goalsFor + 5);
    expect(art?.runId).toBe('b');
    if (r1.goalsAgainst > 0) expect(u2.newUnlocks.find((u) => u.id === 'muralha')?.value).toBe(r1.goalsAgainst - 1);
    expect(u2.records.map((r) => r.id)).toContain('gols');
    expect(u2.newUnlocks.map((u) => u.id)).not.toContain('estreia'); // sem duplicar
    h = u2.data;

    // terceira com mais gols ainda: recorde muda, conquista não se repete
    const r3 = { ...r1, runId: 'c', goalsFor: r1.goalsFor + 9, startedAt: at(5) };
    const u3 = seasonFinished(h, r3, at(5));
    expect(u3.newUnlocks.map((u) => u.id)).not.toContain('artilheiro');
    const rec = personalRecords(u3.data.seasons).find((r) => r.id === 'gols')!;
    expect(rec.raw).toBe(r1.goalsFor + 9);
    expect(rec.season!.runId).toBe('c');
    expect(u3.data.unlocks.filter((u) => u.id === 'artilheiro')).toHaveLength(1);
  });

  it('temporada finalizada é permanente: não é sobrescrita', () => {
    const r1 = buildSeasonRecord(playRun({ id: 'p', clubId: 'gremio', seed: 5 }), 'finished', at(2))!;
    const h = seasonFinished(EMPTY_HISTORY, r1, at(2)).data;
    const again = seasonFinished(h, { ...r1, points: 0, wins: 0 }, at(9));
    expect(again.data).toBe(h);
    expect(seasonAbandoned(h, r1).data).toBe(h);
  });

  it('temporada abandonada fica no histórico e não dá conquistas de temporada', () => {
    const run = playRun({ id: 'ab', clubId: 'bahia', seed: 8, finish: false });
    const rec = buildSeasonRecord(run, 'abandoned', at(3))!;
    const h = seasonAbandoned(EMPTY_HISTORY, rec).data;
    expect(h.seasons[0].status).toBe('abandoned');
    expect(h.unlocks).toHaveLength(0);
  });

  it('Lendas Reunidas: elenco com overall médio 90+', () => {
    expect(squadReady(EMPTY_HISTORY, { runId: 'x', overall: 89, chemistry: null }, at(1)).newUnlocks).toHaveLength(0);
    const u = squadReady(EMPTY_HISTORY, { runId: 'x', overall: 90, chemistry: null }, at(1));
    expect(u.newUnlocks.map((x) => x.id)).toEqual(['lendas-reunidas']);
    expect(u.newUnlocks[0].value).toBe(90);
    expect(squadReady(u.data, { runId: 'y', overall: 95, chemistry: null }, at(2)).newUnlocks).toHaveLength(0);
  });

  it('Temporada Perfeita e Invencível', () => {
    const perfect = entry({ runId: 'pf', wins: 38, draws: 0, losses: 0, points: 114, perfect: true, unbeaten: true, metrics: { ...emptyMetrics(), lossesAll: 0 } });
    const ids = evaluateAchievements({ trigger: 'temporada', season: perfect, previous: [], titles: [] }, [], at(1)).map((u) => u.id);
    expect(ids).toEqual(expect.arrayContaining(['temporada-perfeita', 'invencivel']));
    const drawn = entry({ runId: 'dr', wins: 30, draws: 8, losses: 0, metrics: { ...emptyMetrics(), lossesAll: 0 } });
    const ids2 = evaluateAchievements({ trigger: 'temporada', season: drawn, previous: [], titles: [] }, [], at(1)).map((u) => u.id);
    expect(ids2).toContain('invencivel');
    expect(ids2).not.toContain('temporada-perfeita');
    // derrota numa copa (Tríplice) impede o Invencível
    const cupLoss = entry({ runId: 'cl', losses: 0, metrics: { ...emptyMetrics(), lossesAll: 1 } });
    expect(evaluateAchievements({ trigger: 'temporada', season: cupLoss, previous: [], titles: [] }, [], at(1)).map((u) => u.id)).not.toContain('invencivel');
  });

  it('Rei do Brasil: todas as competições do catálogo', () => {
    const title = (competitionId: string, i: number): TitleRecord => ({
      id: `r${i}:${competitionId}`,
      competitionId,
      competitionName: competitionId,
      runId: `r${i}`,
      clubId: 'santos',
      teamName: 'Santos',
      decades: ['1960s'],
      fixedDecade: null,
      formationId: '4-3-3',
      wonAt: at(i + 1),
    });
    const all = COMPETITIONS.map((c, i) => title(c.id, i));
    const partial = titlesWon(EMPTY_HISTORY, all.slice(0, -1), at(20));
    expect(partial.newUnlocks.map((u) => u.id)).not.toContain('rei-do-brasil');
    const progress = ACHIEVEMENT_DEFS.find((d) => d.id === 'rei-do-brasil')!.progress!({ finished: [], titles: partial.data.titles });
    expect(progress!.current).toBe(COMPETITIONS.length - 1);
    const full = titlesWon(partial.data, all.slice(-1), at(21));
    expect(full.newUnlocks.map((u) => u.id)).toContain('rei-do-brasil');
    expect(full.newUnlocks.find((u) => u.id === 'rei-do-brasil')!.tier).toBe('lendaria');
    // repetir o título não duplica
    expect(titlesWon(full.data, all, at(22)).newTitles).toHaveLength(0);
  });

  it('Tríplice Coroa real registra os títulos de estadual e copa', () => {
    const run = playRun({ id: 'tc', clubId: 'cruzeiro', seed: 21, triple: true });
    const rec = buildSeasonRecord(run, 'finished', at(6))!;
    const u = seasonFinished(EMPTY_HISTORY, rec, at(6));
    const comps = u.data.titles.map((t) => t.competitionId);
    expect(comps.includes('copa-do-brasil')).toBe(rec.copaChampion);
    expect(comps.includes('estadual-mg')).toBe(rec.estadualChampion);
    expect(comps.includes('brasileirao')).toBe(rec.champion);
  });

  it('recordes: empate mantém a temporada mais antiga; mais utilizados por contagem', () => {
    const s1 = entry({ runId: 's1', points: 100, finishedAt: at(2), clubId: 'santos' });
    const s2 = entry({ runId: 's2', points: 100, finishedAt: at(3), clubId: 'flamengo' });
    const s3 = entry({ runId: 's3', points: 90, finishedAt: at(4), clubId: 'flamengo', formationId: '4-4-2' });
    const recs = personalRecords([s3, s2, s1]);
    expect(recs.find((r) => r.id === 'pontos')!.season!.runId).toBe('s1');
    expect(recs.find((r) => r.id === 'clube')!.value).toBe('Flamengo');
    expect(recs.find((r) => r.id === 'formacao')!.value).toBe('4-3-3');
    const career = careerStats([s1, s2, s3], []);
    expect(career.seasonsFinished).toBe(3);
    expect(career.wins).toBe(96);
    expect(greatCampaigns([s1, s2, s3])[0].season.runId).toBe('s1');
  });

  it('juntar históricos (aparelho + nuvem) não duplica e preserva o mais antigo', () => {
    const a: HistoryData = {
      seasons: [entry({ runId: 'm1', status: 'in_progress' })],
      titles: [],
      unlocks: [{ id: 'estreia', name: 'Estreia', tier: 'bronze', unlockedAt: at(5), runId: 'm1', value: null, detail: null }],
    };
    const b: HistoryData = {
      seasons: [entry({ runId: 'm1', status: 'finished' }), entry({ runId: 'm2' })],
      titles: [],
      unlocks: [{ id: 'estreia', name: 'Estreia', tier: 'bronze', unlockedAt: at(3), runId: 'm0', value: null, detail: null }],
    };
    const m = mergeHistory(a, b);
    expect(m.seasons).toHaveLength(2);
    expect(m.seasons.find((s) => s.runId === 'm1')!.status).toBe('finished');
    expect(m.unlocks).toHaveLength(1);
    expect(m.unlocks[0].unlockedAt).toBe(at(3));
  });
});

function emptyMetrics() {
  return {
    efficiency: 0,
    winStreak: 0,
    unbeatenStreak: 0,
    cleanSheets: 0,
    cleanSheetStreak: 0,
    biggestWin: null,
    mostGoalsMatch: null,
    topScorer: null,
    bestCard: null,
    lossesAll: 0,
    decadeCounts: {},
  };
}
