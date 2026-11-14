import { useEffect, useMemo, useState } from 'react';
import { CLUB_BY_ID } from '../data/clubs';
import { loadRanking, readJSON, writeJSON, type RankingEntry } from '../state/storage';
import { flattenShared, getSharedRanking, type SharedEntry } from '../state/sharedRanking';
import { brazilDateKey, brazilWeekKey } from '../engine/challenges';
import { Crest } from '../components/Crest';
import { LogoMark } from '../components/Logo';
import { BackLink } from '../components/ui';
import { useAuth } from '../cloud/auth';
import { StaffBadge, UserAvatar } from '../components/Account';
import { PlayerFaceByKey } from '../components/PlayerFace';
import { cloudEnabled } from '../cloud/config';
import { loadGlobalRanking, type GlobalEntry } from '../cloud/globalRanking';
import { isOwnerAvatar, ownerAvatarUrl } from '../avatars/owner';
import { navigate } from '../router';
import { useHistory } from '../history/store';
import { onRankingPosition } from '../history/hooks';
import { AchievementRanking } from './AchievementRanking';

type Filter = 'geral' | 'diario' | 'semanal' | 'classico' | 'era' | 'mistura' | 'triplice';
type Scope = 'shared' | 'local' | 'global';
type Status = 'idle' | 'loading' | 'live' | 'stale' | 'offline';

type Diff = 'normal' | 'dificil' | 'lendario';
const DIFFS: [Diff, string][] = [
  ['normal', 'Normal'],
  ['dificil', 'Difícil'],
  ['lendario', 'Lendário'],
];
const DIFF_KEY = 'ranking-dificuldade';
/** Desafios têm dificuldade fixa (Diário: Normal; Semanal: Difícil): não precisam de sub-ranking. */
const hasDiffTabs = (f: Filter) => f !== 'diario' && f !== 'semanal';

/** Melhor posição de quem está conectado no sub-ranking da dificuldade de cada campanha. */
export function bestPositionByDifficulty<T extends { difficulty: string; isMe?: boolean; id: string }>(list: T[]): { position: number; runId: string } | null {
  let best: { position: number; runId: string } | null = null;
  const seen: Record<string, number> = {};
  for (const e of list) {
    const pos = (seen[e.difficulty] = (seen[e.difficulty] ?? 0) + 1);
    if (e.isMe && (!best || pos < best.position)) best = { position: pos, runId: e.id };
  }
  return best;
}

const FILTERS: [Filter, string][] = [
  ['geral', 'Geral'],
  ['diario', 'Desafio de hoje'],
  ['semanal', 'Desafio da semana'],
  ['classico', 'Clássico'],
  ['era', 'Era Única'],
  ['mistura', 'Mistura'],
  ['triplice', 'Tríplice Coroa'],
];

