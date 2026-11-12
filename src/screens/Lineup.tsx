import { useMemo, useState } from 'react';
import { db } from '../data/db';
import { POSITION_NAMES } from '../data/types';
import { getFormation } from '../data/formations';
import { computeChemistry, chemLabel } from '../engine/chemistry';
import { canPlay } from '../engine/database';
import { navigate } from '../router';
import { lineupOf, useGame, userSheet } from '../state/store';
import { Pitch, LINK_COLORS } from '../components/Pitch';
import { PlayerCard } from '../components/PlayerCard';
import { Meter, NeedRun, chemColor, useToast } from '../components/ui';
import { Flag, NATIONALITY_NAMES } from '../components/Flag';
import { CLUB_BY_ID } from '../data/clubs';

export function Lineup() {
  const run = useGame((s) => s.run);
  return (
    <NeedRun ok={!!run?.draft && Object.keys(run.draft.picks).length === 11}>
      <LineupInner />
    </NeedRun>
  );
}

export function SectorBars({ ratings }: { ratings: { attack: number; midfield: number; defense: number; goalkeeping: number } }) {
  const rows: [string, number][] = [
    ['Ataque', ratings.attack],
    ['Meio-campo', ratings.midfield],
    ['Defesa', ratings.defense],
    ['Goleiro', ratings.goalkeeping],
  ];
  return (
    <div className="stack" style={{ gap: 8 }}>
      {rows.map(([k, v]) => (
        <div key={k} className="sector-row">
          <span className="sector-k">{k}</span>
          <div className="grow">
            <Meter value={v - 50} max={50} color="linear-gradient(90deg, #2563d6, #ffcf1f)" />
          </div>
          <span className="stat-num">{v.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

function LineupInner() {
  const run = useGame((s) => s.run)!;
  const swapSlots = useGame((s) => s.swapSlots);
  const confirmLineup = useGame((s) => s.confirmLineup);
  const [source, setSource] = useState<string | null>(null);
  const [toast, showToast] = useToast();
  const formation = getFormation(run.formationId!);
  const lineup = lineupOf(run);
  const chem = useMemo(() => computeChemistry(db, run.formationId!, lineup, run.captainSlot), [run.draft!.picks, run.captainSlot]); // eslint-disable-line react-hooks/exhaustive-deps
  const sheet = useMemo(() => userSheet(run), [run.draft!.picks, run.captainSlot]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSlot = (slotId: string) => {
    if (!source) {
      setSource(slotId);
      return;
    }
    if (source === slotId) {
      setSource(null);
      return;
    }
    const ok = swapSlots(source, slotId);
    const a = lineup[source];
    const b = lineup[slotId];
    if (ok) showToast(`${a.player.name} e ${b.player.name} trocaram de posição.`);
    else showToast('Troca inválida: cada jogador só atua na sua categoria (GOL, DEF, MEI ou ATA).');
    setSource(null);
  };

  const sourceCard = source ? lineup[source] : null;
  const nations = Object.values(lineup).reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.player.nationality]: (acc[c.player.nationality] ?? 0) + 1 }), {});
  const decades = Object.values(lineup).reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.decade]: (acc[c.decade] ?? 0) + 1 }), {});

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Passo 4 · {formation.name}</div>
          <h1>Escalação</h1>
          <p className="muted">Toque em dois jogadores para trocá-los de vaga. Jogadores da mesma categoria podem trocar livremente.</p>
        </div>
        <button
          className="btn btn-gold btn-lg"
          onClick={() => {
            confirmLineup();
            navigate('/capitao');
          }}
        >
          Escolher capitão →
        </button>
      </div>

      <div className="draft-layout">
        <div className="draft-pitch">
          <Pitch
            formationId={run.formationId!}
            links={chem.links}
            renderSlot={(s) => {
              const card = lineup[s.id];
              const eligible = sourceCard && source !== s.id && canPlay(sourceCard, s.pos) && canPlay(card, formation.slots.find((x) => x.id === source)!.pos);
              return (
                <button
                  className={`slot-btn ${source === s.id ? 'is-swap-source' : ''} ${eligible ? 'is-swap-target' : ''}`}
                  onClick={() => onSlot(s.id)}
                  aria-label={`${card.player.name}, ${POSITION_NAMES[s.pos]}`}
                >
                  <PlayerCard card={card} size="sm" pos={s.pos} captain={run.captainSlot === s.id} />
                  <span className="slot-chem" style={{ background: chemColor(chem.player[s.id] ?? 0) }}>
                    {chem.player[s.id]}
                  </span>
                </button>
              );
            }}
          />
        </div>
        <div className="draft-side stack">
          <div className="panel">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="big-stat">
                <span className="v">{sheet.ratings.overall}</span>
                <span className="k">Overall</span>
              </div>
              <div className="big-stat" style={{ alignItems: 'flex-end' }}>
                <span className="v" style={{ color: chemColor(chem.team, 100) }}>
                  {chem.team}
                </span>
                <span className="k">Química · {chemLabel(chem.team)}</span>
              </div>
            </div>
            <div style={{ margin: '10px 0 14px' }}>
              <Meter value={chem.team} />
            </div>
            <SectorBars ratings={sheet.ratings} />
          </div>
          <div className="panel">
            <h3 style={{ fontSize: 20, marginBottom: 8 }}>Como a química funciona</h3>
            <ul className="legend">
              <li>
                <i style={{ background: LINK_COLORS[3] }} /> 3 pontos: mesmo clube, mesma década e mesma nacionalidade
              </li>
              <li>
                <i style={{ background: LINK_COLORS[2] }} /> 2 pontos: dois critérios em comum
              </li>
              <li>
                <i style={{ background: LINK_COLORS[1] }} /> 1 ponto: um critério em comum
              </li>
              <li>
                <i style={{ background: LINK_COLORS[0] }} /> 0: nenhum vínculo
              </li>
            </ul>
            <p className="dim" style={{ fontSize: 13, marginTop: 8 }}>
              Química individual alta (9–10) dá +2 de overall; baixa (0–1) tira 2. A química do time ainda soma até ±2,5 em cada setor.
            </p>
            <div className="row wrap" style={{ marginTop: 10, gap: 6 }}>
              {Object.entries(decades).map(([d, n]) => (
                <span key={d} className="chip">
                  {d.slice(2)}: {n}
                </span>
              ))}
              {Object.entries(nations).map(([n, c]) => (
                <span key={n} className="chip">
                  <Flag code={n} size={10} /> {NATIONALITY_NAMES[n] ?? n}: {c}
                </span>
              ))}
              {[...new Set(Object.values(lineup).map((c) => c.club))].length > 1 &&
                [...new Set(Object.values(lineup).map((c) => c.club))].map((c) => (
                  <span key={c} className="chip">
                    {CLUB_BY_ID[c].short}
                  </span>
                ))}
            </div>
          </div>
        </div>
      </div>
      {toast}
    </div>
  );
}
