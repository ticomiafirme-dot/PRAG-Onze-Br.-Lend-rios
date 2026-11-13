// Hall dos Lendários: a sala de troféus pessoal do jogador.
import { useMemo } from 'react';
import { useAuth } from '../cloud/auth';
import { ACHIEVEMENT_BY_ID, TIER_LABEL, TIER_ORDER } from '../history/achievements';
import { COMPETITION_BY_ID, COMPETITIONS } from '../history/competitions';
import { decadesLabel } from '../history/record';
import { careerStats, greatCampaigns } from '../history/records';
import { useHistory, useSeasonDetails } from '../history/store';
import type { SeasonEntry } from '../history/types';
import { AccountBanner, ProfileAvatar, StaffBadge } from '../components/Account';
import { Medal } from '../components/Medal';
import { fmtDate, SeasonCard, SeasonCrest, SeasonLineup } from '../components/SeasonViews';
import { Trophy } from '../components/Trophy';

function bestSquad(seasons: SeasonEntry[]): SeasonEntry | null {
  const played = seasons.filter((s) => s.status !== 'in_progress' || s.played > 0);
  return [...played].sort((a, b) => b.squadOverall - a.squadOverall || b.chemistry - a.chemistry || a.startedAt.localeCompare(b.startedAt))[0] ?? null;
}

export function Hall() {
  const data = useHistory((s) => s.data);
  const { status, user } = useAuth();
  const career = useMemo(() => careerStats(data.seasons, data.titles), [data]);
  const campaigns = useMemo(() => greatCampaigns(data.seasons), [data.seasons]);
  const squad = useMemo(() => bestSquad(data.seasons), [data.seasons]);
  const { details: squadDetails } = useSeasonDetails(squad?.runId ?? null);
  const titles = [...data.titles].sort((a, b) => b.wonAt.localeCompare(a.wonAt));
  const medals = [...data.unlocks].sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || a.unlockedAt.localeCompare(b.unlockedAt));
  const seasonOf = (runId: string | null) => data.seasons.find((s) => s.runId === runId) ?? null;
  const signedIn = status === 'signed-in' && user;
  const titleCount = (id: string) => data.titles.filter((t) => t.competitionId === id).length;

  return (
    <div className="page hall-page">
      <section className="hall-hero">
        <div className="hall-lights" aria-hidden="true" />
        <div className="hall-plaque">
          <div className="hall-eyebrow">Museu pessoal</div>
          <h1 className="hall-title">Hall dos Lendários</h1>
          <div className="hall-owner">
            <ProfileAvatar size={76} />
            <div>
              <strong>
                {signedIn ? user.name : 'Visitante'} <StaffBadge />
              </strong>
              <span className="dim">{signedIn ? `No PRAG desde ${fmtDate(user.createdAt)}` : 'Coleção salva neste aparelho'}</span>
            </div>
          </div>
          <div className="hall-totals">
            <span>
              <b>{career.seasonsPlayed}</b>
              <i>Temporadas</i>
            </span>
            <span>
              <b>{career.titles}</b>
              <i>Títulos</i>
            </span>
            <span>
              <b>{data.unlocks.length}</b>
              <i>Conquistas</i>
            </span>
            <span>
              <b>{career.perfectSeasons}</b>
              <i>Temporadas perfeitas</i>
            </span>
          </div>
        </div>
      </section>
      {!signedIn && <AccountBanner />}

      <section className="hall-section">
        <h2 className="hall-heading">Galeria de troféus</h2>
        <div className="hall-competitions">
          {COMPETITIONS.map((c) => (
            <span key={c.id} className={`comp-chip ${titleCount(c.id) ? 'is-won' : ''}`} title={c.where}>
              {c.short} {titleCount(c.id) ? `× ${titleCount(c.id)}` : ''}
            </span>
          ))}
        </div>
        {titles.length ? (
          <div className="trophy-cabinet">
            {titles.map((t, i) => {
              const comp = COMPETITION_BY_ID[t.competitionId];
              return (
                <a key={t.id} className={`trophy-case style-${comp?.trophy ?? 'estadual'}`} href={`#temporada-${t.runId}`} style={{ animationDelay: `${Math.min(i, 12) * 60}ms` }}>
                  <div className="trophy-glass">
                    <Trophy style={comp?.trophy ?? 'estadual'} label={comp?.state} size={96} />
                  </div>
                  <div className="trophy-pedestal">
                    <strong>{t.competitionName}</strong>
                    <span className="trophy-team">
                      <SeasonCrest season={t} size={18} /> {t.teamName}
                    </span>
                    <span className="dim">
                      {decadesLabel(t) || '—'} · {t.formationId}
                    </span>
                    <span className="dim">{fmtDate(t.wonAt)}</span>
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="hall-empty">Seu primeiro troféu vai brilhar aqui. Vença o Brasileirão, a Copa do Brasil ou um estadual.</div>
        )}
      </section>

      <section className="hall-section">
        <h2 className="hall-heading">Galeria de conquistas</h2>
        {medals.length ? (
          <div className="medal-wall">
            {medals.map((u) => {
              const def = ACHIEVEMENT_BY_ID[u.id];
              const season = seasonOf(u.runId);
              return (
                <div key={u.id} className={`medal-frame tier-${u.tier}`}>
                  <Medal tier={u.tier} icon={def?.icon ?? 'medal'} size={u.tier === 'lendaria' || u.tier === 'ouro' ? 92 : 72} />
                  <strong>{u.name}</strong>
                  <span className={`tier-pill tier-${u.tier}`}>{TIER_LABEL[u.tier]}</span>
                  <span className="dim">{fmtDate(u.unlockedAt)}</span>
                  {season && <span className="dim">{season.teamName}</span>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="hall-empty">Nenhuma medalha ainda. Veja o que é preciso em <a href="#conquistas">Conquistas</a>.</div>
        )}
      </section>

      <section className="hall-section">
        <h2 className="hall-heading">Minhas grandes campanhas</h2>
        {campaigns.length ? (
          <div className="season-grid">
            {campaigns.map((c) => (
              <SeasonCard key={c.season.runId} season={c.season} reasons={c.reasons} />
            ))}
          </div>
        ) : (
          <div className="hall-empty">As temporadas mais marcantes aparecem aqui assim que você terminar a primeira.</div>
        )}
      </section>

      <section className="hall-section">
        <h2 className="hall-heading">Meu maior elenco</h2>
        {squad ? (
          <div className="best-squad">
            <div className="best-squad-pitch">{squadDetails ? <SeasonLineup formationId={squad.formationId} lineup={squadDetails.lineup} /> : <div className="hall-empty">Carregando escalação…</div>}</div>
            <div className="best-squad-info panel">
              <SeasonCrest season={squad} size={64} />
              <h3>{squad.teamName}</h3>
              <p className="muted">
                {decadesLabel(squad, 8) || '—'} · {squad.formationId}
              </p>
              <div className="best-squad-numbers">
                <span>
                  <b>{Math.round(squad.squadOverall)}</b>
                  <i>Overall médio</i>
                </span>
                <span>
                  <b>{squad.chemistry}</b>
                  <i>Química</i>
                </span>
              </div>
              {squad.captainName && (
                <p>
                  Capitão: <strong>{squad.captainName}</strong>
                </p>
              )}
              <a className="btn btn-ghost btn-sm" href={`#temporada-${squad.runId}`}>
                Ver temporada
              </a>
            </div>
          </div>
        ) : (
          <div className="hall-empty">Monte seu primeiro elenco para expô-lo aqui.</div>
        )}
      </section>
    </div>
  );
}
