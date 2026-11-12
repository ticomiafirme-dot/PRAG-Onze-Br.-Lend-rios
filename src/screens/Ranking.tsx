import { useMemo, useState } from 'react';
import { CLUB_BY_ID } from '../data/clubs';
import { loadRanking, type RankingEntry } from '../state/storage';
import { brazilDateKey, brazilWeekKey } from '../engine/challenges';
import { Crest } from '../components/Crest';
import { LogoMark } from '../components/Logo';
import { BackLink } from '../components/ui';

type Filter = 'geral' | 'diario' | 'semanal' | 'classico' | 'era' | 'mistura' | 'triplice';

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
  const all = useMemo(() => loadRanking(), []);
  const today = `diario:${brazilDateKey()}`;
  const week = `semanal:${brazilWeekKey()}`;
  const list = all.filter((e) => {
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
          <p className="muted">Critérios: pontos, vitórias, saldo de gols e gols marcados. Ranking salvo neste dispositivo.</p>
        </div>
        <BackLink to="/" />
      </div>
      <div className="tabs" style={{ marginBottom: 14 }}>
        {FILTERS.map(([id, label]) => (
          <button key={id} className="tab" aria-selected={filter === id} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="empty panel">
          Nenhuma campanha registrada {filter === 'geral' ? 'ainda' : 'nesta categoria'}. Termine uma temporada para entrar no ranking.
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
              {list.map((e, i) => (
                <Row key={e.id} e={e} i={i} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ e, i }: { e: RankingEntry; i: number }) {
  const club = e.clubId ? CLUB_BY_ID[e.clubId] : null;
  return (
    <tr>
      <td className="stat-num">{i + 1}</td>
      <td className="l">
        <strong>{e.playerName}</strong>
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
