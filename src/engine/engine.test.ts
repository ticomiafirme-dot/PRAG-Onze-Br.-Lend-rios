import { describe, expect, it } from 'vitest';
import { db, LEAGUE_CLUBS } from '../data/db';
import { CLUBS } from '../data/clubs';
import { FORMATIONS, getFormation, type FormationId } from '../data/formations';
import { allOffers, createDraft, firstOpenSlot, isDraftComplete, openSlots, pick, reroll, slotsWithOffers, checkPick, feasibleFormationsForClub, type DraftState, type GameMode } from './draft';
import { canPlay, positionsOf } from './database';
import { formationCounts } from '../data/formations';
import { computeChemistry } from './chemistry';
import { buildSheet } from './team';
import { createCampaign, playDay, simulateRest, summarize, leagueStandings, USER_ID } from './campaign';
import { Rng } from './rng';
import { POSITIONS, ROLE_CATEGORY, type Card, type Decade, type Position } from '../data/types';

function autoDraft(clubId: string | null, formationId: FormationId, seed: number, mode: GameMode = 'classico', decade: Decade | null = null): DraftState {
  let st = createDraft(db, { mode, clubId, decade, formationId, seed, rerolls: 5 });
  const rng = new Rng(seed + 1);
  let guard = 0;
  while (!isDraftComplete(st) && guard++ < 40) {
    const slots = slotsWithOffers(st);
    if (slots.length === 0) {
      st = reroll(db, st);
      continue;
    }
    const slot = rng.pick(slots);
    const offers = st.draw!.offers[slot.pos]!;
    const key = offers[0];
    const ok = checkPick(db, st, key, slot.id);
    expect(ok.ok).toBe(true);
    st = pick(db, st, key, slot.id);
  }
  return st;
}

