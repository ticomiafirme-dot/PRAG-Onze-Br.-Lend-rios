import { useMemo, useState } from 'react';
import { useHistory } from '../history/store';
import { resumeRoute, useGame } from '../state/store';
import { navigate } from '../router';
import { AccountBanner } from '../components/Account';
import { SeasonCard } from '../components/SeasonViews';
import { describeRun } from '../cloud/sync';

type Filter = 'todas' | 'finalizadas' | 'andamento' | 'abandonadas';

export function Historico() {
  const seasons = useHistory((s) => s.data.seasons);
  const run = useGame((s) => s.run);
  const [filter, setFilter] = useState<Filter>('todas');

  const list = useMemo(
    () =>
      [...seasons]
        .filter((s) => (filter === 'todas' ? true : filter === 'finalizadas' ? s.status === 'finished' : filter === 'andamento' ? s.status === 'in_progress' : s.status === 'abandoned'))
        .sort((a, b) => (b.finishedAt ?? b.startedAt).localeCompare(a.finishedAt ?? a.startedAt)),
    [seasons, filter],
  );
  const finished = seasons.filter((s) => s.status === 'finished').length;
  const current = run && !run.campaign?.finished ? run : null;

  return (
    <div className="page history-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Sua trajetória</div>
          <h1>Meu Histórico</h1>
          <p className="muted">
            {seasons.length} {seasons.length === 1 ? 'temporada disputada' : 'temporadas disputadas'} · {finished} {finished === 1 ? 'finalizada' : 'finalizadas'}. Cada temporada
            finalizada fica registrada para sempre.
          </p>
        </div>
      </div>
      <AccountBanner />
      {current && (
        <div className="panel current-run">
          <div>
            <div className="eyebrow" style={{ margin: 0 }}>
              Em andamento
            </div>
            <strong>{describeRun(current)}</strong>
          </div>
          <button className="btn btn-gold" onClick={() => navigate(resumeRoute(current))}>
            Continuar
          </button>
        </div>
      )}
      <div className="tabs" role="tablist" aria-label="Filtrar temporadas" style={{ margin: '14px 0' }}>
        {(
          [
            ['todas', 'Todas'],
            ['finalizadas', 'Finalizadas'],
            ['andamento', 'Em andamento'],
            ['abandonadas', 'Abandonadas'],
          ] as [Filter, string][]
        ).map(([f, label]) => (
          <button key={f} role="tab" className="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>
            {label}
          </button>
        ))}
      </div>
      {list.length ? (
        <div className="season-grid">
          {list.map((s) => (
            <SeasonCard key={s.runId} season={s} />
          ))}
        </div>
      ) : (
        <div className="empty panel">
          {seasons.length ? 'Nenhuma temporada neste filtro.' : 'Nenhuma temporada ainda. Monte seu time e dispute o Brasileirão para começar sua história.'}{' '}
          <a href="#inicio">Jogar</a>
        </div>
      )}
    </div>
  );
}
