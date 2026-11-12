import { useMemo, useState } from 'react';
import { CLUB_BY_ID } from '../data/clubs';
import { db } from '../data/db';
import { decadeLabel, POSITION_NAMES, POSITIONS, type Decade, type Position } from '../data/types';
import { FORMATIONS } from '../data/formations';
import { feasibleFormationsForDecade } from '../engine/draft';
import { navigate } from '../router';
import { MODE_INFO, useGame } from '../state/store';
import { Crest } from '../components/Crest';
import { Flag } from '../components/Flag';
import { PlayerAvatar } from '../components/PlayerCard';
import { BackLink, OvrBadge } from '../components/ui';

function titlesIn(years: number[], d: Decade): number[] {
  const start = Number(d.slice(0, 4));
  return years.filter((y) => y >= start && y <= start + 9);
}

export function ClubPage({ id }: { id: string }) {
  const club = CLUB_BY_ID[id];
  const run = useGame((s) => s.run);
  const chooseClub = useGame((s) => s.chooseClub);
  const chooseDecade = useGame((s) => s.chooseDecade);
  const startMode = useGame((s) => s.startMode);
  const [bankDecade, setBankDecade] = useState<Decade | 'all'>('all');
  const [bankPos, setBankPos] = useState<Position | 'all'>('all');

  const decades = useMemo(() => (club ? db.decadesOf(club.id) : []), [club]);
  if (!club) {
    return (
      <div className="page">
        <div className="empty">Clube não encontrado.</div>
      </div>
    );
  }

  const ensureRun = () => {
    if (!run || (run.clubId !== club.id && run.phase !== 'setup')) startMode('classico');
    if (useGame.getState().run?.clubId !== club.id) chooseClub(club.id);
  };

  const playClassic = () => {
    ensureRun();
    chooseDecade(null);
    navigate('/formacao');
  };
  const playEra = (d: Decade) => {
    ensureRun();
    chooseDecade(d);
    navigate('/formacao');
  };

  const modeName = run ? MODE_INFO[run.mode === 'era' ? 'classico' : run.mode].name : 'Clássico';
  const players = db.playersByClub.get(club.id) ?? [];
  const bank = players
    .filter((p) => (bankDecade === 'all' ? true : p.eras[bankDecade] != null))
    .filter((p) => (bankPos === 'all' ? true : p.position === bankPos || p.secondary.includes(bankPos)))
    .map((p) => ({ p, ovr: bankDecade === 'all' ? Math.max(...Object.values(p.eras).map(Number)) : p.eras[bankDecade]! }))
    .sort((a, b) => b.ovr - a.ovr);

  return (
    <div className="page">
      <div className="page-head">
        <div className="eyebrow">{modeName} · passo 2</div>
        <BackLink to="/clubes" label="Clubes" />
      </div>

      <section className="club-hero" style={{ ['--c1' as string]: club.colors.primary, ['--c2' as string]: club.colors.secondary }}>
        <div className="club-hero-bg" aria-hidden="true" />
        <Crest club={club} size={110} />
        <div className="club-hero-info">
          <h1>{club.name}</h1>
          <div className="muted">
            {club.fullName} · fundado em {club.founded} · {club.city}/{club.state}
          </div>
          <div className="row wrap" style={{ marginTop: 10 }}>
            <span className="chip">{club.nickname}</span>
            <span className="chip">{club.stadium}</span>
            {club.titles.brasileirao.length > 0 && <span className="chip chip-gold">{club.titles.brasileirao.length}× Brasileiro</span>}
            {club.titles.copaDoBrasil.length > 0 && <span className="chip chip-gold">{club.titles.copaDoBrasil.length}× Copa do Brasil</span>}
            {club.titles.libertadores.length > 0 && <span className="chip chip-gold">{club.titles.libertadores.length}× Libertadores</span>}
          </div>
          <p className="club-history">{club.history}</p>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Escolha como montar o elenco</h2>
        <button className="decade-card decade-all" onClick={playClassic}>
          <div>
            <div className="eyebrow">Recomendado</div>
            <h3>Todas as décadas</h3>
            <p className="muted">A cada rodada do draft uma década é sorteada entre as {decades.length} disponíveis. Você tem 5 novos sorteios.</p>
          </div>
          <span className="btn btn-gold">Sortear décadas</span>
        </button>

        <div className="decade-grid">
          {decades.map((d) => {
            const cards = db.cards(club.id, d);
            const top = cards.slice(0, 3);
            const feasible = feasibleFormationsForDecade(db, club.id, d, FORMATIONS.map((f) => f.id));
            const br = titlesIn(club.titles.brasileirao, d);
            const cb = titlesIn(club.titles.copaDoBrasil, d);
            const lib = titlesIn(club.titles.libertadores, d);
            return (
              <button key={d} className="decade-card" onClick={() => playEra(d)} disabled={feasible.length === 0}>
                <div className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
                  <h3>{decadeLabel(d)}</h3>
                  <span className="chip">{cards.length} jogadores</span>
                </div>
                <div className="decade-top">
                  {top.map((c) => (
                    <span key={c.key} className="decade-top-player">
                      <PlayerAvatar card={c} size={34} />
                      <span>
                        <strong>{c.player.name}</strong>
                        <span className="dim"> {c.overall}</span>
                      </span>
                    </span>
                  ))}
                </div>
                <div className="row wrap" style={{ gap: 6 }}>
                  {br.length > 0 && <span className="chip chip-gold">Brasileiro {br.join(', ')}</span>}
                  {cb.length > 0 && <span className="chip chip-gold">Copa do Brasil {cb.join(', ')}</span>}
                  {lib.length > 0 && <span className="chip chip-gold">Libertadores {lib.join(', ')}</span>}
                </div>
                <span className="dim decade-cta">
                  {feasible.length === 0 ? 'Elenco insuficiente para uma era única' : `Era Única · ${feasible.length} formações`}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Banco de jogadores históricos</h2>
        <div className="row wrap" style={{ marginBottom: 10 }}>
          <select className="select" value={bankDecade} onChange={(e) => setBankDecade(e.target.value as Decade | 'all')} aria-label="Década">
            <option value="all">Todas as décadas</option>
            {decades.map((d) => (
              <option key={d} value={d}>
                {decadeLabel(d)}
              </option>
            ))}
          </select>
          <select className="select" value={bankPos} onChange={(e) => setBankPos(e.target.value as Position | 'all')} aria-label="Posição">
            <option value="all">Todas as posições</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {POSITION_NAMES[p]}
              </option>
            ))}
          </select>
          <span className="dim">{bank.length} jogadores</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>OVR</th>
                <th className="l">Jogador</th>
                <th>Pos.</th>
                <th>Nac.</th>
                <th className="l">Passagem</th>
                <th>Jogos</th>
                <th>Gols</th>
                <th className="l">Fonte</th>
              </tr>
            </thead>
            <tbody>
              {bank.slice(0, 250).map(({ p, ovr }) => (
                <tr key={p.id}>
                  <td>
                    <OvrBadge value={ovr} />
                  </td>
                  <td className="l" title={p.description}>
                    <strong>{p.name}</strong>
                    {p.editorial && <span className="dim"> ★</span>}
                    <div className="dim bank-desc">{p.description}</div>
                  </td>
                  <td>{[p.position, ...p.secondary].join('/')}</td>
                  <td>
                    <Flag code={p.nationality} size={13} />
                  </td>
                  <td className="l">{p.years}</td>
                  <td>{p.apps ?? '—'}</td>
                  <td>{p.goals ?? '—'}</td>
                  <td className="l">
                    <a href={p.source} target="_blank" rel="noreferrer">
                      Wikipédia
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="dim" style={{ marginTop: 8, fontSize: 13 }}>
          ★ nota definida pela curadoria editorial. Demais notas pela fórmula editorial (jogos, gols e seleção). Notas não são oficiais.
        </p>
      </section>
    </div>
  );
}
