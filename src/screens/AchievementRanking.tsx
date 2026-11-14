// Ranking de conquistas: jogadores ordenados pela pontuação das medalhas
// (bronze 1, prata 2, ouro 3, lendária 5). Com conta, é o mesmo para todos;
// sem nuvem, mostra só a pontuação deste aparelho.
import { useEffect, useMemo, useState } from 'react';
import { isOwnerAvatar, ownerAvatarUrl } from '../avatars/owner';
import { useAuth } from '../cloud/auth';
import { cloudEnabled } from '../cloud/config';
import { loadAchievementRanking, type AchievementRankingEntry } from '../cloud/globalRanking';
import { StaffBadge, UserAvatar } from '../components/Account';
import { PlayerFaceByKey } from '../components/PlayerFace';
import { achievementScore, TIER_LABEL, TIER_ORDER, TIER_POINTS } from '../history/achievements';
import { useHistory } from '../history/store';
import { navigate } from '../router';

export function AchievementRanking() {
  const unlocks = useHistory((s) => s.data.unlocks);
  const me = useAuth((s) => (s.status === 'signed-in' ? s.user : null));
  const [list, setList] = useState<AchievementRankingEntry[]>([]);
  const [status, setStatus] = useState<'loading' | 'live' | 'offline'>(cloudEnabled ? 'loading' : 'offline');
  const myPoints = achievementScore(unlocks);
  const mine = useMemo(() => {
    const count = (t: keyof typeof TIER_POINTS) => unlocks.filter((u) => u.tier === t).length;
    return { bronze: count('bronze'), prata: count('prata'), ouro: count('ouro'), lendaria: count('lendaria') };
  }, [unlocks]);

  useEffect(() => {
    if (!cloudEnabled) return;
    let alive = true;
    void loadAchievementRanking().then((rows) => {
      if (!alive) return;
      if (rows) {
        setList(rows);
        setStatus('live');
      } else setStatus('offline');
    });
    return () => {
      alive = false;
    };
  }, [me?.id, unlocks.length]);

  // sem ranking de todos: só a sua pontuação neste aparelho
  const rows: AchievementRankingEntry[] =
    status === 'live'
      ? list
      : unlocks.length
        ? [{ isMe: true, who: me?.name ?? 'Você', avatar: null, title: null, points: myPoints, total: unlocks.length, ...mine, bestRunId: null }]
        : [];
  const myRank = list.findIndex((r) => r.isMe);

  return (
    <>
      <div className="row wrap" style={{ marginBottom: 10, gap: 8 }}>
        <span className="chip chip-gold">
          Seus pontos: <strong>{myPoints}</strong>
          {myRank >= 0 ? ` · ${myRank + 1}º lugar` : ''}
        </span>
        {TIER_ORDER.map((t) => (
          <span key={t} className={`tier-pill tier-${t}`}>
            {TIER_LABEL[t]} = {TIER_POINTS[t]} {TIER_POINTS[t] === 1 ? 'ponto' : 'pontos'}
          </span>
        ))}
        {cloudEnabled && status !== 'live' && <span className="chip">{status === 'loading' ? 'Carregando…' : 'Ranking de todos indisponível agora'}</span>}
      </div>
      <p className="dim" style={{ marginBottom: 12, fontSize: 13 }}>
        {cloudEnabled
          ? 'Todos os jogadores com conta, pela pontuação das conquistas. Desempate: mais lendárias, mais ouros e mais conquistas. Entre com Google para aparecer aqui.'
          : 'Pontuação das conquistas salvas neste aparelho.'}
      </p>
      {rows.length === 0 ? (
        <div className="empty panel">{status === 'loading' ? 'Carregando o ranking de conquistas…' : 'Ninguém desbloqueou conquistas ainda. Jogue uma temporada para começar a pontuar!'}</div>
      ) : (
        <div className="table-wrap">
          <table className="data ach-rank">
            <thead>
              <tr>
                <th>#</th>
                <th className="l">Técnico</th>
                <th>Pontos</th>
                {TIER_ORDER.map((t) => (
                  <th key={t} title={`${TIER_LABEL[t]} (${TIER_POINTS[t]} ${TIER_POINTS[t] === 1 ? 'ponto' : 'pontos'})`}>
                    <span className="ach-rank-tier">
                      <span className={`tier-dot tier-${t}`} aria-hidden="true" />
                      {TIER_LABEL[t]}
                    </span>
                  </th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 300).map((r, i) => {
                const to = r.bestRunId ? `/campanha/${r.bestRunId}` : null;
                const open = to ? () => navigate(to) : undefined;
                return (
                  <tr
                    key={`${r.who}-${i}`}
                    className={`${to ? 'is-link' : ''} ${r.isMe ? 'is-me' : ''}`.trim() || undefined}
                    onClick={open}
                    onKeyDown={to ? (ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), open!()) : undefined}
                    tabIndex={to ? 0 : undefined}
                    role={to ? 'link' : undefined}
                    aria-label={to ? `Ver o perfil de ${r.who}: ${r.points} pontos em conquistas` : undefined}
                    title={to ? 'Ver perfil e melhor campanha' : undefined}
                  >
                    <td className="stat-num">{i + 1}</td>
                    <td className="l">
                      <span className="rank-who">
                        {r.isMe ? (
                          <UserAvatar size={34} />
                        ) : r.title && isOwnerAvatar(r.avatar) ? (
                          <img className="pavatar" src={ownerAvatarUrl()} width={34} height={34} alt="" />
                        ) : (
                          <PlayerFaceByKey cardKey={r.avatar} size={34} />
                        )}
                        <span className="rank-who-name">
                          <strong>{r.who}</strong>
                          {r.isMe ? <StaffBadge small /> : r.title ? <StaffBadge small title={r.title} /> : null}
                        </span>
                      </span>
                    </td>
                    <td className="stat-num ach-rank-pts">{r.points}</td>
                    <td>{r.lendaria}</td>
                    <td>{r.ouro}</td>
                    <td>{r.prata}</td>
                    <td>{r.bronze}</td>
                    <td>{r.total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