export function Ranking({ board = 'campanhas' }: { board?: 'campanhas' | 'conquistas' }) {
  const [filter, setFilter] = useState<Filter>('geral');
  const [diff, setDiffState] = useState<Diff>(() => {
    const d = readJSON<string>(DIFF_KEY, 'normal');
    return d === 'dificil' || d === 'lendario' ? d : 'normal';
  });
  const setDiff = (d: Diff) => {
    setDiffState(d);
    writeJSON(DIFF_KEY, d);
  };
  const [scope, setScope] = useState<Scope>('local');
  const [sharedOn, setSharedOn] = useState(false);
  const [shared, setShared] = useState<SharedEntry[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [global, setGlobal] = useState<GlobalEntry[]>([]);
  const history = useHistory((h) => h.data.seasons);
  const [globalStatus, setGlobalStatus] = useState<'loading' | 'live' | 'offline'>('loading');
  const me = useAuth((s) => (s.status === 'signed-in' ? s.user : null));
  /** Nome exibido numa campanha deste aparelho: o nick atual da conta, quando é de quem está conectado. */
  const isMine = (e: RankingEntry): boolean => !!me && (e.accountId === me.id || (!e.accountId && (!e.playerName || e.playerName === 'Anônimo')));
  const localName = (e: RankingEntry): string => (isMine(e) && me ? me.name : e.playerName || 'Anônimo');
  const [status, setStatus] = useState<Status>('idle');
  const local = useMemo(() => loadRanking(), []);

  // ranking compartilhado: assina uma vez a coleção, com limite de espera de 10 s
  useEffect(() => {
    let alive = true;
    let unsub: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    getSharedRanking().then((sh) => {
      if (!alive || !sh) return;
      setSharedOn(true);
      setScope('shared');
      setStatus('loading');
      timer = setTimeout(() => setStatus((s) => (s === 'loading' ? 'offline' : s === 'live' ? s : 'stale')), 10000);
      unsub = sh.db.collection('ranking').onSnapshot(
        (snap) => {
          const list = flattenShared(snap);
          setShared(list);
          if (!snap.metadata.fromCache) {
            clearTimeout(timer);
            setStatus('live');
          }
          const ids = [...new Set(list.map((e) => e.uid))];
          if (ids.length)
            sh.user.profiles(ids).then((ps) => {
              if (!alive) return;
              setNames(Object.fromEntries(ids.map((id) => [id, ps[id]?.isMe ? `${ps[id].name || 'Você'} (você)` : ps[id]?.name || 'Jogador'])));
            });
        },
        () => {
          clearTimeout(timer);
          setStatus('offline');
        },
      );
    });
    return () => {
      alive = false;
      unsub?.();
      clearTimeout(timer);
    };
  }, []);

  const today = `diario:${brazilDateKey()}`;
  const week = `semanal:${brazilWeekKey()}`;

  // ranking global (conta com Supabase): o mesmo para todos os jogadores
  useEffect(() => {
    if (!cloudEnabled) return;
    let alive = true;
    setScope('global');
    void loadGlobalRanking({ today, week, dateKey: brazilDateKey(), weekKey: brazilWeekKey() }).then((list) => {
      if (!alive) return;
      if (list) {
        setGlobal(list);
        setGlobalStatus('live');
        const best = bestPositionByDifficulty(list);
        if (best) onRankingPosition(best.position, best.runId);
      } else setGlobalStatus('offline');
    });
    return () => {
      alive = false;
    };
  }, [today, week]);

  const source: (RankingEntry & { uid?: string; who?: string; title?: string | null; isMe?: boolean })[] = scope === 'global' ? global : scope === 'shared' ? shared : local;
  const inFilter = source.filter((e) => {
    if (filter === 'geral') return true;
    if (filter === 'diario') return e.challengeKey === today;
    if (filter === 'semanal') return e.challengeKey === week;
    return e.mode === filter;
  });
  const diffTabs = hasDiffTabs(filter);
  // cada dificuldade tem o próprio ranking: Normal, Difícil e Lendário não se misturam
  const list = diffTabs ? inFilter.filter((e) => e.difficulty === diff) : inFilter;
  const diffLabel = DIFFS.find(([d]) => d === diff)![1];
  type Entry = (typeof source)[number];
  const whoOf = (e: Entry) => (scope === 'global' ? (e.who ?? 'Jogador') : e.uid ? (names[e.uid] ?? 'Jogador') : localName(e));
  const mineOf = (e: Entry) => (scope === 'global' ? !!e.isMe : !e.uid && isMine(e));
  const titleOf = (e: Entry) => (scope === 'global' ? (e.title ?? null) : undefined);
  const linkOf = (e: Entry) =>
    scope === 'global' ? `/campanha/${e.id}` : scope === 'local' && history.some((h) => h.runId === e.id) ? `/temporada/${e.id}` : null;
  // o 1º colocado de cada dificuldade (a lista já vem ordenada pelos critérios do ranking)
  const leaders = DIFFS.map(([d, label]) => ({ d, label, e: inFilter.find((x) => x.difficulty === d) ?? null }));

  const boardTabs = (
    <div className="tabs" role="tablist" aria-label="Tipo de ranking" style={{ marginBottom: 14 }}>
      <button className="tab" role="tab" aria-selected={board === 'campanhas'} onClick={() => navigate('/ranking', { replace: true })}>
        Campanhas
      </button>
      <button className="tab" role="tab" aria-selected={board === 'conquistas'} onClick={() => navigate('/ranking-conquistas', { replace: true })}>
        Conquistas
      </button>
    </div>
  );

  if (board === 'conquistas')
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <div className="eyebrow">Quem tem mais medalhas</div>
            <h1>Ranking</h1>
            <p className="muted">Bronze vale 1 ponto, prata 2, ouro 3 e lendária 5.</p>
          </div>
          <BackLink to="/" />
        </div>
        {boardTabs}
        <AchievementRanking />
      </div>
    );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Melhores campanhas</div>
          <h1>Ranking</h1>
          <p className="muted">Critérios: pontos, vitórias, saldo de gols e gols marcados.</p>
        </div>
        <BackLink to="/" />
      </div>
      {boardTabs}

      {cloudEnabled && (
        <div className="row wrap" style={{ marginBottom: 10 }}>
          <div className="tabs" role="tablist" aria-label="Quais campanhas">
            <button className="tab" role="tab" aria-selected={scope === 'global'} onClick={() => setScope('global')}>
              Todos os jogadores
            </button>
            <button className="tab" role="tab" aria-selected={scope === 'local'} onClick={() => setScope('local')}>
              Neste aparelho
            </button>
          </div>
          {scope === 'global' && globalStatus !== 'live' && (
            <span className="chip">{globalStatus === 'loading' ? 'Carregando…' : 'Ranking de todos indisponível agora'}</span>
          )}
        </div>
      )}
      {cloudEnabled && scope === 'global' && <p className="dim" style={{ marginBottom: 10, fontSize: 13 }}>Temporadas finalizadas de todos os jogadores com conta. Entre com Google para aparecer aqui.</p>}
      {!cloudEnabled && sharedOn && (
        <div className="row wrap" style={{ marginBottom: 10 }}>
          <div className="tabs" role="tablist" aria-label="Quais campanhas">
            <button className="tab" role="tab" aria-selected={scope === 'shared'} onClick={() => setScope('shared')}>
              Todos os jogadores
            </button>
            <button className="tab" role="tab" aria-selected={scope === 'local'} onClick={() => setScope('local')}>
              Neste aparelho
            </button>
          </div>
          {scope === 'shared' && (
            <span className={`chip ${status === 'live' ? 'chip-green' : ''}`}>
              {status === 'live' ? 'Ao vivo' : status === 'loading' ? 'Carregando…' : status === 'stale' ? 'Pode estar desatualizado' : 'Ranking compartilhado indisponível agora'}
            </span>
          )}
        </div>
      )}
      {(scope === 'local' || (!sharedOn && !cloudEnabled)) && <p className="dim" style={{ marginBottom: 10, fontSize: 13 }}>Ranking salvo neste dispositivo.</p>}

      <div className="tabs" style={{ marginBottom: diffTabs ? 10 : 14 }}>
        {FILTERS.map(([id, label]) => (
          <button key={id} className="tab" aria-selected={filter === id} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
      {diffTabs ? (
        <div className="row wrap diff-tabs" style={{ marginBottom: 14 }}>
          <span className="dim diff-tabs-label">Dificuldade</span>
          <div className="tabs" role="tablist" aria-label="Ranking por dificuldade">
            {DIFFS.map(([d, label]) => (
              <button key={d} className={`tab diff-tab diff-${d}`} role="tab" aria-selected={diff === d} onClick={() => setDiff(d)}>
                {label} <span className="dim">{inFilter.filter((e) => e.difficulty === d).length}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {diffTabs && leaders.some((l) => l.e) && (
        <div className="rank-leaders" aria-label="Líder de cada dificuldade">
          {leaders.map(({ d, label, e }) => (
            <button
              key={d}
              className={`rank-leader diff-${d} ${diff === d ? 'is-active' : ''}`}
              onClick={() => setDiff(d)}
              aria-pressed={diff === d}
              aria-label={e ? `Líder do ${label}: ${whoOf(e)}, ${e.points} pontos. Ver o ranking do ${label}` : `${label}: ninguém ainda`}
            >
              <span className="rank-leader-head">
                <span className="rank-leader-crown" aria-hidden="true">
                  👑
                </span>
                Líder · {label}
              </span>
              {e ? (
                <>
                  <span className="rank-leader-who">
                    <RankAvatar e={e} mine={mineOf(e)} title={titleOf(e)} size={40} />
                    <span className="rank-leader-name">
                      <strong>{whoOf(e)}</strong>
                      <span className="dim">{e.teamName}</span>
                    </span>
                  </span>
                  <span className="rank-leader-pts">
                    <strong>{e.points}</strong> pts · {e.wins}-{e.draws}-{e.losses}
                  </span>
                </>
              ) : (
                <span className="dim rank-leader-empty">Ninguém ainda. Seja o primeiro!</span>
              )}
            </button>
          ))}
        </div>
      )}
      {!diffTabs && (
        <p className="dim" style={{ marginTop: -6, marginBottom: 14, fontSize: 13 }}>
          {filter === 'diario' ? 'O Desafio Diário é sempre no nível Normal.' : 'O Desafio Semanal é sempre no nível Difícil.'}
        </p>
      )}
      {list.length === 0 ? (
        <div className="empty panel">
          {(scope === 'shared' && status === 'loading') || (scope === 'global' && globalStatus === 'loading')
            ? 'Carregando o ranking de todos os jogadores…'
            : diffTabs
              ? `Nenhuma campanha no nível ${diffLabel} ${filter === 'geral' ? 'ainda' : 'nesta categoria'}. Termine uma temporada nesse nível para entrar neste ranking.`
              : 'Nenhuma campanha registrada nesta categoria. Termine uma temporada para entrar no ranking.'}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>#</th>
                <th className="l">Técnico</th>
                <th className="l">Time</th>
                <th className="l">Modo</th>
                <th>Pts</th>
                <th>V-E-D</th>
                <th>SG</th>
                <th>Pos.</th>
                <th className="l">Feitos</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 200).map((e, i) => (
                <Row key={`${scope}-${e.uid ?? ''}-${e.id}`} e={e} i={i} who={whoOf(e)} mine={mineOf(e)} title={titleOf(e)} to={linkOf(e)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ e, i, who, mine, title, to }: { e: RankingEntry; i: number; who: string; mine: boolean; title?: string | null; to: string | null }) {
  const club = e.clubId ? CLUB_BY_ID[e.clubId] : null;
  const open = to ? () => navigate(to) : undefined;
  return (
    <tr
      className={to ? 'is-link' : undefined}
      onClick={open}
      onKeyDown={to ? (ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), open!()) : undefined}
      tabIndex={to ? 0 : undefined}
      role={to ? 'link' : undefined}
      aria-label={to ? `Ver a campanha de ${who}: ${e.teamName}, ${e.points} pontos` : undefined}
      title={to ? 'Ver perfil e escalação' : undefined}
    >
      <td className="stat-num">{i + 1}</td>
      <td className="l">
        <span className="rank-who">
          <RankAvatar e={e} mine={mine} title={title} size={34} />
          <span className="rank-who-name">
            <strong>{who}</strong>
            {mine ? <StaffBadge small /> : title ? <StaffBadge small title={title} /> : null}
          </span>
        </span>
      </td>
      <td className="l">
        <span className="team-name">
          {club ? <Crest club={club} size={18} /> : <LogoMark size={16} />} {e.teamName}
        </span>
        <div className="dim" style={{ fontSize: 12 }}>
          {e.formationId} · capitão {e.captain} · OVR {e.overall}
        </div>
      </td>
      <td className="l">
        {e.modeLabel}
        <div className="dim" style={{ fontSize: 12 }}>
          {e.difficulty === 'normal' ? 'Normal' : e.difficulty === 'dificil' ? 'Difícil' : 'Lendário'}
        </div>
      </td>
      <td className="stat-num">{e.points}</td>
      <td>
        {e.wins}-{e.draws}-{e.losses}
      </td>
      <td>{e.gf - e.ga}</td>
      <td>{e.position}º</td>
      <td className="l">
        {e.perfect && <span title="Temporada perfeita">⭐</span>}
        {e.champion && <span title="Campeão">🏆</span>}
        {e.triple && <span title="Tríplice Coroa">👑</span>}
      </td>
      <td className="dim">{new Date(e.date).toLocaleDateString('pt-BR')}</td>
    </tr>
  );
}

function RankAvatar({ e, mine, title, size }: { e: RankingEntry; mine: boolean; title?: string | null; size: number }) {
  if (mine) return <UserAvatar size={size} />;
  if (title && isOwnerAvatar(e.avatar)) return <img className="pavatar" src={ownerAvatarUrl()} width={size} height={size} alt="" />;
  return <PlayerFaceByKey cardKey={e.avatar} size={size} />;
}