describe('base de dados', () => {
  it('tem pelo menos 20 clubes e jogadores em todas as décadas oferecidas', () => {
    expect(LEAGUE_CLUBS.length).toBe(20);
    for (const c of CLUBS) {
      for (const d of c.decades) expect(db.cards(c.id, d).length, `${c.id} ${d}`).toBeGreaterThanOrEqual(12);
    }
  });

  it('cada jogador pertence a ao menos uma das 4 categorias; a principal vem da função histórica', () => {
    for (const c of CLUBS) {
      for (const p of db.playersByClub.get(c.id)!) {
        const cats = positionsOf(p);
        expect(cats.length).toBeGreaterThanOrEqual(1);
        expect(cats[0]).toBe(ROLE_CATEGORY[p.position]);
        for (const cat of cats) expect(POSITIONS).toContain(cat);
      }
    }
  });

  it('notas entre 1 e 99 e posições válidas', () => {
    for (const c of CLUBS) {
      for (const p of db.playersByClub.get(c.id)!) {
        for (const v of Object.values(p.eras)) {
          expect(v).toBeGreaterThanOrEqual(1);
          expect(v).toBeLessThanOrEqual(99);
        }
        expect(p.source).toMatch(/^https:\/\/(pt|en)\.wikipedia\.org\/wiki\//);
      }
    }
  });

  it('todas as formações são viáveis no modo clássico para todos os clubes', () => {
    for (const c of CLUBS) {
      const ok = feasibleFormationsForClub(db, c.id, FORMATIONS.map((f) => f.id));
      expect(ok.length, c.id).toBe(FORMATIONS.length);
    }
  });
});

describe('draft', () => {
  it('completa 11 jogadores distintos em posições válidas (todas as formações, vários clubes)', () => {
    let seed = 1;
    for (const c of CLUBS) {
      for (const f of FORMATIONS) {
        const st = autoDraft(c.id, f.id, seed++);
        expect(isDraftComplete(st), `${c.id} ${f.id}`).toBe(true);
        const cards = Object.values(st.picks).map((k) => db.card(k));
        expect(new Set(cards.map((x) => x.id)).size).toBe(11);
        for (const s of getFormation(f.id).slots) {
          const card = db.card(st.picks[s.id]);
          expect(positionsOf(card.player)).toContain(s.pos);
          expect(card.club).toBe(c.id);
        }
      }
    }
  });

  it('novos sorteios são limitados a 5 e não repetem a mesma década quando há alternativa', () => {
    let st = createDraft(db, { mode: 'classico', clubId: 'corinthians', decade: null, formationId: '4-3-3', seed: 42, rerolls: 5 });
    for (let i = 0; i < 7; i++) {
      const before = st.draw!.decade;
      const next = reroll(db, st);
      if (st.rerollsLeft > 0) expect(next.draw!.decade).not.toBe(before);
      st = next;
    }
    expect(st.rerollsLeft).toBe(0);
  });

  it('modo Mistura sorteia clubes diferentes', () => {
    const st = autoDraft(null, '4-4-2', 7, 'mistura');
    const clubs = new Set(Object.values(st.picks).map((k) => db.card(k).club));
    expect(clubs.size).toBeGreaterThan(3);
  });

  it('modo Era Única usa só a década escolhida e oferece até 3 por categoria', () => {
    const st0 = createDraft(db, { mode: 'era', clubId: 'flamengo', decade: '1980s', formationId: '4-4-2', seed: 9, rerolls: 5 });
    for (const offers of Object.values(st0.draw!.offers)) expect(offers.length).toBeLessThanOrEqual(3);
    const st = autoDraft('flamengo', '4-4-2', 9, 'era', '1980s');
    expect(isDraftComplete(st)).toBe(true);
    for (const k of Object.values(st.picks)) expect(db.card(k).decade).toBe('1980s');
  });

  it('não permite escolher jogador fora da categoria', () => {
    let checked = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const st = createDraft(db, { mode: 'classico', clubId: 'santos', decade: null, formationId: '4-3-3', seed, rerolls: 5 });
      for (const [pos, keys] of Object.entries(st.draw!.offers) as [Position, string[]][]) {
        for (const key of keys) {
          const card = db.card(key);
          for (const slot of openSlots(st)) {
            if (slot.pos === pos || canPlay(card, slot.pos)) continue;
            expect(checkPick(db, st, key, slot.id).ok, `${key} em ${slot.id}`).toBe(false);
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('aba "Todos": cada jogador uma vez, do maior overall ao menor, entrando numa vaga da sua categoria', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const st = createDraft(db, { mode: 'classico', clubId: 'palmeiras', decade: null, formationId: '4-2-3-1', seed, rerolls: 5 });
      const list = allOffers(db, st);
      const total = new Set(Object.values(st.draw!.offers).flat()).size;
      expect(list.length).toBe(total);
      expect(new Set(list.map((o) => o.key)).size).toBe(list.length);
      for (let i = 1; i < list.length; i++) expect(db.card(list[i - 1].key).overall).toBeGreaterThanOrEqual(db.card(list[i].key).overall);
      for (const o of list) {
        expect(st.draw!.offers[o.pos]).toContain(o.key);
        expect(checkPick(db, st, o.key, firstOpenSlot(st, o.pos)!.id).ok).toBe(true);
      }
    }
  });

  it('qualquer jogador da categoria pode ocupar qualquer vaga daquela categoria', () => {
    for (const f of FORMATIONS) {
      for (let seed = 1; seed <= 6; seed++) {
        const st = createDraft(db, { mode: 'classico', clubId: 'flamengo', decade: null, formationId: f.id, seed, rerolls: 5 });
        for (const [pos, keys] of Object.entries(st.draw!.offers) as [Position, string[]][]) {
          const slots = openSlots(st).filter((s) => s.pos === pos);
          for (const key of keys.slice(0, 3)) for (const slot of slots) expect(checkPick(db, st, key, slot.id).ok, `${f.id} ${key} → ${slot.id}`).toBe(true);
        }
      }
    }
  });
});

describe('formações', () => {
  it('distribuição por categoria (GOL/DEF/MEI/ATA)', () => {
    const want: Record<FormationId, [number, number, number, number]> = {
      '4-3-3': [1, 4, 3, 3],
      '4-4-2': [1, 4, 4, 2],
      '4-2-3-1': [1, 4, 4, 2],
      '3-5-2': [1, 3, 5, 2],
      '3-4-3': [1, 3, 4, 3],
      '4-1-4-1': [1, 4, 5, 1],
    };
    for (const f of FORMATIONS) {
      const n = formationCounts(f);
      expect([n.GOL, n.DEF, n.MEI, n.ATA], f.id).toEqual(want[f.id]);
      expect(f.slots.length).toBe(11);
      // ligações de química só entre vagas existentes
      const ids = new Set(f.slots.map((s) => s.id));
      for (const [a, b] of f.links) expect(ids.has(a) && ids.has(b), `${f.id} ${a}-${b}`).toBe(true);
    }
  });
});

describe('química e capitão', () => {
  it('capitão recebe +3 e química fica entre 0 e 100', () => {
    const st = autoDraft('palmeiras', '4-3-3', 11);
    const lineup: Record<string, Card> = Object.fromEntries(Object.entries(st.picks).map(([s, k]) => [s, db.card(k)]));
    const chem = computeChemistry(db, '4-3-3', lineup, 'ca');
    expect(chem.team).toBeGreaterThanOrEqual(0);
    expect(chem.team).toBeLessThanOrEqual(100);
    const sheet = buildSheet(db, { id: USER_ID, name: 'T', label: '', clubId: 'palmeiras', short: 'PAL', colors: { primary: '#000', secondary: '#fff', accent: '#fff' }, formationId: '4-3-3', lineup, captainSlot: 'ca', isUser: true });
    const cap = sheet.players.find((p) => p.captain)!;
    expect(cap.eff).toBeGreaterThanOrEqual(cap.base + 3 - 2);
  });
});

describe('temporada', () => {
  it('Brasileirão: 20 times, 38 rodadas, cada um com 38 jogos e mandos alternados', () => {
    const st = autoDraft('corinthians', '4-3-3', 5);
    const lineup: Record<string, Card> = Object.fromEntries(Object.entries(st.picks).map(([s, k]) => [s, db.card(k)]));
    const user = buildSheet(db, { id: USER_ID, name: 'Corinthians', label: 'Seu time', clubId: 'corinthians', short: 'COR', colors: { primary: '#000', secondary: '#fff', accent: '#fff' }, formationId: '4-3-3', lineup, captainSlot: 'ca', isUser: true });
    let camp = createCampaign({ db, mode: 'classico', difficulty: 'normal', seed: 123, user, userClubId: 'corinthians', leagueClubs: LEAGUE_CLUBS, triple: false });
    expect(camp.league.teams.length).toBe(20);
    expect(camp.league.fixtures.length).toBe(38);
    camp = playDay(camp);
    expect(camp.results.length).toBe(10);
    camp = simulateRest(camp);
    expect(camp.finished).toBe(true);
    const table = leagueStandings(camp);
    for (const row of table) expect(row.p).toBe(38);
    const homeCount = camp.results.filter((m) => m.home === USER_ID).length;
    expect(homeCount).toBe(19);
    const s = summarize(camp);
    expect(s.wins + s.draws + s.losses).toBe(38);
  });

  it('Tríplice Coroa: estadual + copa + brasileirão terminam com campeões', () => {
    const st = autoDraft('cruzeiro', '4-4-2', 8);
    const lineup: Record<string, Card> = Object.fromEntries(Object.entries(st.picks).map(([s, k]) => [s, db.card(k)]));
    const user = buildSheet(db, { id: USER_ID, name: 'Cruzeiro', label: '', clubId: 'cruzeiro', short: 'CRU', colors: { primary: '#000', secondary: '#fff', accent: '#fff' }, formationId: '4-4-2', lineup, captainSlot: 'ca', isUser: true });
    const stateClubs = CLUBS.filter((c) => c.state === 'MG');
    let camp = createCampaign({ db, mode: 'triplice', difficulty: 'normal', seed: 77, user, userClubId: 'cruzeiro', leagueClubs: LEAGUE_CLUBS, triple: true, stateClubs, stateCupName: 'Campeonato Mineiro' });
    camp = simulateRest(camp);
    expect(camp.finished).toBe(true);
    expect(camp.copa?.champion).toBeTruthy();
    expect(camp.estadual?.champion).toBeTruthy();
  });
});
