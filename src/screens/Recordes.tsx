import { useMemo } from 'react';
import { decadesLabel } from '../history/record';
import { personalRecords, RECORD_GROUPS } from '../history/records';
import { useHistory } from '../history/store';
import { fmtDate, SeasonCrest } from '../components/SeasonViews';
import { AccountBanner } from '../components/Account';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/icons';

const GROUP_ICON: Record<string, IconName> = { campanha: 'chart', ofensivo: 'ball', defensivo: 'wall', elenco: 'team' };

export function Recordes() {
  const seasons = useHistory((s) => s.data.seasons);
  const records = useMemo(() => personalRecords(seasons), [seasons]);
  const finished = seasons.filter((s) => s.status === 'finished').length;

  return (
    <div className="page records-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Sua melhor versão</div>
          <h1>Meus Recordes</h1>
          <p className="muted">
            Os melhores números de todas as suas temporadas{finished ? ` (${finished} ${finished === 1 ? 'finalizada' : 'finalizadas'})` : ''}. Quando você supera um recorde, ele é
            atualizado na hora e guarda a temporada em que foi alcançado.
          </p>
        </div>
      </div>
      <AccountBanner />
      {!finished && (
        <div className="empty panel">
          Termine sua primeira temporada para começar a registrar recordes. <a href="#inicio">Jogar agora</a>
        </div>
      )}
      {RECORD_GROUPS.map((g) => (
        <section key={g.id} className="section">
          <h2 className="section-title records-title">
            <Icon name={GROUP_ICON[g.id]} size={22} /> {g.label}
          </h2>
          <div className="records-grid">
            {records
              .filter((r) => r.group === g.id)
              .map((r) => (
                <article key={r.id} className={`record-card ${r.value ? '' : 'is-empty'}`}>
                  <div className="record-label">{r.label}</div>
                  <div className="record-value">{r.value ?? '—'}</div>
                  {r.detail && <div className="record-detail">{r.detail}</div>}
                  {r.season ? (
                    <a className="record-season" href={`#temporada-${r.season.runId}`}>
                      <SeasonCrest season={r.season} size={24} />
                      <span>
                        <strong>{r.season.teamName}</strong>
                        <span className="dim">
                          {decadesLabel(r.season) || '—'} · {r.season.formationId} · {fmtDate(r.season.finishedAt ?? r.season.startedAt)}
                        </span>
                      </span>
                    </a>
                  ) : (
                    <div className="record-season dim">Ainda sem registro</div>
                  )}
                </article>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
