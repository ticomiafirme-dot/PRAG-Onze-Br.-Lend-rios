import { useEffect, useMemo, useState } from 'react';
import { CLUB_BY_ID, CLUBS } from '../data/clubs';
import { db } from '../data/db';
import { decadeLabel, POSITION_NAMES, POSITION_PLURAL, type Position } from '../data/types';
import { getFormation, type Slot } from '../data/formations';
import { allOffers, firstOpenSlot, isDraftComplete, openSlots, positionsWithOffers, type OfferEntry } from '../engine/draft';
import { computeChemistry } from '../engine/chemistry';
import { navigate } from '../router';
import { lineupOf, MODE_INFO, useGame } from '../state/store';
import { Pitch } from '../components/Pitch';
import { PlayerCard } from '../components/PlayerCard';
import { Crest } from '../components/Crest';
import { NeedRun, chemColor, useToast } from '../components/ui';

type Tab = Position | 'TODOS';

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
  // aba escolhida ("Todos" ou uma categoria) e, opcionalmente, a vaga tocada no campo
  const [activeTab, setActiveTab] = useState<Tab>('TODOS');
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [lastPicked, setLastPicked] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(true);

  const draw = draft.draw;
  const drawKey = `${draft.history.length}-${draft.rerollsLeft}`;
  const offerPositions = positionsWithOffers(draft);
  const complete = isDraftComplete(draft);

  // animação de sorteio a cada nova rodada / novo sorteio
  useEffect(() => {
    setSpinning(true);
    const t = setTimeout(() => setSpinning(false), 1100);
    return () => clearTimeout(t);
  }, [drawKey]);

  useEffect(() => {
    if (complete) {
      const t = setTimeout(() => navigate('/escalacao'), 1400);
      return () => clearTimeout(t);
    }
  }, [complete]);

  const lineup = lineupOf(run);
  const chem = useMemo(() => computeChemistry(db, draft.config.formationId, lineup, null), [draft.picks]); // eslint-disable-line react-hooks/exhaustive-deps
  const avg = Object.values(lineup).length ? Math.round(Object.values(lineup).reduce((a, c) => a + c.overall, 0) / Object.values(lineup).length) : 0;

  // aba efetiva (síncrona): a categoria escolhida, se ainda tiver opções; senão "Todos"
  const tab: Tab = activeTab !== 'TODOS' && offerPositions.includes(activeTab) ? activeTab : 'TODOS';
  const activeCat: Position | null = tab === 'TODOS' ? null : tab;
  const everyone = allOffers(db, draft);
  const offers: OfferEntry[] =
    activeCat && draw ? (draw.offers[activeCat] ?? []).map((key) => ({ key, pos: activeCat, also: [] })) : everyone;
  // vaga de destino: a tocada no campo (se livre e da categoria); senão a primeira livre da categoria
  const targetFor = (pos: Position): Slot | null =>
    formation.slots.find((s) => s.id === activeSlot && s.pos === pos && !draft.picks[s.id]) ?? firstOpenSlot(draft, pos);
  const target = activeCat ? targetFor(activeCat) : null;
  const openInCat = activeCat ? openSlots(draft).filter((s) => s.pos === activeCat).length : 0;

  const doPick = (offer: OfferEntry) => {
    const card = db.card(offer.key);
    const slot = targetFor(offer.pos);
    if (!slot) return;
    try {
      pickCard(card.key, slot.id);
      setLastPicked(slot.id);
      showToast(`${card.player.name} escalado como ${POSITION_NAMES[slot.pos].toLowerCase()}!`);
      setActiveTab('TODOS');
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
              const has = offerPositions.includes(s.pos);
              return (
                <button
                  className={`slot-empty ${has ? 'has-offer' : ''} ${target?.id === s.id ? 'is-active' : ''}`}
                  onClick={() => {
                    if (!has) return;
                    setActiveTab(s.pos);
                    setActiveSlot(s.id);
                  }}
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
                        {offerPositions.length} {offerPositions.length === 1 ? 'categoria' : 'categorias'} com opções ·{' '}
                        {everyone.length} jogadores elegíveis
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
                      {activeCat ? 'Categoria disponível' : 'Jogadores sorteados'}
                    </div>
                    <h2 style={{ fontSize: 26 }}>{activeCat ? `${POSITION_PLURAL[activeCat]} (${activeCat})` : 'Todos os jogadores'}</h2>
                    <div className="dim" style={{ fontSize: 13 }}>
                      {activeCat
                        ? `${openInCat} ${openInCat === 1 ? 'vaga livre' : 'vagas livres'} · o escolhido entra na vaga destacada no campo`
                        : 'Do maior para o menor overall · cada um entra numa vaga livre da sua categoria'}
                    </div>
                  </div>
                </div>
                <div className="tabs" style={{ margin: '8px 0 12px' }} role="tablist" aria-label="Jogadores por categoria">
                  {everyone.length > 0 && (
                    <button
                      role="tab"
                      className="tab"
                      aria-selected={tab === 'TODOS'}
                      title="Todos os jogadores sorteados"
                      onClick={() => {
                        setActiveTab('TODOS');
                        setActiveSlot(null);
                      }}
                    >
                      TODOS
                      <span className="dim"> {everyone.length}</span>
                    </button>
                  )}
                  {offerPositions.map((p) => (
                    <button
                      key={p}
                      role="tab"
                      className="tab"
                      aria-selected={tab === p}
                      title={POSITION_PLURAL[p]}
                      onClick={() => {
                        setActiveTab(p);
                        setActiveSlot(null);
                      }}
                    >
                      {p}
                      <span className="dim"> {draw!.offers[p]!.length}</span>
                    </button>
                  ))}
                </div>
                {spinning ? (
                  <div className="offers-loading">Sorteando…</div>
                ) : offers.length ? (
                  <div className="offers">
                    {offers.map((o, i) => (
                      <PlayerCard
                        key={o.key}
                        card={db.card(o.key)}
                        pos={o.pos}
                        note={o.also.length ? `também ${o.also.join('/')}` : undefined}
                        onClick={() => doPick(o)}
                        delay={Math.min(i, 12) * 50}
                        showClub={run.mode === 'mistura'}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty">Nenhum jogador desta década para as categorias livres. Use um novo sorteio.</div>
                )}
                <p className="dim" style={{ fontSize: 13, marginTop: 10 }}>
                  Qualquer jogador da categoria pode ocupar qualquer vaga dela. Toque em uma vaga dourada no campo para escolher onde ele entra.{' '}
                  {openSlots(draft).length} vagas livres.
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
