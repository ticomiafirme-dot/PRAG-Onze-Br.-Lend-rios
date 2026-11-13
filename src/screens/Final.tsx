import { useEffect, useMemo, useState } from 'react';
import { CLUB_BY_ID } from '../data/clubs';
import { getFormation } from '../data/formations';
import { navigate } from '../router';
import { lineupOf, MODE_INFO, useGame } from '../state/store';
import { loadPlayerName, savePlayerName } from '../state/storage';
import { recordRanking } from '../state/ranking';
import { leagueStandings, summarize, USER_ID, userPlayerStats } from '../engine/campaign';
import { topScorers } from '../engine/league';
import { DIFFICULTIES } from '../engine/team';
import { PlayerCard } from '../components/PlayerCard';
import { TeamCrest } from '../components/TeamBadge';
import { Confetti, NeedRun, useToast } from '../components/ui';
import { buildSeasonRecord } from '../history/record';
import { useHistory } from '../history/store';
import { ShareModal } from '../share/ShareModal';
import { renderResultCard, resultFilename } from '../share/resultCard';
import { usePlayerName, usePlayerRole } from '../cloud/profile';
import { PlayerFaceByKey } from '../components/PlayerFace';
import { hasLineup, lineupFilename, lineupText, renderLineupCard } from '../share/lineupCard';
import { useAuth } from '../cloud/auth';

export function Final() {
  const run = useGame((s) => s.run);
  return (
    <NeedRun ok={!!run?.campaign?.finished}>
      <FinalInner />
    </NeedRun>
  );
}

