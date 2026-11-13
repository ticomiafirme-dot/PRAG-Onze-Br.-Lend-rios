import { useEffect, useMemo, useState } from 'react';
import { CLUB_BY_ID } from '../data/clubs';
import { loadRanking, type RankingEntry } from '../state/storage';
import { flattenShared, getSharedRanking, type SharedEntry } from '../state/sharedRanking';
import { brazilDateKey, brazilWeekKey } from '../engine/challenges';
import { Crest } from '../components/Crest';
import { LogoMark } from '../components/Logo';
import { BackLink } from '../components/ui';
import { useAuth } from '../cloud/auth';

type Filter = 'geral' | 'diario' | 'semanal' | 'classico' | 'era' | 'mistura' | 'triplice';
type Scope = 'shared' | 'local';
type Status = 'idle' | 'loading' | 'live' | 'stale' | 'offline';

const FILTERS: [Filter, string][] = [
  ['geral', 'Geral'],
  ['diario', 'Desafio de hoje'],
  ['semanal', 'Desafio da semana'],
  ['classico', 'Clássico'],
  ['era', 'Era Única'],
  ['mistura', 'Mistura'],
  ['triplice', 'Tríplice Coroa'],
];

export function Ranking() {
  const [filter, setFilter] = useState<Filter>('geral');
  const [scope, setScope] = useState<Scope>('local');
  const [sharedOn, setSharedOn] = useState(false);
  const [shared, setShared] = useState<SharedEntry[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const me = useAuth((s) => (s.status === 'signed-in' ? s.user : null));
  /** Nome exibido numa campanha deste aparelho: o nick atual da conta, quando é de quem está conectado. */
  const localName = (e: RankingEntry): string => {
    if (me && e.accountId === me.id) return me.name;
    if (me && !e.accountId && (!e.playerName || e.playerName === 'Anônimo')) return me.name;
    return e.playerName || 'Anônimo';
  };
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
  const source: (RankingEntry & { uid?: string })[] = scope === 'shared' ? shared : local;
  const list = source.filter((e) => {
    if (filter === 'geral') return true;
    if (filter === 'diario') return e.challengeKey === today;
    if (filter === 'semanal') return e.challengeKey === week;
    return e.mode === filter;
  });

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

      {sharedOn && (
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
      {!sharedOn && <p className="dim" style={{ marginBottom: 10, fontSize: 13 }}>Ranking salvo neste dispositivo.</p>}

      <div className="tabs" style={{ marginBottom: 14 }}>
        {FILTERS.map(([id, label]) => (
          <button key={id} className="tab" aria-selected={filter === id} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="empty panel">
          {scope === 'shared' && status === 'loading'
            ? 'Carregando o ranking de todos os jogadores…'
            : `Nenhuma campanha registrada ${filter === 'geral' ? 'ainda' : 'nesta categoria'}. Termine uma temporada para entrar no ranking.`}
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
                <Row key={`${e.uid ?? 'local'}-${e.id}`} e={e} i={i} who={e.uid ? (names[e.uid] ?? 'Jogador') : localName(e)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ e, i, who }: { e: RankingEntry; i: number; who: string }) {
  const club = e.clubId ? CLUB_BY_ID[e.clubId] : null;
  return (
    <tr>
      <td className="stat-num">{i + 1}</td>
      <td className="l">
        <strong>{who}</strong>
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
