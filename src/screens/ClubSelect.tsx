import { useMemo, useState } from 'react';
import { CLUBS, STATE_NAMES } from '../data/clubs';
import { db } from '../data/db';
import type { Club } from '../data/types';
import { navigate } from '../router';
import { MODE_INFO, useGame } from '../state/store';
import { Crest } from '../components/Crest';
import { BackLink } from '../components/ui';

const REGIONS: { id: string; label: string; states: string[] }[] = [
  { id: 'all', label: 'Todos', states: [] },
  { id: 'sp', label: 'São Paulo', states: ['SP'] },
  { id: 'rj', label: 'Rio', states: ['RJ'] },
  { id: 'mg', label: 'Minas', states: ['MG'] },
  { id: 'sul', label: 'Sul', states: ['RS', 'PR'] },
  { id: 'ne', label: 'Nordeste', states: ['BA', 'PE', 'CE'] },
  { id: 'co', label: 'Centro-Oeste', states: ['GO'] },
];

export function ClubSelect() {
  const run = useGame((s) => s.run);
  const chooseClub = useGame((s) => s.chooseClub);
  const [region, setRegion] = useState('all');
  const [q, setQ] = useState('');

  const filter = (c: Club) => {
    const r = REGIONS.find((x) => x.id === region)!;
    if (r.states.length && !r.states.includes(c.state)) return false;
    if (q && !`${c.name} ${c.fullName} ${c.city} ${c.nickname}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  };
  const main = CLUBS.filter((c) => !c.guest && filter(c));
  const guests = CLUBS.filter((c) => c.guest && filter(c));

  const pick = (c: Club) => {
    chooseClub(c.id);
    navigate(`/clube/${c.id}`);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{run ? MODE_INFO[run.mode === 'era' ? 'classico' : run.mode].name : 'Clássico'} · passo 1</div>
          <h1>Escolha o clube</h1>
          <p className="muted">Os 20 grandes do Brasileirão, com as décadas em que fizeram história.</p>
        </div>
        <BackLink to="/" />
      </div>

      <div className="row wrap" style={{ marginBottom: 16 }}>
        <div className="tabs" role="tablist" aria-label="Região">
          {REGIONS.map((r) => (
            <button key={r.id} className="tab" role="tab" aria-selected={region === r.id} onClick={() => setRegion(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
        <input className="search" placeholder="Buscar clube…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar clube" />
      </div>

      <div className="club-grid">
        {main.map((c, i) => (
          <ClubTile key={c.id} club={c} onClick={() => pick(c)} delay={i * 25} />
        ))}
      </div>
      {main.length === 0 && <div className="empty">Nenhum clube encontrado.</div>}

      {guests.length > 0 && (
        <section className="section">
          <h2 className="section-title">Convidados dos estaduais</h2>
          <p className="muted" style={{ marginBottom: 12 }}>
            Clubes tradicionais que completam os campeonatos de Pernambuco e Goiás na Tríplice Coroa. Também podem ser escolhidos.
          </p>
          <div className="club-grid">
            {guests.map((c, i) => (
              <ClubTile key={c.id} club={c} onClick={() => pick(c)} delay={i * 25} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ClubTile({ club, onClick, delay }: { club: Club; onClick: () => void; delay: number }) {
  const decades = db.decadesOf(club.id);
  const players = useMemo(() => db.playersByClub.get(club.id)?.length ?? 0, [club.id]);
  const br = club.titles.brasileirao.length;
  return (
    <button
      className="club-tile"
      onClick={onClick}
      style={{ ['--c1' as string]: club.colors.primary, ['--c2' as string]: club.colors.secondary, animationDelay: `${delay}ms` }}
    >
      <span className="club-tile-bg" aria-hidden="true" />
      <Crest club={club} size={58} />
      <span className="club-tile-name">{club.name}</span>
      <span className="club-tile-sub">
        {club.city} · {club.state}
      </span>
      <span className="club-tile-meta">
        <span>{decades.length} décadas</span>
        <span>{players} jogadores</span>
        {br > 0 && <span>{br}× Brasileiro</span>}
      </span>
      <span className="sr-only">{STATE_NAMES[club.state]}</span>
    </button>
  );
}