function FinalInner() {
  const run = useGame((s) => s.run)!;
  const markRankingSaved = useGame((s) => s.markRankingSaved);
  const abandon = useGame((s) => s.abandon);
  const startMode = useGame((s) => s.startMode);
  const chooseClub = useGame((s) => s.chooseClub);
  const c = run.campaign!;
  const s = useMemo(() => summarize(c), [c]);
  const user = c.teams[USER_ID];
  const lineup = lineupOf(run);
  const formation = getFormation(run.formationId!);
  const [name, setName] = useState(loadPlayerName());
  const [toast, showToast] = useToast();
  const [showShare, setShowShare] = useState<'resultado' | 'escalacao' | null>(null);
  const stored = useHistory((h) => h.data.seasons.find((x) => x.runId === run.id));
  const record = useMemo(() => buildSeasonRecord(run, 'finished'), [run]);
  const playerName = usePlayerName();
  const playerRole = usePlayerRole();
  const accountName = useAuth((st) => (st.status === 'signed-in' ? st.user?.name ?? null : null));
  const players = userPlayerStats(c);
  const top = [...players].sort((a, b) => b.goals - a.goals)[0];
  const best = [...players].sort((a, b) => b.rating - a.rating)[0];
  const scorers = topScorers(c.results.filter((m) => m.comp === 'brasileirao'));
  const artilheiro = scorers[0]?.team === USER_ID;
  const table = leagueStandings(c);
  const bestAttack = [...table].sort((a, b) => b.gf - a.gf)[0].team === USER_ID;
  const bestDefense = [...table].sort((a, b) => a.ga - b.ga)[0].team === USER_ID;
  const captain = lineup[run.captainSlot!];

  const seq = c.userMatches
    .filter((m) => m.comp === 'brasileirao')
    .map((um) => {
      const i = um.home === USER_ID ? 0 : 1;
      const f = um.result.score[i];
      const a = um.result.score[1 - i];
      return f > a ? 'V' : f === a ? 'E' : 'D';
    });
  // jogos simulados em lote não guardam detalhes: completa pela tabela de resultados
  const leagueSeq = c.results
    .filter((m) => m.comp === 'brasileirao' && (m.home === USER_ID || m.away === USER_ID))
    .map((m) => {
      const i = m.home === USER_ID ? 0 : 1;
      return m.score[i] > m.score[1 - i] ? 'V' : m.score[i] === m.score[1 - i] ? 'E' : 'D';
    });
  const grid = leagueSeq.length >= seq.length ? leagueSeq : seq;

  const headline = s.triple
    ? 'Tríplice Coroa!'
    : s.perfect
      ? 'Temporada perfeita!'
      : s.champion && s.unbeaten
        ? 'Campeão invicto!'
        : s.champion
          ? 'Campeão brasileiro!'
          : `${s.position}º lugar`;

  const achievements: [string, string, boolean][] = [
    ['⭐', 'Temporada perfeita (38 vitórias)', s.perfect],
    ['🏆', 'Campeão do Brasileirão', s.champion],
    ['🛡️', 'Invicto no Brasileirão', s.unbeaten],
    ['⚽', 'Artilheiro do campeonato', artilheiro],
    ['🔥', 'Melhor ataque', bestAttack],
    ['🧱', 'Melhor defesa', bestDefense],
  ];
  if (c.copa) achievements.push(['🥇', 'Campeão da Copa do Brasil', s.copaChampion]);
  if (c.estadual) achievements.push(['🏅', `Campeão do ${c.estadualName}`, s.estadualChampion]);
  if (c.copa && c.estadual) achievements.push(['👑', 'Tríplice Coroa', s.triple]);

  // a campanha já foi registrada no ranking ao terminar; aqui só atualizamos o nome
  useEffect(() => {
    if (!run.rankingSaved) {
      recordRanking(run);
      markRankingSaved();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveName = () => {
    savePlayerName(name);
    recordRanking(run, name, { shared: false });
    showToast('Nome salvo no ranking.');
  };

  const shareText = [
    `Onze BR Lendário PRAG — ${headline}`,
    `${user.name} · ${MODE_INFO[run.mode].name}${run.challenge ? ` (${run.challenge.label})` : ''} · ${formation.name} · ${DIFFICULTIES.find((d) => d.id === run.difficulty)?.name}`,
    `${s.wins}V ${s.draws}E ${s.losses}D · ${s.points} pts · ${s.position}º lugar · ${s.gf}:${s.ga}`,
    grid.map((r) => (r === 'V' ? '🟩' : r === 'E' ? '🟨' : '🟥')).join(''),
    `Capitão: ${captain.player.name}`,
  ].join('\n');

  const again = () => {
    const clubId = run.clubId;
    const mode = run.mode === 'diario' || run.mode === 'semanal' ? 'classico' : run.mode === 'era' ? 'classico' : run.mode;
    abandon();
    navigate(startMode(mode));
    if (clubId && mode !== 'mistura') {
      chooseClub(clubId);
      navigate(`/clube/${clubId}`);
    }
  };

  return (
    <div className="page">
      {(s.champion || s.copaChampion || s.estadualChampion) && <Confetti count={s.perfect || s.triple ? 160 : 100} />}
      <section className={`final-hero ${s.perfect ? 'is-perfect' : s.champion ? 'is-champion' : ''}`}>
        <TeamCrest team={user} size={84} />
        <div className="eyebrow">
          {MODE_INFO[run.mode].name} · {DIFFICULTIES.find((d) => d.id === run.difficulty)?.name}
          {run.challenge ? ` · ${run.challenge.label}` : ''}
        </div>
        <h1 className="final-title">{headline}</h1>
        <p className="muted">
          {user.name} · {formation.name} · capitão {captain.player.name}
        </p>
        <div className="final-numbers">
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
              {s.gf}:{s.ga}
            </span>
            <span className="k">Gols</span>
          </div>
          <div className="big-stat">
            <span className="v">{s.position}º</span>
            <span className="k">Posição</span>
          </div>
        </div>
        <div className="result-grid" aria-label="Sequência de resultados no Brasileirão">
          {grid.map((r, i) => (
            <i key={i} className={`r-${r}`} title={`Rodada ${i + 1}: ${r}`} />
          ))}
        </div>
      </section>

      <div className="final-grid">
        <div className="panel">
          <h2 className="section-title">Conquistas</h2>
          <ul className="achievements">
            {achievements.map(([icon, label, ok]) => (
              <li key={label} className={ok ? 'ok' : ''}>
                <span>{icon}</span> {label}
              </li>
            ))}
          </ul>
        </div>
        <div className="panel">
          <h2 className="section-title">Destaques</h2>
          {top && (
            <p>
              <PlayerFaceByKey cardKey={c.teams[USER_ID].players.find((p) => p.personId === top.personId)?.cardKey} size={30} /> Artilheiro do time: <strong>{top.name}</strong> — {top.goals} gols, {top.assists} assistências
            </p>
          )}
          {best && best.games > 0 && (
            <p style={{ marginTop: 6 }}>
              <PlayerFaceByKey cardKey={c.teams[USER_ID].players.find((p) => p.personId === best.personId)?.cardKey} size={30} /> Melhor nota média: <strong>{best.name}</strong> ({best.rating.toFixed(2)})
            </p>
          )}
          {scorers[0] && (
            <p style={{ marginTop: 6 }}>
              Artilheiro do Brasileirão: <strong>{scorers[0].name}</strong> ({c.teams[scorers[0].team].short}), {scorers[0].goals} gols
            </p>
          )}
          <div className="divider" />
{accountName ? (
            <p className="dim">
              No ranking como <strong style={{ color: 'var(--text-1, #fff)' }}>{accountName}</strong>, o nick da sua conta. Para trocar, edite o nome em{' '}
              <a href="#perfil">Meu Perfil</a>.
            </p>
          ) : (
            <label className="stack" style={{ gap: 6 }}>
              <span className="dim">Seu nome no ranking</span>
              <span className="row">
                <input className="search grow" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="Anônimo" />
                <button className="btn btn-ghost btn-sm" onClick={saveName}>
                  Salvar
                </button>
              </span>
            </label>
          )}
        </div>
      </div>

      <section className="section">
        <h2 className="section-title">Seu Onze Lendário</h2>
        <div className="mini-squad wide">
          {formation.slots.map((sl) => (
            <PlayerCard key={sl.id} card={lineup[sl.id]} size="sm" pos={sl.pos} captain={run.captainSlot === sl.id} />
          ))}
        </div>
      </section>

      <div className="row wrap final-actions">
        <button className="btn btn-gold btn-lg" onClick={() => setShowShare('resultado')} disabled={!record}>
          Compartilhar resultado
        </button>
        {hasLineup(record?.details) && (
          <button className="btn btn-ghost btn-lg" onClick={() => setShowShare('escalacao')}>
            Compartilhar escalação
          </button>
        )}
        <a className="btn btn-ghost" href={`#temporada-${run.id}`}>
          Ver no histórico
        </a>
        <a className="btn btn-ghost" href="#estatisticas">
          Estatísticas
        </a>
        <a className="btn btn-ghost" href="#ranking">
          Ranking
        </a>
        <button className="btn btn-blue" onClick={again}>
          Jogar de novo
        </button>
      </div>
      {showShare && record && (
        <ShareModal
          initial={showShare}
          variants={[
            {
              id: 'resultado',
              label: 'Resultado',
              title: 'Compartilhar resultado',
              filename: resultFilename(record),
              text: shareText,
              render: () => renderResultCard({ season: stored && stored.status === 'finished' ? stored : record, details: record.details, playerName, playerRole }),
            },
            ...(hasLineup(record.details)
              ? [
                  {
                    id: 'escalacao',
                    label: 'Escalação',
                    title: 'Compartilhar escalação',
                    filename: lineupFilename(record),
                    text: lineupText(record, record.details),
                    render: () => renderLineupCard({ season: stored && stored.status === 'finished' ? stored : record, details: record.details, playerName, playerRole }),
                  },
                ]
              : []),
          ]}
          onClose={() => setShowShare(null)}
        />
      )}
      {toast}
      {run.clubId && <span className="sr-only">{CLUB_BY_ID[run.clubId].name}</span>}
    </div>
  );
}
