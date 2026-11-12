import { useMemo, useState } from 'react';
import { useGame } from '../state/store';
import { COMP_NAMES, USER_ID, userPlayerStats, type Campaign, type CompId } from '../engine/campaign';
import { topScorers } from '../engine/league';
import { POSITION_NAMES, type Position } from '../data/types';
import { TeamName } from '../components/TeamBadge';
import { BackLink, NeedRun } from '../components/ui';

export function Stats() {
  const run = useGame((s) => s.run);
  return (
    <NeedRun ok={!!run?.campaign}>
      <StatsInner />
    </NeedRun>
  );
}

export function teamTotals(c: Campaign, comp?: CompId) {
  const ms = c.userMatches.filter((m) => !comp || m.comp === comp);
  let w = 0,
    d = 0,
    l = 0,
    gf = 0,
    ga = 0,
    shots = 0,
    onTarget = 0,
    poss = 0,
    cleanSheets = 0,
    yellow = 0,
    red = 0;
  let bestWin: { diff: number; label: string } | null = null;
  let streak = 0,
    bestStreak = 0,
    unbeaten = 0,
    bestUnbeaten = 0;
  for (const um of ms) {
    const side = um.home === USER_ID ? 'home' : 'away';
    const i = side === 'home' ? 0 : 1;
    const f = um.result.score[i];
    const a = um.result.score[1 - i];
    gf += f;
    ga += a;
    const st = um.result.stats[side];
    shots += st.shots;
    onTarget += st.onTarget;
    poss += st.possession;
    yellow += st.yellow;
    red += st.red;
    if (a === 0) cleanSheets++;
    if (f > a) {
      w++;
      streak++;
      unbeaten++;
      if (!bestWin || f - a > bestWin.diff) bestWin = { diff: f - a, label: `${c.teams[um.home].short} ${um.result.score[0]} × ${um.result.score[1]} ${c.teams[um.away].short}` };
    } else if (f === a) {
      d++;
      streak = 0;
      unbeaten++;
    } else {
      l++;
      streak = 0;
      unbeaten = 0;
    }
    bestStreak = Math.max(bestStreak, streak);
    bestUnbeaten = Math.max(bestUnbeaten, unbeaten);
  }
  const n = ms.length || 1;
  return { games: ms.length, w, d, l, gf, ga, shots, onTarget, poss: Math.round(poss / n), cleanSheets, yellow, red, bestWin, bestStreak, bestUnbeaten };
}

type SortKey = 'goals' | 'assists' | 'rating' | 'games' | 'mvps';

