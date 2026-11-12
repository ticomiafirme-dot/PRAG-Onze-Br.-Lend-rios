import { useMemo, useState } from 'react';
import { navigate } from '../router';
import { useGame } from '../state/store';
import {
  COMP_NAMES,
  currentDay,
  leagueStandings,
  matchKey,
  USER_ID,
  userFixture,
  type Campaign,
} from '../engine/campaign';
import { topScorers, type PlayedMatch } from '../engine/league';
import { aggregate, type CupState } from '../engine/cup';
import { TeamCrest, TeamName } from '../components/TeamBadge';
import { Modal, NeedRun, OvrBadge, useToast } from '../components/ui';

export function Championship() {
  const run = useGame((s) => s.run);
  return (
    <NeedRun ok={!!run?.campaign}>
      <ChampionshipInner />
    </NeedRun>
  );
}

type Tab = 'tabela' | 'rodadas' | 'artilharia' | 'copa' | 'estadual' | 'meus';

function ChampionshipInner() {
  const run = useGame((s) => s.run)!;
  const simulateDay = useGame((s) => s.simulateDay);
  const simulateAll = useGame((s) => s.simulateAll);
  const c = run.campaign!;
  const [tab, setTab] = useState<Tab>('tabela');
  const [confirmAll, setConfirmAll] = useState(false);
  const [toast, showToast] = useToast();
  const day = currentDay(c);
  const fx = userFixture(c, day);
  const table = useMemo(() => leagueStandings(c), [c]);
  const me = table.find((r) => r.team === USER_ID)!;
  const myPos = table.findIndex((r) => r.team === USER_ID) + 1;
  const userLeague = c.results.filter((m) => m.comp === 'brasileirao' && (m.home === USER_ID || m.away === USER_ID));
  const perfectAlive = userLeague.every((m) => (m.home === USER_ID ? m.score[0] > m.score[1] : m.score[1] > m.score[0]));
  const firstDrop = userLeague.findIndex((m) => !(m.home === USER_ID ? m.score[0] > m.score[1] : m.score[1] > m.score[0]));

  const quickSim = () => {
    const before = c.results.length;
    simulateDay();
    const after = useGame.getState().run?.campaign;
    if (after && fx) {
      const m = after.results.slice(before).find((r) => r.home === USER_ID || r.away === USER_ID);
      if (m) showToast(`${c.teams[m.home].short} ${m.score[0]} × ${m.score[1]} ${c.teams[m.away].short}${m.shootout ? ` (pên. ${m.shootout[0]}–${m.shootout[1]})` : ''}`);
    }
    if (after?.finished) navigate('/resultado');
  };

  const tabs: [Tab, string][] = [
    ['tabela', 'Classificação'],
    ['rodadas', 'Rodadas'],
    ['artilharia', 'Artilharia'],
    ['meus', 'Meus jogos'],
  ];
  if (c.estadual) tabs.splice(1, 0, ['estadual', c.estadualName ?? 'Estadual']);
  if (c.copa) tabs.splice(1, 0, ['copa', 'Copa do Brasil']);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Temporada {c.finished ? 'encerrada' : 'em andamento'}</div>
          <h1>Campeonato</h1>
        </div>
        <div className="row wrap">
          <a className="btn btn-ghost btn-sm" href="#estatisticas">
            Estatísticas
          </a>
          {c.finished && (
            <a className="btn btn-gold" href="#resultado">
              Resultado final
            </a>
          )}
        </div>
      </div>

      <div className="season-strip">
        <div className="big-stat">
          <span className="v">{me.p ? `${myPos}º` : '—'}</span>
          <span className="k">Posição</span>
        </div>
        <div className="big-stat">
          <span className="v">{me.pts}</span>
          <span className="k">Pontos</span>
        </div>
        <div className="big-stat">
          <span className="v">
            {me.w}-{me.d}-{me.l}
          </span>
          <span className="k">V-E-D</span>
        </div>
        <div className="big-stat">
          <span className="v">
            {me.gf}:{me.ga}
          </span>
          <span className="k">Gols</span>
        </div>
        <div className={`perfect-flag ${perfectAlive ? 'alive' : 'dead'}`}>
          {perfectAlive ? (
            <>
              ⭐ Campanha perfeita viva · {me.w}/38
            </>
          ) : (
            <>Perfeição perdida na {firstDrop + 1}ª rodada</>
          )}
        </div>
      </div>

      {!c.finished && day && (
        <div className="panel next-match">
          <div className="eyebrow">
            {COMP_NAMES[day.comp]} · {day.label.split(' · ').slice(1).join(' · ')}
          </div>
          {fx ? (
            <>
              <div className="vs">
                <FixtureSide c={c} id={fx.home} />
                <span className="vs-x">×</span>
                <FixtureSide c={c} id={fx.away} />
              </div>
              <div className="dim" style={{ textAlign: 'center', marginBottom: 12 }}>
                {fx.home === USER_ID ? 'Você joga em casa' : 'Você joga fora de casa'}
                {day.leg === 2 && <TieInfo c={c} />}
              </div>
              <div className="row wrap" style={{ justifyContent: 'center' }}>
                <button className="btn btn-gold btn-lg" onClick={() => navigate('/partida')}>
                  ▶ Jogar partida
                </button>
                <button className="btn btn-ghost" onClick={quickSim}>
                  Simular resultado
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmAll(true)}>
                  Simular até o fim
                </button>
              </div>
            </>
          ) : (
            <div className="row wrap" style={{ justifyContent: 'space-between' }}>
              <p className="muted">Você não disputa esta fase. Os demais jogos serão simulados.</p>
              <button className="btn btn-blue" onClick={quickSim}>
                Avançar
              </button>
            </div>
          )}
        </div>
      )}

      <div className="tabs" role="tablist" style={{ margin: '18px 0 12px' }}>
        {tabs.map(([id, label]) => (
          <button key={id} className="tab" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'tabela' && <StandingsTable c={c} />}
      {tab === 'rodadas' && <Rounds c={c} />}
      {tab === 'artilharia' && <Scorers c={c} />}
      {tab === 'copa' && c.copa && <CupView c={c} cup={c.copa} />}
      {tab === 'estadual' && c.estadual && <CupView c={c} cup={c.estadual} />}
      {tab === 'meus' && <MyMatches c={c} />}

      {confirmAll && (
        <Modal label="Simular até o fim" onClose={() => setConfirmAll(false)}>
          <h3 style={{ fontSize: 24, marginBottom: 8 }}>Simular o restante da temporada?</h3>
          <p className="muted">Todos os jogos restantes serão decididos pelo motor, sem assistir. Os resultados são definitivos.</p>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={() => setConfirmAll(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-gold"
              onClick={() => {
                simulateAll();
                navigate('/resultado');
              }}
            >
              Simular
            </button>
          </div>
        </Modal>
      )}
      {toast}
    </div>
  );
}

function FixtureSide({ c, id }: { c: Campaign; id: string }) {
  const t = c.teams[id];
  return (
    <div className={`fx-side ${t.isUser ? 'is-user' : ''}`}>
      <TeamCrest team={t} size={54} />
      <strong>{t.name}</strong>
      <span className="dim">{t.label}</span>
      <OvrBadge value={t.ratings.overall} />
    </div>
  );
}

function TieInfo({ c }: { c: Campaign }) {
  const day = currentDay(c)!;
  const cup = day.comp === 'copa' ? c.copa : c.estadual;
  const tie = cup?.stages[day.stage!]?.ties.find((t) => t.a === USER_ID || t.b === USER_ID);
  if (!tie) return null;
  const results = new Map(c.results.map((m) => [m.key, m]));
  const [ga, gb] = aggregate(tie, results);
  const mine = tie.a === USER_ID ? ga : gb;
  const theirs = tie.a === USER_ID ? gb : ga;
  return <> · Jogo de ida: você {mine} × {theirs} (agregado)</>;
}

function StandingsTable({ c }: { c: Campaign }) {
  const table = leagueStandings(c);
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>#</th>
            <th className="l">Clube</th>
            <th>P</th>
            <th>J</th>
            <th>V</th>
            <th>E</th>
            <th>D</th>
            <th>GP</th>
            <th>GC</th>
            <th>SG</th>
            <th className="l">Últimos</th>
          </tr>
        </thead>
        <tbody>
          {table.map((r, i) => {
            const t = c.teams[r.team];
            const zone = i < 4 ? 'zone-lib' : i < 6 ? 'zone-pre' : i >= 16 ? 'zone-rel' : '';
            return (
              <tr key={r.team} className={r.team === USER_ID ? 'me' : ''}>
                <td className={`pos-cell ${zone}`}>{i + 1}</td>
                <td className="l">
                  <TeamName team={t} />
                  <span className="dim era-tag">{t.isUser ? '' : t.label}</span>
                </td>
                <td className="stat-num">{r.pts}</td>
                <td>{r.p}</td>
                <td>{r.w}</td>
                <td>{r.d}</td>
                <td>{r.l}</td>
                <td>{r.gf}</td>
                <td>{r.ga}</td>
                <td>{r.gf - r.ga}</td>
                <td className="l">
                  <span className="form">
                    {r.form.slice(-5).map((f, j) => (
                      <i key={j} className={`f-${f}`}>
                        {f}
                      </i>
                    ))}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="zones-legend">
        <span>
          <i className="zone-lib" /> Libertadores
        </span>
        <span>
          <i className="zone-pre" /> Pré-Libertadores
        </span>
        <span>
          <i className="zone-rel" /> Rebaixamento
        </span>
      </div>
    </div>
  );
}

function Rounds({ c }: { c: Campaign }) {
  const played = c.results.filter((m) => m.comp === 'brasileirao').length / 10;
  const [round, setRound] = useState(Math.max(0, Math.min(37, Math.ceil(played) - (played % 1 === 0 && played > 0 ? 1 : 0))));
  const byKey = new Map(c.results.map((m) => [m.key, m]));
  const fixtures = c.league.fixtures[round];
  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <button className="icon-btn" onClick={() => setRound(Math.max(0, round - 1))} aria-label="Rodada anterior">
          ‹
        </button>
        <strong className="stat-num" style={{ fontSize: 20 }}>
          Rodada {round + 1}
        </strong>
        <button className="icon-btn" onClick={() => setRound(Math.min(37, round + 1))} aria-label="Próxima rodada">
          ›
        </button>
      </div>
      <div className="fixtures">
        {fixtures.map((f) => {
          const m = byKey.get(matchKey({ id: `br-${round}`, comp: 'brasileirao', label: '' }, f));
          return <FixtureRow key={f.home + f.away} c={c} home={f.home} away={f.away} m={m} />;
        })}
      </div>
    </div>
  );
}

function FixtureRow({ c, home, away, m }: { c: Campaign; home: string; away: string; m?: PlayedMatch }) {
  const user = home === USER_ID || away === USER_ID;
  return (
    <div className={`fixture ${user ? 'is-user' : ''}`}>
      <span className="fx-team r">
        {c.teams[home].name} <TeamCrest team={c.teams[home]} size={18} />
      </span>
      <span className="fx-score">
        {m ? `${m.score[0]} × ${m.score[1]}` : '–'}
        {m?.shootout && <small> ({m.shootout[0]}–{m.shootout[1]} pên.)</small>}
      </span>
      <span className="fx-team">
        <TeamCrest team={c.teams[away]} size={18} /> {c.teams[away].name}
      </span>
    </div>
  );
}

function Scorers({ c }: { c: Campaign }) {
  const rows = topScorers(c.results.filter((m) => m.comp === 'brasileirao')).slice(0, 25);
  if (!rows.length) return <div className="empty">A artilharia aparece após a primeira rodada.</div>;
  return (
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
          {rows.map((r, i) => (
            <tr key={r.team + r.personId} className={r.team === USER_ID ? 'me' : ''}>
              <td>{i + 1}</td>
              <td className="l">
                <strong>{r.name}</strong>
              </td>
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
  );
}

function CupView({ c, cup }: { c: Campaign; cup: CupState }) {
  const results = new Map(c.results.map((m) => [m.key, m]));
  return (
    <div className="stack">
      {cup.champion && (
        <div className="panel champion-banner">
          🏆 Campeão: <TeamName team={c.teams[cup.champion]} />
        </div>
      )}
      {cup.groupStage && (
        <div className="panel">
          <h3 style={{ fontSize: 20, marginBottom: 8 }}>Triangular</h3>
          <div className="fixtures">
            {cup.groupStage.fixtures.map((f) => (
              <FixtureRow key={f.home + f.away} c={c} home={f.home} away={f.away} m={f.key ? results.get(f.key) : undefined} />
            ))}
          </div>
        </div>
      )}
      {cup.stages.map((st) => (
        <div key={st.id} className="panel">
          <h3 style={{ fontSize: 20, marginBottom: 8 }}>{st.name}</h3>
          <div className="fixtures">
            {st.ties.map((t) => {
              const [ga, gb] = aggregate(t, results);
              const played = t.legs.some(Boolean);
              return (
                <div key={t.id} className={`fixture tie ${t.a === USER_ID || t.b === USER_ID ? 'is-user' : ''}`}>
                  <span className={`fx-team r ${t.winner === t.a ? 'winner' : ''}`}>
                    {c.teams[t.a].name} <TeamCrest team={c.teams[t.a]} size={18} />
                  </span>
                  <span className="fx-score">
                    {played ? `${ga} × ${gb}` : 'ida e volta'}
                    {t.shootout && <small> ({t.shootout[0]}–{t.shootout[1]} pên.)</small>}
                  </span>
                  <span className={`fx-team ${t.winner === t.b ? 'winner' : ''}`}>
                    <TeamCrest team={c.teams[t.b]} size={18} /> {c.teams[t.b].name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {!cup.stages.length && !cup.groupStage && <div className="empty">Sem jogos nesta competição.</div>}
      {cup.stages.length > 0 && !cup.champion && (
        <p className="dim">Fases seguintes: {cup.stageNames.slice(cup.current + 1).join(' → ') || '—'}</p>
      )}
    </div>
  );
}

function MyMatches({ c }: { c: Campaign }) {
  const list = [...c.userMatches].reverse();
  if (!list.length) return <div className="empty">Seus jogos aparecem aqui depois da estreia.</div>;
  return (
    <div className="fixtures panel">
      {list.map((um) => {
        const m = um.result;
        const side = um.home === USER_ID ? 0 : 1;
        const res = m.score[side] > m.score[1 - side] ? 'V' : m.score[side] < m.score[1 - side] ? 'D' : 'E';
        return (
          <div key={um.key} className="fixture is-user my-match">
            <span className={`res res-${res}`}>{res}</span>
            <span className="dim my-label">{um.label}</span>
            <span className="fx-score">
              {c.teams[um.home].short} {m.score[0]} × {m.score[1]} {c.teams[um.away].short}
              {um.shootout && <small> ({um.shootout.score[0]}–{um.shootout.score[1]} pên.)</small>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
