import { useEffect, useMemo, useState } from 'react';
import { CLUB_BY_ID, CLUBS } from '../data/clubs';
import { db } from '../data/db';
import { decadeLabel, POSITION_NAMES, type Card } from '../data/types';
import { getFormation, type Slot } from '../data/formations';
import { isDraftComplete, openSlots, slotsWithOffers } from '../engine/draft';
import { computeChemistry } from '../engine/chemistry';
import { navigate } from '../router';
import { lineupOf, MODE_INFO, useGame } from '../state/store';
import { Pitch } from '../components/Pitch';
import { PlayerCard } from '../components/PlayerCard';
import { Crest } from '../components/Crest';
import { NeedRun, chemColor, useToast } from '../components/ui';

export function Draft() {
  const run = useGame((s) => s.run);
  return (
    <NeedRun ok={!!run?.draft}>
      <DraftInner />
    </NeedRun>
  );
}

function DraftInner() {
  const run = useGame((s) => s.run)!;
  const reroll = useGame((s) => s.reroll);
  const pickCard = useGame((s) => s.pickCard);
  const draft = run.draft!;
  const formation = getFormation(draft.config.formationId);
  const [toast, showToast] = useToast();
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [lastPicked, setLastPicked] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(true);

  const draw = draft.draw;
  const drawKey = `${draft.history.length}-${draft.rerollsLeft}`;
  const offerSlots = slotsWithOffers(draft);
  const complete = isDraftComplete(draft);

  // animação de sorteio a cada nova rodada / novo sorteio
  useEffect(() => {
    setSpinning(true);
    const t = setTimeout(() => setSpinning(false), 1100);
    return () => clearTimeout(t);
  }, [drawKey]);

  // posição ativa: a primeira (do goleiro ao ataque) com opções
  useEffect(() => {
    if (!draw) return;
    if (!activeSlot || !draw.offers[activeSlot]) setActiveSlot(offerSlots[0]?.id ?? null);
  }, [drawKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (complete) {
      const t = setTimeout(() => navigate('/escalacao'), 1400);
      return () => clearTimeout(t);
    }
  }, [complete]);

  const lineup = lineupOf(run);
  const chem = useMemo(() => computeChemistry(db, draft.config.formationId, lineup, null), [draft.picks]); // eslint-disable-line react-hooks/exhaustive-deps
  const avg = Object.values(lineup).length ? Math.round(Object.values(lineup).reduce((a, c) => a + c.overall, 0) / Object.values(lineup).length) : 0;

  // posição ativa efetiva (síncrona): a escolhida, se tiver opções; senão a primeira com opções
  const effectiveSlot = activeSlot && draw?.offers[activeSlot] ? activeSlot : (offerSlots[0]?.id ?? null);
  const active = formation.slots.find((s) => s.id === effectiveSlot) ?? null;
  const offers: Card[] = active && draw ? (draw.offers[active.id] ?? []).map((k) => db.card(k)) : [];

  const doPick = (card: Card) => {
    if (!active) return;
    try {
      pickCard(card.key, active.id);
      setLastPicked(active.id);
      showToast(`${card.player.name} escalado como ${POSITION_NAMES[active.pos].toLowerCase()}!`);
      setActiveSlot(null);
      // no celular, volta para o painel do sorteio
      if (window.innerWidth < 900) {
        const el = document.querySelector('.draw-panel');
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' });
      }
    } catch (e) {
      showToast((e as Error).message);
    }
  };

  const club = draw ? CLUB_BY_ID[draw.clubId] : null;
  const decadesPool = run.mode === 'mistura' ? CLUBS.flatMap((c) => c.decades.map((d) => `${c.short} ${d}`)) : db.decadesOf(draft.config.clubId!).map((d) => d);
  const fixedDecade = !!draft.config.decade;

  return (
    <div className="page draft-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">
            {MODE_INFO[run.mode].name}
            {run.challenge ? ` · ${run.challenge.label}` : ''} · {formation.name}
          </div>
          <h1>Draft</h1>
        </div>
        <div className="draft-progress">
          <span className="big-stat">
            <span className="v">{Math.min(11, draft.history.length + (complete ? 0 : 1))}/11</span>
            <span className="k">Rodada</span>
          </span>
          <span className="big-stat">
            <span className="v">{avg || '—'}</span>
            <span className="k">Overall</span>
          </span>
          <span className="big-stat">
            <span className="v" style={{ color: chemColor(chem.team, 100) }}>
              {Object.keys(lineup).length > 1 ? chem.team : '—'}
            </span>
            <span className="k">Química</span>
          </span>
        </div>
      </div>

      <div className="draft-layout offers-first">
        <div className="draft-pitch">
          <Pitch
            formationId={draft.config.formationId}
            links={chem.links}
            renderSlot={(s: Slot) => {
              const key = draft.picks[s.id];
              if (key) {
                const card = db.card(key);
                return (
                  <div className={lastPicked === s.id ? 'slot-filled' : ''}>
                    <PlayerCard card={card} size="sm" pos={s.pos} />
                    <span className="slot-chem" style={{ background: chemColor(chem.player[s.id] ?? 0) }}>
                      {chem.player[s.id] ?? 0}
                    </span>
                  </div>
                );
              }
              const has = !!draw?.offers[s.id];
              return (
                <button
                  className={`slot-empty ${has ? 'has-offer' : ''} ${effectiveSlot === s.id ? 'is-active' : ''}`}
                  onClick={() => has && setActiveSlot(s.id)}
                  disabled={!has}
                  aria-label={`${POSITION_NAMES[s.pos]}${has ? ' — com opções nesta década' : ''}`}
                >
                  {s.pos}
                </button>
              );
            }}
          />
        </div>

        <div className="draft-side">
          {complete ? (
            <div className="panel draft-done">
              <div className="eyebrow">Elenco completo</div>
              <h2>11 lendas escaladas!</h2>
              <p className="muted">Vamos à escalação para ajustar posições, ver a química e escolher o capitão.</p>
              <button className="btn btn-gold btn-lg" onClick={() => navigate('/escalacao')}>
                Ver escalação
              </button>
            </div>
          ) : (
            <>
              <div className="panel draw-panel">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="eyebrow" style={{ margin: 0 }}>
                    {fixedDecade ? 'Era fixa · jogadores sorteados' : run.mode === 'mistura' ? 'Clube e década sorteados' : 'Década sorteada'}
                  </span>
                  <span className="rerolls" aria-label={`${draft.rerollsLeft} novos sorteios restantes`}>
                    {Array.from({ length: draft.config.rerolls }).map((_, i) => (
                      <i key={i} className={i < draft.rerollsLeft ? 'on' : ''} />
                    ))}
                  </span>
                </div>
                <Roulette spinning={spinning} pool={decadesPool} final={draw ? (run.mode === 'mistura' ? `${club?.short} ${draw.decade}` : draw.decade) : ''} />
                {draw && club && (
                  <div className="draw-result">
                    <Crest club={club} size={34} />
                    <div>
                      <strong>
                        {club.name} · {decadeLabel(draw.decade)}
                      </strong>
                      <div className="dim">
                        {offerSlots.length} posição(ões) com opções · {Object.values(draw.offers).reduce((a, o) => a + o.length, 0)} jogadores elegíveis
                      </div>
                    </div>
                  </div>
                )}
                <button className="btn btn-ghost btn-block" onClick={reroll} disabled={draft.rerollsLeft === 0 || spinning}>
                  {fixedDecade ? 'Sortear outros jogadores' : 'Sortear novamente'} ({draft.rerollsLeft})
                </button>
              </div>

              <div className="panel offers-panel">
                <div className="row wrap" style={{ justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div className="eyebrow" style={{ margin: 0 }}>
                      Posição disponível
                    </div>
                    <h2 style={{ fontSize: 26 }}>{active ? `${POSITION_NAMES[active.pos]} (${active.pos})` : '—'}</h2>
                  </div>
                </div>
                <div className="tabs" style={{ margin: '8px 0 12px' }} role="tablist" aria-label="Posições com opções">
                  {offerSlots.map((s) => (
                    <button key={s.id} role="tab" className="tab" aria-selected={effectiveSlot === s.id} onClick={() => setActiveSlot(s.id)}>
                      {s.pos}
                      <span className="dim"> {draw!.offers[s.id].length}</span>
                    </button>
                  ))}
                </div>
                {spinning ? (
                  <div className="offers-loading">Sorteando…</div>
                ) : offers.length ? (
                  <div className="offers">
                    {offers.map((c, i) => (
                      <PlayerCard key={c.key} card={c} pos={active!.pos} onClick={() => doPick(c)} delay={i * 70} showClub={run.mode === 'mistura'} />
                    ))}
                  </div>
                ) : (
                  <div className="empty">Nenhum jogador desta década para as posições livres. Use um novo sorteio.</div>
                )}
                <p className="dim" style={{ fontSize: 13, marginTop: 10 }}>
                  Toque em uma posição dourada no campo para ver outras opções desta década. {openSlots(draft).length} posições livres.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
      {toast}
    </div>
  );
}

function Roulette({ spinning, pool, final }: { spinning: boolean; pool: string[]; final: string }) {
  const [shown, setShown] = useState(final);
  useEffect(() => {
    if (!spinning || pool.length === 0) {
      setShown(final);
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      setShown(pool[Math.floor(Math.random() * pool.length)]);
      i++;
    }, 70);
    return () => clearInterval(id);
  }, [spinning, final, pool]);
  const label = (s: string) => s.replace(/(\d{4})s/, (_, y) => `Anos ${String(y).slice(2)}`);
  return (
    <div className={`roulette ${spinning ? 'is-spinning' : 'is-done'}`} aria-live="polite">
      <span key={spinning ? 'spin' : final}>{label(shown || final)}</span>
    </div>
  );
}
