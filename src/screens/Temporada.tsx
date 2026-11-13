import { useState } from 'react';
import { DIFFICULTIES } from '../engine/team';
import { USER_ID } from '../engine/campaign';
import { ACHIEVEMENT_BY_ID, TIER_LABEL } from '../history/achievements';
import { decadesLabel, efficiency } from '../history/record';
import { useHistory, useSeasonDetails } from '../history/store';
import type { MatchLine, SeasonEntry } from '../history/types';
import { usePlayerName } from '../cloud/profile';
import { BackLink } from '../components/ui';
import { Medal } from '../components/Medal';
import { fmtDate, SeasonCrest, SeasonLineup, statusLabel } from '../components/SeasonViews';
import { ShareModal } from '../share/ShareModal';
import { headline, renderResultCard, resultFilename } from '../share/resultCard';
import { PlayerFaceByKey } from '../components/PlayerFace';
import { hasLineup, lineupFilename, lineupText, renderLineupCard } from '../share/lineupCard';

const COMP_LABEL: Record<MatchLine['comp'], string> = { brasileirao: 'Brasileirão', copa: 'Copa do Brasil', estadual: 'Estadual' };

function shareText(s: SeasonEntry): string {
  return [
    `PRAG Onze BR Lendário — ${headline(s).text}`,
    `${s.teamName} · ${decadesLabel(s)} · ${s.formationId}`,
    `${s.wins}V ${s.draws}E ${s.losses}D · ${s.points} pts · ${s.position ?? '—'}º lugar · ${s.goalsFor}:${s.goalsAgainst}`,
    s.captainName ? `Capitão: ${s.captainName}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function Temporada({ id }: { id: string }) {
  const season = useHistory((s) => s.data.seasons.find((x) => x.runId === id));
  const { details, loading } = useSeasonDetails(season ? id : null);
  const playerName = usePlayerName();
  const [sharing, setSharing] = useState<'resultado' | 'escalacao' | null>(null);
  const [comp, setComp] = useState<MatchLine['comp']>('brasileirao');

  if (!season) {
    return (
      <div className="page">
        <BackLink to="/historico" label="Histórico" />
        <div className="empty panel" style={{ marginTop: 16 }}>
          Temporada não encontrada nesta conta.
        </div>
      </div>
    );
  }
  const s = season;
  const diff = DIFFICULTIES.find((d) => d.id === s.difficulty)?.name;
  const comps = [...new Set((details?.matches ?? []).map((m) => m.comp))];
  const matches = (details?.matches ?? []).filter((m) => m.comp === comp);

  return (
    <div className="page season-page">
      <div className="page-head">
        <BackLink to="/historico" label="Histórico" />
        <div className="row wrap" style={{ gap: 8 }}>
          {hasLineup(details) && (
            <button className="btn btn-ghost" onClick={() => setSharing('escalacao')}>
              Arte da escalação
            </button>
          )}
          {s.status !== 'in_progress' && (
            <button className="btn btn-gold" onClick={() => setSharing('resultado')}>
              Gerar arte do resultado
            </button>
          )}
        </div>
      </div>

      <section className={`season-hero ${s.perfect ? 'is-perfect' : s.champion ? 'is-champion' : ''}`} style={{ ['--club' as string]: s.colors.primary, ['--club2' as string]: s.colors.secondary }}>
        <SeasonCrest season={s} size={92} />
        <div className="season-hero-info">
          <div className="eyebrow">
            {s.modeLabel}
            {s.challengeLabel ? ` · ${s.challengeLabel}` : ''}
            {diff ? ` · ${diff}` : ''}
          </div>
          <h1>{s.teamName}</h1>
          <p className="muted">
            {decadesLabel(s, 8) || '—'} · {s.formationId} · início {fmtDate(s.startedAt)}
            {s.finishedAt ? ` · fim ${fmtDate(s.finishedAt)}` : ''}
          </p>
          <span className={`season-badge ${s.champion ? 'is-gold' : ''}`}>{statusLabel(s)}</span>
        </div>
      </section>

      <div className="final-numbers season-numbers">
        <div className="big-stat">
          <span className="v">{s.position ? `${s.position}º` : '—'}</span>
          <span className="k">Posição</span>
        </div>
        <div className="big-stat">
          <span className="v">{s.points}</span>
          <span className="k">Pontos</span>
        </div>
        <div className="big-stat">
          <span className="v">
            {s.wins}-{s.draws}-{s.losses}
          </span>
          <span className="k">V-E-D</span>
        </div>
        <div className="big-stat">
          <span className="v">
            {s.goalsFor}:{s.goalsAgainst}
          </span>
          <span className="k">Gols</span>
        </div>
        <div className="big-stat">
          <span className="v">{(s.metrics?.efficiency ?? efficiency(s.points, s.played)).toLocaleString('pt-BR')}%</span>
          <span className="k">Aproveitamento</span>
        </div>
        <div className="big-stat">
          <span className="v">{Math.round(s.squadOverall)}</span>
          <span className="k">Overall</span>
        </div>
        <div className="big-stat">
          <span className="v">{s.chemistry}</span>
          <span className="k">Química</span>
        </div>
      </div>

      {details?.sequence?.length ? (
        <div className="result-grid" aria-label="Sequência de resultados no Brasileirão">
          {details.sequence.map((r, i) => (
            <i key={i} className={`r-${r}`} title={`Rodada ${i + 1}: ${r}`} />
          ))}
        </div>
      ) : null}

      <div className="final-grid">
        <div className="panel">
          <h2 className="section-title">Conquistas da temporada</h2>
          {s.achievements.length ? (
            <ul className="season-medals">
              {s.achievements.map((aid) => {
                const a = ACHIEVEMENT_BY_ID[aid];
                return a ? (
                  <li key={aid}>
                    <Medal tier={a.tier} icon={a.icon} size={40} />
                    <span>
                      <strong>{a.name}</strong>
                      <span className="dim"> · {TIER_LABEL[a.tier]}</span>
                    </span>
                  </li>
                ) : null;
              })}
            </ul>
          ) : (
            <p className="dim">Nenhuma conquista desbloqueada nesta temporada.</p>
          )}
          {details && (details.copa || details.estadual) && (
            <>
              <div className="divider" />
              {[details.estadual, details.copa].filter(Boolean).map((c) => (
                <p key={c!.name}>
                  <strong>{c!.name}:</strong> {c!.userResult}
                  {c!.champion && c!.userResult !== 'Campeão' ? <span className="dim"> · campeão: {c!.champion}</span> : null}
                </p>
              ))}
            </>
          )}
        </div>
        <div className="panel">
          <h2 className="section-title">Destaques</h2>
          {s.captainName && (
            <p>
              Capitão: <strong>{s.captainName}</strong>
            </p>
          )}
          {details?.topScorer && (
            <p>
              Artilheiro do time no Brasileirão: <strong>{details.topScorer.name}</strong> ({details.topScorer.goals} gols)
            </p>
          )}
          {details?.bestPlayer && (
            <p>
              Melhor nota média: <strong>{details.bestPlayer.name}</strong> ({details.bestPlayer.rating.toFixed(2)})
            </p>
          )}
          {details?.leagueTopScorer && (
            <p>
              Artilheiro do campeonato: <strong>{details.leagueTopScorer.name}</strong> ({details.leagueTopScorer.team}), {details.leagueTopScorer.goals} gols
            </p>
          )}
          {details?.marks.filter((m) => m.id !== 'artilheiro' && m.id !== 'aproveitamento').map((m) => (
            <p key={m.id}>
              {m.label}: <strong>{m.value}</strong>
            </p>
          ))}
          {loading && <p className="dim">Carregando detalhes…</p>}
        </div>
      </div>

      {details && (
        <>
          <section className="section">
            <h2 className="section-title">Escalação</h2>
            <div className="season-lineup">
              <SeasonLineup formationId={s.formationId} lineup={details.lineup} />
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">Classificação final</h2>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>#</th>
                    <th className="l">Time</th>
                    <th>P</th>
                    <th>J</th>
                    <th>V</th>
                    <th>E</th>
                    <th>D</th>
                    <th>GP</th>
                    <th>GC</th>
                    <th>SG</th>
                  </tr>
                </thead>
                <tbody>
                  {details.standings.map((r, i) => (
                    <tr key={r.team} className={r.user ? 'is-user' : ''}>
                      <td>{i + 1}</td>
                      <td className="l">
                        <strong>{r.name}</strong> <span className="dim">{r.label}</span>
                      </td>
                      <td>
                        <strong>{r.pts}</strong>
                      </td>
                      <td>{r.p}</td>
                      <td>{r.w}</td>
                      <td>{r.d}</td>
                      <td>{r.l}</td>
                      <td>{r.gf}</td>
                      <td>{r.ga}</td>
                      <td>{r.gf - r.ga}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">Partidas</h2>
            {comps.length > 1 && (
              <div className="tabs" role="tablist" style={{ marginBottom: 10 }}>
                {comps.map((c) => (
                  <button key={c} role="tab" className="tab" aria-selected={comp === c} onClick={() => setComp(c)}>
                    {COMP_LABEL[c]}
                  </button>
                ))}
              </div>
            )}
            <div className="match-list">
              {matches.map((m, i) => {
                const home = m.home === USER_ID;
                const f = home ? m.score[0] : m.score[1];
                const a = home ? m.score[1] : m.score[0];
                const res = f > a ? 'V' : f < a ? 'D' : 'E';
                const ours = m.goals.filter((g) => (g.side === 'home') === home);
                return (
                  <div key={i} className={`match-row r-${res}`}>
                    <span className="match-label dim">{m.label}</span>
                    <span className="match-teams">
                      {m.homeName} <b>{m.score[0]}</b> × <b>{m.score[1]}</b> {m.awayName}
                      {m.shootout ? <span className="dim"> (pên. {m.shootout[0]}–{m.shootout[1]})</span> : null}
                    </span>
                    {ours.length > 0 && (
                      <span className="match-goals dim">
                        {ours.map((g) => `${g.name} ${g.minute}'${g.penalty ? ' (p)' : ''}`).join(', ')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">Estatísticas dos jogadores</h2>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th className="l">Jogador</th>
                    <th>Pos.</th>
                    <th>J</th>
                    <th>Gols</th>
                    <th>Assist.</th>
                    <th>Nota</th>
                    <th>Craque</th>
                    <th>SG</th>
                  </tr>
                </thead>
                <tbody>
                  {[...details.players]
                    .sort((a, b) => b.goals - a.goals || b.rating - a.rating)
                    .map((p) => (
                      <tr key={p.personId}>
                        <td>{p.number}</td>
                        <td className="l">
                          <span className="face-cell">
                            <PlayerFaceByKey cardKey={details.lineup.find((l) => l.personId === p.personId)?.cardKey} size={28} />
                            <strong>{p.name}</strong>
                          </span>
                        </td>
                        <td>{p.pos}</td>
                        <td>{p.games}</td>
                        <td className="stat-num">{p.goals}</td>
                        <td>{p.assists}</td>
                        <td>{p.games ? p.rating.toFixed(2) : '—'}</td>
                        <td>{p.mvps}</td>
                        <td>{p.pos === 'GOL' || p.pos === 'DEF' ? p.cleanSheets : '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {sharing && (
        <ShareModal
          initial={sharing}
          variants={[
            ...(s.status !== 'in_progress'
              ? [{ id: 'resultado', label: 'Resultado', title: 'Arte do resultado', filename: resultFilename(s), text: shareText(s), render: () => renderResultCard({ season: s, details, playerName }) }]
              : []),
            ...(hasLineup(details)
              ? [{ id: 'escalacao', label: 'Escalação', title: 'Arte da escalação', filename: lineupFilename(s), text: lineupText(s, details), render: () => renderLineupCard({ season: s, details, playerName }) }]
              : []),
          ]}
          onClose={() => setSharing(null)}
        />
      )}
    </div>
  );
}