function StatsInner() {
  const run = useGame((s) => s.run)!;
  const c = run.campaign!;
  const [comp, setComp] = useState<CompId | 'all'>('brasileirao');
  const [sort, setSort] = useState<SortKey>('goals');
  const rows = useMemo(() => userPlayerStats(c, comp === 'all' ? undefined : comp).sort((a, b) => (b[sort] as number) - (a[sort] as number) || b.rating - a.rating), [c, comp, sort]);
  const totals = teamTotals(c, comp === 'all' ? undefined : comp);
  const league = topScorers(c.results.filter((m) => m.comp === 'brasileirao'));
  const comps: (CompId | 'all')[] = ['brasileirao', ...(c.estadual ? (['estadual'] as const) : []), ...(c.copa ? (['copa'] as const) : []), 'all'];
  const userTop = league.find((r) => r.team === USER_ID);
  const leagueTop = league[0];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Desempenho individual e coletivo</div>
          <h1>Estatísticas</h1>
        </div>
        <BackLink to={c.finished ? '/resultado' : '/campeonato'} />
      </div>

      <div className="tabs" style={{ marginBottom: 14 }}>
        {comps.map((k) => (
          <button key={k} className="tab" aria-selected={comp === k} onClick={() => setComp(k)}>
            {k === 'all' ? 'Todas' : k === 'estadual' ? (c.estadualName ?? 'Estadual') : COMP_NAMES[k]}
          </button>
        ))}
      </div>

      <div className="kpi-grid">
        <Kpi v={`${totals.w}-${totals.d}-${totals.l}`} k="V-E-D" />
        <Kpi v={`${totals.gf}`} k="Gols marcados" />
        <Kpi v={`${totals.ga}`} k="Gols sofridos" />
        <Kpi v={`${totals.poss}%`} k="Posse média" />
        <Kpi v={`${totals.shots}`} k="Finalizações" />
        <Kpi v={`${totals.cleanSheets}`} k="Jogos sem sofrer gol" />
        <Kpi v={`${totals.bestStreak}`} k="Maior sequência de vitórias" />
        <Kpi v={`${totals.bestUnbeaten}`} k="Maior invencibilidade" />
        <Kpi v={totals.bestWin?.label ?? '—'} k="Maior goleada" small />
        <Kpi v={`${totals.yellow} / ${totals.red}`} k="Amarelos / vermelhos" />
      </div>

      <section className="section">
        <h2 className="section-title">Elenco</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>#</th>
                <th className="l">Jogador</th>
                <th>Pos.</th>
                {(
                  [
                    ['games', 'J'],
                    ['goals', 'Gols'],
                    ['assists', 'Assist.'],
                    ['rating', 'Nota'],
                    ['mvps', 'Craque'],
                  ] as [SortKey, string][]
                ).map(([k, l]) => (
                  <th key={k}>
                    <button className={`th-sort ${sort === k ? 'on' : ''}`} onClick={() => setSort(k)}>
                      {l}
                    </button>
                  </th>
                ))}
                <th>🟨</th>
                <th>🟥</th>
                <th>Def.</th>
                <th>SG</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.personId}>
                  <td>{r.number}</td>
                  <td className="l">
                    <strong>{r.name}</strong>
                  </td>
                  <td title={POSITION_NAMES[r.pos as Position]}>{r.pos}</td>
                  <td>{r.games}</td>
                  <td className="stat-num">{r.goals}</td>
                  <td>{r.assists}</td>
                  <td className={`rating ${r.rating >= 7.5 ? 'hi' : r.rating < 6 && r.games ? 'lo' : ''}`}>{r.games ? r.rating.toFixed(2) : '—'}</td>
                  <td>{r.mvps}</td>
                  <td>{r.yellow}</td>
                  <td>{r.red}</td>
                  <td>{r.pos === 'GOL' ? r.saves : '—'}</td>
                  <td>{['GOL', 'ZAG', 'LD', 'LE'].includes(r.pos) ? r.cleanSheets : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="dim" style={{ fontSize: 13, marginTop: 8 }}>
          Nota: média das notas por partida (0 a 10). SG: jogos sem sofrer gols. Def.: defesas do goleiro.
        </p>
      </section>

      <section className="section">
        <h2 className="section-title">Artilharia do Brasileirão</h2>
        {leagueTop ? (
          <p className="muted" style={{ marginBottom: 10 }}>
            Líder: <strong>{leagueTop.name}</strong> ({c.teams[leagueTop.team].short}) com {leagueTop.goals} gols.
            {userTop && userTop !== leagueTop && (
              <>
                {' '}
                Seu artilheiro: <strong>{userTop.name}</strong>, {userTop.goals} gols.
              </>
            )}
          </p>
        ) : (
          <p className="dim">Sem gols ainda.</p>
        )}
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>#</th>
                <th className="l">Jogador</th>
                <th className="l">Time</th>
                <th>Gols</th>
                <th>Assist.</th>
              </tr>
            </thead>
            <tbody>
              {league.slice(0, 15).map((r, i) => (
                <tr key={r.team + r.personId} className={r.team === USER_ID ? 'me' : ''}>
                  <td>{i + 1}</td>
                  <td className="l">{r.name}</td>
                  <td className="l">
                    <TeamName team={c.teams[r.team]} short />
                  </td>
                  <td className="stat-num">{r.goals}</td>
                  <td>{r.assists}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ v, k, small }: { v: string; k: string; small?: boolean }) {
  return (
    <div className="kpi">
      <span className={`v ${small ? 'v-small' : ''}`}>{v}</span>
      <span className="k">{k}</span>
    </div>
  );
}
