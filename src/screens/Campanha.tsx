// Campanha de outro jogador, aberta pelo ranking: perfil público do jogador e
// a escalação e os destaques daquela temporada.
import { useEffect, useState } from 'react';
import { DIFFICULTIES } from '../engine/team';
import { decadesLabel, efficiency } from '../history/record';
import { loadPublicSeason, type PublicSeason } from '../cloud/publicSeason';
import { isOwnerAvatar, ownerAvatarUrl } from '../avatars/owner';
import { StaffBadge } from '../components/Account';
import { PlayerFaceByKey } from '../components/PlayerFace';
import { BackLink } from '../components/ui';
import { fmtDate, SeasonCrest, SeasonLineup, statusLabel } from '../components/SeasonViews';
import { ShareModal } from '../share/ShareModal';
import { headline, renderResultCard, resultFilename } from '../share/resultCard';
import { hasLineup, lineupFilename, lineupText, renderLineupCard } from '../share/lineupCard';

export function Campanha({ id }: { id: string }) {
  const [data, setData] = useState<PublicSeason | null | undefined | 'loading'>('loading');
  const [sharing, setSharing] = useState<'resultado' | 'escalacao' | null>(null);

  useEffect(() => {
    let alive = true;
    setData('loading');
    void loadPublicSeason(id).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [id]);

  if (data === 'loading') {
    return (
      <div className="page">
        <BackLink to="/ranking" label="Ranking" />
        <div className="empty panel" style={{ marginTop: 16 }} aria-busy="true">
          Carregando a campanha…
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="page">
        <BackLink to="/ranking" label="Ranking" />
        <div className="empty panel" style={{ marginTop: 16 }}>
          {data === null ? 'Campanha não encontrada.' : 'Não foi possível carregar a campanha agora. Verifique a conexão e tente de novo.'}
        </div>
      </div>
    );
  }

  const { player: p, entry: s, details } = data;
  const diff = DIFFICULTIES.find((d) => d.id === s.difficulty)?.name;
  const role = p.title || 'Técnico';
  const face =
    p.title && isOwnerAvatar(p.avatar) ? (
      <img className="pavatar" src={ownerAvatarUrl()} width={84} height={84} alt="" />
    ) : p.avatar ? (
      <PlayerFaceByKey cardKey={p.avatar} size={84} />
    ) : (
      <span className="user-avatar" style={{ width: 84, height: 84, fontSize: 30 }}>
        {p.name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0]!.toUpperCase())
          .join('')}
      </span>
    );

  return (
    <div className="page season-page">
      <div className="page-head">
        <BackLink to="/ranking" label="Ranking" />
        <div className="row wrap" style={{ gap: 8 }}>
          {hasLineup(details) && (
            <button className="btn btn-ghost" onClick={() => setSharing('escalacao')}>
              Arte da escalação
            </button>
          )}
          <button className="btn btn-gold" onClick={() => setSharing('resultado')}>
            Arte do resultado
          </button>
        </div>
      </div>

      <section className="public-player panel">
        {face}
        <div className="grow">
          <div className="eyebrow">{p.isMe ? 'Sua campanha' : role}</div>
          <h2>
            {p.name} {p.title ? <StaffBadge title={p.title} /> : null}
          </h2>
          {p.since && <p className="dim">No 11BRL desde {fmtDate(p.since)}</p>}
        </div>
        <div className="public-player-stats">
          <div>
            <b>{p.seasons}</b>
            <span>Temporadas</span>
          </div>
          <div>
            <b>{p.titles}</b>
            <span>Títulos</span>
          </div>
          <div>
            <b>{p.perfect}</b>
            <span>Perfeitas</span>
          </div>
          <div>
            <b>{p.bestPoints ?? '—'}</b>
            <span>Melhor pontuação</span>
          </div>
        </div>
      </section>

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
            {decadesLabel(s, 8) || '—'} · {s.formationId}
            {s.finishedAt ? ` · ${fmtDate(s.finishedAt)}` : ''}
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

      {hasLineup(details) ? (
        <section className="section">
          <h2 className="section-title">Escalação</h2>
          <div className="season-lineup">
            <SeasonLineup formationId={s.formationId} lineup={details.lineup} />
          </div>
        </section>
      ) : (
        <p className="dim" style={{ marginTop: 16 }}>
          A escalação desta temporada não foi registrada.
        </p>
      )}

      <section className="section">
        <h2 className="section-title">Destaques</h2>
        <div className="panel">
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
        </div>
      </section>

      {sharing && (
        <ShareModal
          initial={sharing}
          variants={[
            {
              id: 'resultado',
              label: 'Resultado',
              title: `Campanha de ${p.name}`,
              filename: resultFilename(s),
              text: `${p.name} no PRAG Onze BR Lendário — ${headline(s).text}\n${s.teamName} · ${s.formationId} · ${s.points} pts`,
              render: () => renderResultCard({ season: s, details, playerName: p.name, playerRole: role }),
            },
            ...(hasLineup(details)
              ? [
                  {
                    id: 'escalacao',
                    label: 'Escalação',
                    title: `Escalação de ${p.name}`,
                    filename: lineupFilename(s),
                    text: lineupText(s, details),
                    render: () => renderLineupCard({ season: s, details, playerName: p.name, playerRole: role }),
                  },
                ]
              : []),
          ]}
          onClose={() => setSharing(null)}
        />
      )}
    </div>
  );
}
