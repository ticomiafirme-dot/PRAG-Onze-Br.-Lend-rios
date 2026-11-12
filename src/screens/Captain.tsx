import { useMemo } from 'react';
import { db } from '../data/db';
import { getFormation } from '../data/formations';
import { POSITION_NAMES } from '../data/types';
import { computeChemistry } from '../engine/chemistry';
import { navigate } from '../router';
import { lineupOf, useGame } from '../state/store';
import { PlayerCard } from '../components/PlayerCard';
import { BackLink, NeedRun, chemColor } from '../components/ui';

export function Captain() {
  const run = useGame((s) => s.run);
  return (
    <NeedRun ok={!!run?.draft && Object.keys(run.draft.picks).length === 11 && !run.campaign}>
      <CaptainInner />
    </NeedRun>
  );
}

function CaptainInner() {
  const run = useGame((s) => s.run)!;
  const setCaptain = useGame((s) => s.setCaptain);
  const confirmCaptain = useGame((s) => s.confirmCaptain);
  const formation = getFormation(run.formationId!);
  const lineup = lineupOf(run);
  const base = useMemo(() => computeChemistry(db, run.formationId!, lineup, null).team, []); // eslint-disable-line react-hooks/exhaustive-deps
  const withCap = useMemo(
    () => (run.captainSlot ? computeChemistry(db, run.formationId!, lineup, run.captainSlot).team : null),
    [run.captainSlot], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const cap = run.captainSlot ? lineup[run.captainSlot] : null;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Passo 5</div>
          <h1>Escolha o capitão</h1>
          <p className="muted">O capitão recebe +3 de overall, usa a faixa e suas ligações de química contam em dobro.</p>
        </div>
        <BackLink to="/escalacao" label="Escalação" />
      </div>

      <div className="captain-grid">
        {formation.slots.map((s, i) => {
          const card = lineup[s.id];
          const selected = run.captainSlot === s.id;
          return (
            <PlayerCard
              key={s.id}
              card={card}
              pos={s.pos}
              captain={selected}
              selected={selected}
              overall={selected ? Math.min(99, card.overall + 3) : card.overall}
              onClick={() => setCaptain(s.id)}
              delay={i * 40}
              note={POSITION_NAMES[s.pos]}
            />
          );
        })}
      </div>

      <div className="panel captain-summary">
        {cap ? (
          <>
            <div>
              <div className="eyebrow">Capitão escolhido</div>
              <h2>{cap.player.name}</h2>
              <p className="muted">
                Overall {cap.overall} → <strong className="gold-text">{Math.min(99, cap.overall + 3)}</strong> · Química do time {base} →{' '}
                <strong style={{ color: chemColor(withCap ?? 0, 100) }}>{withCap}</strong>
              </p>
            </div>
            <button
              className="btn btn-gold btn-lg"
              onClick={() => {
                confirmCaptain();
                navigate('/pre-temporada');
              }}
            >
              Ir para a pré-temporada →
            </button>
          </>
        ) : (
          <p className="muted">Toque em um jogador para entregar a faixa de capitão.</p>
        )}
      </div>
    </div>
  );
}
