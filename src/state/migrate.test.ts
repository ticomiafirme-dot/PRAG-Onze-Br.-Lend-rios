import { describe, expect, it } from 'vitest';
import { db } from '../data/db';
import { getFormation, type FormationId } from '../data/formations';
import { POSITIONS, type Card, type Role } from '../data/types';
import { canPlay, positionsOf } from '../engine/database';
import { createDraft, type DraftState } from '../engine/draft';
import { migratePersisted, migrateRunV2 } from './migrate';
import type { Run } from './store';

// Vagas das formações na versão 1 (posições detalhadas).
const V1_SLOTS: Record<string, [string, Role][]> = {
  '4-3-3': [['gol', 'GOL'], ['le', 'LE'], ['zag1', 'ZAG'], ['zag2', 'ZAG'], ['ld', 'LD'], ['vol', 'VOL'], ['mc', 'MC'], ['mei', 'MEI'], ['pe', 'PE'], ['ca', 'CA'], ['pd', 'PD']],
  '3-5-2': [['gol', 'GOL'], ['zag1', 'ZAG'], ['zag2', 'ZAG'], ['zag3', 'ZAG'], ['le', 'LE'], ['vol', 'VOL'], ['mc', 'MC'], ['mei', 'MEI'], ['ld', 'LD'], ['sa', 'SA'], ['ca', 'CA']],
};

/** Escalação "antiga": cada vaga com um jogador cuja função principal é a da vaga. */
function v1Lineup(clubId: string, formation: string, pureFullbacks: boolean): Record<string, Card> {
  const used = new Set<string>();
  const out: Record<string, Card> = {};
  const all = db.allCardsOfClub(clubId);
  for (const [slot, role] of V1_SLOTS[formation]) {
    const card = all.find(
      (c) => !used.has(c.id) && c.player.position === role && (!pureFullbacks || !['LE', 'LD'].includes(role) || positionsOf(c.player).length === 1),
    );
    if (!card) throw new Error(`sem ${role} no ${clubId}`);
    used.add(card.id);
    out[slot] = card;
  }
  return out;
}

function v1Run(formationId: FormationId, lineup: Record<string, Card>, phase: Run['phase'], captainSlot: string | null): Run {
  const base = createDraft(db, { mode: 'classico', clubId: 'flamengo', decade: null, formationId, seed: 5, rerolls: 5 });
  const picks = Object.fromEntries(Object.entries(lineup).map(([s, c]) => [s, c.key]));
  const draft: DraftState = {
    ...base,
    picks,
    draw: phase === 'draft' ? { round: Object.keys(picks).length + 1, clubId: 'flamengo', decade: '1980s', offers: { zag1: [], mc: [] } as never, fromReroll: false } : null,
    history: Object.entries(picks).map(([slotId, cardKey], i) => ({ round: i + 1, clubId: 'flamengo', decade: db.card(cardKey).decade, rerolls: 0, slotId, cardKey })),
  };
  return {
    id: 't',
    mode: 'classico',
    clubId: 'flamengo',
    decade: null,
    formationId,
    difficulty: 'normal',
    seed: 5,
    challenge: null,
    draft,
    captainSlot,
    campaign: null,
    phase,
    createdAt: '2026-01-01T00:00:00.000Z',
    rankingSaved: false,
  };
}

const validPicks = (run: Run) => {
  const slots = getFormation(run.formationId!).slots;
  for (const [slotId, key] of Object.entries(run.draft!.picks)) {
    const slot = slots.find((s) => s.id === slotId)!;
    expect(canPlay(db.card(key), slot.pos), `${key} em ${slotId}`).toBe(true);
  }
};

describe('migração v1 → v2 (posições em categorias)', () => {
  it('escalação 4-3-3 completa continua igual, com o mesmo capitão', () => {
    const lineup = v1Lineup('flamengo', '4-3-3', false);
    const run = migrateRunV2(v1Run('4-3-3', lineup, 'captain', 'ca'))!;
    expect(run.phase).toBe('captain');
    validPicks(run);
    expect(run.draft!.picks).toEqual(Object.fromEntries(Object.entries(lineup).map(([s, c]) => [s, c.key])));
    expect(run.captainSlot).toBe('ca');
  });

  it('3-5-2 com laterais nas alas (agora vagas de meio-campo): quem não cabe volta ao draft', () => {
    const lineup = v1Lineup('flamengo', '3-5-2', true);
    const capKey = lineup.le.key;
    const run = migrateRunV2(v1Run('3-5-2', lineup, 'preseason', 'le'))!;
    expect(run).not.toBeNull();
    validPicks(run);
    const kept = Object.values(run.draft!.picks);
    expect(kept.length).toBeLessThan(11);
    expect(run.phase).toBe('draft');
    expect(run.draft!.history.length).toBe(kept.length);
    // ofertas por categoria para as vagas reabertas
    expect(run.draft!.draw).not.toBeNull();
    for (const k of Object.keys(run.draft!.draw!.offers)) expect(POSITIONS).toContain(k);
    // capitão: segue o jogador, ou fica vago se ele saiu
    if (kept.includes(capKey)) expect(run.draft!.picks[run.captainSlot!]).toBe(capKey);
    else expect(run.captainSlot).toBeNull();
  });

  it('draft em andamento: ofertas antigas (por vaga) viram ofertas por categoria', () => {
    const full = v1Lineup('flamengo', '4-3-3', false);
    const partial = Object.fromEntries(Object.entries(full).slice(0, 5));
    const run = migrateRunV2(v1Run('4-3-3', partial, 'draft', null))!;
    expect(run.phase).toBe('draft');
    validPicks(run);
    const offers = run.draft!.draw!.offers;
    expect(Object.keys(offers).length).toBeGreaterThan(0);
    for (const [k, keys] of Object.entries(offers)) {
      expect(POSITIONS).toContain(k);
      for (const key of keys!) expect(canPlay(db.card(key), k as never)).toBe(true);
    }
    expect(run.draft!.draw!.clubId).toBe('flamengo');
    expect(run.draft!.draw!.decade).toBe('1980s');
  });

  it('temporada em andamento: fichas passam a usar categorias e mantêm a função antiga', () => {
    const lineup = v1Lineup('flamengo', '4-3-3', false);
    const run = v1Run('4-3-3', lineup, 'season', 'ca');
    const players = V1_SLOTS['4-3-3'].map(([slotId, role]) => ({ slotId, pos: role, cardKey: lineup[slotId].key, personId: lineup[slotId].id }));
    const campaign = {
      teams: { user: { players } },
      userMatches: [{ result: { players: { home: players.map((p) => ({ ...p })), away: [] } } }],
    };
    const migrated = migratePersisted({ run: { ...run, campaign } }, 1) as { run: Run };
    const sheet = migrated.run.campaign!.teams.user;
    expect(sheet.players.map((p) => p.pos)).toEqual(['GOL', 'DEF', 'DEF', 'DEF', 'DEF', 'MEI', 'MEI', 'MEI', 'ATA', 'ATA', 'ATA']);
    expect(sheet.players.map((p) => p.role)).toEqual(V1_SLOTS['4-3-3'].map(([, r]) => r));
    expect(migrated.run.campaign!.userMatches[0].result.players.home[1].pos).toBe('DEF');
    expect(migrated.run.phase).toBe('season');
  });

  it('estado já na versão 2 não é alterado', () => {
    const state = { run: null, settings: { speed: 1 } };
    expect(migratePersisted(state, 2)).toBe(state);
  });
});
