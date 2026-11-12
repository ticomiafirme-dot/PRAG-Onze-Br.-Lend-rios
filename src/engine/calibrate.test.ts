import { it } from 'vitest';
import { db, LEAGUE_CLUBS } from '../data/db';
import { createDraft, isDraftComplete, pick, slotsWithOffers, checkPick, reroll } from './draft';
import { buildSheet, type Difficulty } from './team';
import { createCampaign, simulateRest, summarize, USER_ID } from './campaign';
import { topScorers } from './league';
import type { Card } from '../data/types';

// Draft "bom": em cada rodada escolhe o melhor jogador disponível; usa rerolls se a melhor oferta for fraca.
function goodDraft(clubId: string, seed: number, quality: 'top' | 'mid') {
  let st = createDraft(db, { mode: 'classico', clubId, decade: null, formationId: '4-3-3', seed, rerolls: 5 });
  while (!isDraftComplete(st)) {
    let best: { key: string; slot: string; ovr: number } | null = null;
    for (const s of slotsWithOffers(st)) for (const k of st.draw!.offers[s.id]) {
      const c = db.card(k);
      if (checkPick(db, st, k, s.id).ok && (!best || c.overall > best.ovr)) best = { key: k, slot: s.id, ovr: c.overall };
    }
    if (quality === 'top' && best && best.ovr < 86 && st.rerollsLeft > 0) { st = reroll(db, st); continue; }
    st = pick(db, st, best!.key, best!.slot);
  }
  const lineup: Record<string, Card> = Object.fromEntries(Object.entries(st.picks).map(([s, k]) => [s, db.card(k)]));
  const cap = Object.entries(lineup).sort((a, b) => b[1].overall - a[1].overall)[0][0];
  return buildSheet(db, { id: USER_ID, name: 'U', label: '', clubId, short: 'USR', colors: { primary: '#000', secondary: '#fff', accent: '#fff' }, formationId: '4-3-3', lineup, captainSlot: cap, isUser: true });
}

// Execução manual: CALIBRATE=1 npx vitest run src/engine/calibrate.test.ts
const ENABLED = !!(globalThis as { process?: { env?: Record<string, string> } }).process?.env?.CALIBRATE;

it.skipIf(!ENABLED)('calibragem de dificuldade (Monte Carlo)', () => {
  for (const diff of ['normal', 'dificil', 'lendario'] as Difficulty[]) {
    for (const q of ['top', 'mid'] as const) {
      let leagueGoals = 0, leagueGames = 0, draws = 0, topGoals = 0;
      let perfect = 0, champ = 0, pts = 0, wins = 0, losses = 0, ovr = 0, chem = 0, gf = 0, ga = 0; const N = 120;
      for (let i = 0; i < N; i++) {
        const club = LEAGUE_CLUBS[i % 6].id;
        const user = goodDraft(club, 1000 + i, q);
        ovr += user.ratings.overall; chem += user.chem;
        const camp = simulateRest(createCampaign({ db, mode: 'classico', difficulty: diff, seed: 5000 + i, user, userClubId: club, leagueClubs: LEAGUE_CLUBS, triple: false }));
        const s = summarize(camp);
        const ai = camp.results.filter((m) => m.home !== USER_ID && m.away !== USER_ID);
        leagueGoals += ai.reduce((a, m) => a + m.score[0] + m.score[1], 0); leagueGames += ai.length;
        draws += ai.filter((m) => m.score[0] === m.score[1]).length;
        const top = topScorers(camp.results.filter((m) => m.comp === 'brasileirao'))[0];
        topGoals += top?.goals ?? 0;
        if (s.perfect) perfect++; if (s.champion) champ++; pts += s.points; wins += s.wins; losses += s.losses; gf += s.gf; ga += s.ga;
      }
      console.log(`${diff}/${q}: ovr ${(ovr/N).toFixed(1)} chem ${(chem/N).toFixed(0)} | pts ${(pts/N).toFixed(1)} V ${(wins/N).toFixed(1)} D ${(losses/N).toFixed(1)} gols ${(gf/N).toFixed(0)}-${(ga/N).toFixed(0)} | campeão ${(100*champ/N).toFixed(0)}% | perfeita ${(100*perfect/N).toFixed(1)}% | liga: ${(leagueGoals/leagueGames).toFixed(2)} gols/jogo, empates ${(100*draws/leagueGames).toFixed(0)}% | artilheiro ${(topGoals/N).toFixed(0)}`);
    }
  }
  // força média dos rivais
  const camp = createCampaign({ db, mode: 'classico', difficulty: 'normal', seed: 1, user: goodDraft('flamengo', 1, 'mid'), userClubId: 'flamengo', leagueClubs: LEAGUE_CLUBS, triple: false });
  console.log(Object.values(camp.teams).filter(t=>!t.isUser).map(t => `${t.short}(${t.label}) ${t.ratings.overall} A${t.ratings.attack} M${t.ratings.midfield} D${t.ratings.defense}`).join(' | '));
}, 600000);
