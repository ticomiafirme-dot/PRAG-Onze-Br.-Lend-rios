import { useMemo } from 'react';
import { CLUB_BY_ID, CLUBS } from '../data/clubs';
import { db, LEAGUE_CLUBS } from '../data/db';
import { getFormation } from '../data/formations';
import { buildAiTeam, DIFFICULTIES } from '../engine/team';
import { chemLabel } from '../engine/chemistry';
import { Rng, subSeed } from '../engine/rng';
import { navigate } from '../router';
import { lineupOf, MODE_INFO, teamIdentity, useGame, userSheet } from '../state/store';
import { PlayerCard } from '../components/PlayerCard';
import { Crest } from '../components/Crest';
import { BackLink, Meter, NeedRun, OvrBadge, chemColor } from '../components/ui';
import { SectorBars } from './Lineup';

export function Preseason() {
  const run = useGame((s) => s.run);
  return (
    <NeedRun ok={!!run?.draft && !!run.captainSlot && Object.keys(run.draft.picks).length === 11}>
      <PreseasonInner />
    </NeedRun>
  );
}

function PreseasonInner() {
  const run = useGame((s) => s.run)!;
  const startSeason = useGame((s) => s.startSeason);
  const sheet = useMemo(() => userSheet(run), [run.captainSlot]); // eslint-disable-line react-hooks/exhaustive-deps
  const id = teamIdentity(run);
  const formation = getFormation(run.formationId!);
  const lineup = lineupOf(run);
  const captain = lineup[run.captainSlot!];

  // prévia dos rivais (mesmas sementes usadas ao iniciar a temporada)
  const rivals = useMemo(() => {
    const exclude = new Set(sheet.players.map((p) => p.personId));
    const others = new Rng(subSeed(run.seed, 'liga')).shuffle(LEAGUE_CLUBS.filter((c) => c.id !== run.clubId)).slice(0, 19);
    return others
      .map((c) => buildAiTeam(db, c.id, new Rng(subSeed(run.seed, `ia:${c.id}`)), run.difficulty, exclude))
      .sort((a, b) => b.ratings.overall - a.ratings.overall);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const club = run.clubId ? CLUB_BY_ID[run.clubId] : null;
  const triple = run.mode === 'triplice';
  const stateRivals = triple && club ? CLUBS.filter((c) => c.state === club.state && c.id !== club.id) : [];

  const begin = () => {
    startSeason();
    navigate('/campeonato');
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">
            Passo 6 · {MODE_INFO[run.mode].name} · {DIFFICULTIES.find((d) => d.id === run.difficulty)?.name}
          </div>
          <h1>Pré-temporada</h1>
        </div>
        <div className="row wrap">
          <BackLink to="/capitao" label="Trocar capitão" />
          <button className="btn btn-gold btn-lg" onClick={begin}>
            Iniciar temporada ⚽
          </button>
        </div>
      </div>

      <div className="preseason-grid">
        <div className="panel team-card" style={{ ['--c1' as string]: id.colors.primary }}>
          <div className="row">
            {club ? <Crest club={club} size={56} /> : null}
            <div>
              <h2 style={{ fontSize: 30 }}>{id.name}</h2>
              <div className="muted">
                Seu Onze Lendário · {formation.name} · capitão {captain.player.name}
              </div>
            </div>
          </div>
          <div className="row wrap" style={{ margin: '14px 0', gap: 20 }}>
            <div className="big-stat">
              <span className="v">{sheet.ratings.overall}</span>
              <span className="k">Overall</span>
            </div>
            <div className="big-stat">
              <span className="v" style={{ color: chemColor(sheet.chem, 100) }}>
                {sheet.chem}
              </span>
              <span className="k">Química · {chemLabel(sheet.chem)}</span>
            </div>
          </div>
          <Meter value={sheet.chem} />
          <div style={{ marginTop: 14 }}>
            <SectorBars ratings={sheet.ratings} />
          </div>
          <div className="mini-squad">
            {formation.slots.map((s) => (
              <PlayerCard
                key={s.id}
                card={lineup[s.id]}
                size="sm"
                pos={s.pos}
                captain={run.captainSlot === s.id}
                overall={sheet.players.find((p) => p.slotId === s.id)?.eff}
              />
            ))}
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <h3 style={{ fontSize: 22, marginBottom: 8 }}>Objetivos</h3>
            <ul className="goals">
              <li>🏆 Ser campeão do Brasileirão</li>
              <li>⭐ Temporada perfeita: 38 vitórias, 0 empates, 0 derrotas</li>
              <li>🛡️ Terminar invicto</li>
              {triple && <li>👑 Tríplice Coroa: {club?.stateCup}, Copa do Brasil e Brasileirão</li>}
            </ul>
            {triple && stateRivals.length > 0 && (
              <p className="dim" style={{ marginTop: 8 }}>
                Rivais no estadual: {stateRivals.map((c) => c.name).join(', ')}.
              </p>
            )}
          </div>
          <div className="panel">
            <h3 style={{ fontSize: 22, marginBottom: 8 }}>Rivais no Brasileirão</h3>
            <p className="dim" style={{ fontSize: 13, marginBottom: 10 }}>
              Cada rival entra em campo com lendas da própria história.
            </p>
            <div className="rival-list">
              {rivals.map((t) => (
                <div key={t.id} className="rival">
                  <Crest club={CLUB_BY_ID[t.id]} size={22} />
                  <span className="grow">
                    <strong>{t.name}</strong> <span className="dim">· {t.label}</span>
                  </span>
                  <OvrBadge value={t.ratings.overall} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
