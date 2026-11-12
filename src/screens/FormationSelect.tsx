import { useMemo } from 'react';
import { CLUB_BY_ID } from '../data/clubs';
import { db } from '../data/db';
import { decadeLabel, POSITION_PLURAL, POSITIONS } from '../data/types';
import { FORMATIONS, formationCounts, type Formation } from '../data/formations';
import { feasibleFormationsForClub, feasibleFormationsForDecade } from '../engine/draft';
import { DIFFICULTIES } from '../engine/team';
import { navigate } from '../router';
import { MODE_INFO, useGame } from '../state/store';
import { Crest } from '../components/Crest';
import { BackLink, NeedRun } from '../components/ui';

export function FormationSelect() {
  const run = useGame((s) => s.run);
  return (
    <NeedRun ok={!!run && (run.mode === 'mistura' || !!run.clubId)}>
      <FormationInner />
    </NeedRun>
  );
}

function FormationInner() {
  const run = useGame((s) => s.run)!;
  const chooseFormation = useGame((s) => s.chooseFormation);
  const chooseDifficulty = useGame((s) => s.chooseDifficulty);
  const startDraft = useGame((s) => s.startDraft);
  const club = run.clubId ? CLUB_BY_ID[run.clubId] : null;

  const feasible = useMemo(() => {
    const all = FORMATIONS.map((f) => f.id);
    if (run.mode === 'mistura' || !run.clubId) return new Set(all);
    if (run.decade) return new Set(feasibleFormationsForDecade(db, run.clubId, run.decade, all));
    return new Set(feasibleFormationsForClub(db, run.clubId, all));
  }, [run.mode, run.clubId, run.decade]);

  const start = () => {
    startDraft();
    navigate('/draft');
  };

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <div>
          <div className="eyebrow">
            {MODE_INFO[run.mode].name} · passo {run.mode === 'mistura' ? 1 : 3}
          </div>
          <h1>Formação tática</h1>
          <div className="row wrap" style={{ marginTop: 8 }}>
            {club ? (
              <span className="chip">
                <Crest club={club} size={14} /> {club.name}
              </span>
            ) : (
              <span className="chip">Clube e década sorteados a cada rodada</span>
            )}
            {club && <span className="chip">{run.decade ? `Era Única · ${decadeLabel(run.decade)}` : 'Todas as décadas'}</span>}
          </div>
        </div>
        <BackLink to={club ? `/clube/${club.id}` : '/'} />
      </div>

      <div className="formation-grid">
        {FORMATIONS.map((f) => (
          <FormationCard key={f.id} f={f} selected={run.formationId === f.id} disabled={!feasible.has(f.id)} onClick={() => chooseFormation(f.id)} />
        ))}
      </div>

      <section className="section">
        <h2 className="section-title">Nível dos rivais</h2>
        <div className="difficulty-grid">
          {DIFFICULTIES.map((d) => (
            <button key={d.id} className={`difficulty ${run.difficulty === d.id ? 'is-selected' : ''}`} onClick={() => chooseDifficulty(d.id)}>
              <strong>{d.name}</strong>
              <span className="muted">{d.description}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="sticky-cta">
        <button className="btn btn-gold btn-lg btn-block" disabled={!run.formationId || !feasible.has(run.formationId)} onClick={start}>
          {run.formationId ? `Iniciar draft no ${run.formationId}` : 'Escolha uma formação'}
        </button>
      </div>
    </div>
  );
}

export function MiniFormation({ f }: { f: Formation }) {
  return (
    <svg viewBox="0 0 100 100" className="mini-formation" aria-hidden="true">
      <rect x="2" y="2" width="96" height="96" rx="6" fill="var(--pitch-2)" stroke="rgba(255,255,255,.4)" strokeWidth="1" />
      <line x1="2" y1="50" x2="98" y2="50" stroke="rgba(255,255,255,.35)" strokeWidth="1" />
      <circle cx="50" cy="50" r="10" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1" />
      {f.slots.map((s) => (
        <circle key={s.id} cx={s.x} cy={s.y} r="5" fill={s.pos === 'GOL' ? '#ffcf1f' : '#fff'} stroke="#0b1530" strokeWidth="1" />
      ))}
    </svg>
  );
}

function FormationCard({ f, selected, disabled, onClick }: { f: Formation; selected: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button className={`formation-card ${selected ? 'is-selected' : ''}`} onClick={onClick} disabled={disabled} aria-pressed={selected}>
      <MiniFormation f={f} />
      <div className="formation-info">
        <h3>{f.name}</h3>
        <strong className="gold-text">{f.tagline}</strong>
        <p className="muted">{disabled ? 'Esta era não tem jogadores para todas as vagas desta formação.' : f.description}</p>
        <div className="row wrap formation-counts" style={{ gap: 6 }}>
          {POSITIONS.map((p) => (
            <span key={p} className="chip" title={POSITION_PLURAL[p]}>
              {formationCounts(f)[p]} {p}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
