// Peças visuais do histórico: card de temporada, escalação no campo e selos.
import { CLUB_BY_ID } from '../data/clubs';
import { db } from '../data/db';
import { DIFFICULTIES } from '../engine/team';
import { ACHIEVEMENT_BY_ID } from '../history/achievements';
import { decadesLabel } from '../history/record';
import type { LineupEntry, SeasonEntry } from '../history/types';
import { Crest } from './Crest';
import { LogoMark } from './Logo';
import { Medal } from './Medal';
import { Pitch } from './Pitch';
import { PlayerCard } from './PlayerCard';

export const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export function SeasonCrest({ season, size = 48 }: { season: Pick<SeasonEntry, 'clubId'>; size?: number }) {
  const club = season.clubId ? CLUB_BY_ID[season.clubId] : null;
  return club ? <Crest club={club} size={size} /> : <LogoMark size={size} />;
}

export function statusLabel(s: SeasonEntry): string {
  if (s.status === 'in_progress') return 'Em andamento';
  if (s.status === 'abandoned') return 'Abandonada';
  if (s.perfect) return 'Temporada perfeita';
  if (s.triple) return 'Tríplice Coroa';
  if (s.champion) return s.unbeaten ? 'Campeão invicto' : 'Campeão';
  return `${s.position}º lugar`;
}

/** Card de uma temporada no histórico (abre os detalhes). */
export function SeasonCard({ season: s, reasons }: { season: SeasonEntry; reasons?: string[] }) {
  const diff = DIFFICULTIES.find((d) => d.id === s.difficulty)?.name;
  const gold = s.champion || s.perfect;
  return (
    <a className={`season-card ${gold ? 'is-gold' : ''} ${s.perfect ? 'is-perfect' : ''} is-${s.status}`} href={`#temporada-${s.runId}`} style={{ ['--club' as string]: s.colors.primary, ['--club2' as string]: s.colors.secondary }}>
      <div className="season-card-head">
        <SeasonCrest season={s} size={44} />
        <div className="season-card-title">
          <strong>{s.teamName}</strong>
          <span className="dim">
            {decadesLabel(s) || '—'} · {s.formationId} · {s.modeLabel}
            {diff ? ` · ${diff}` : ''}
          </span>
        </div>
        <span className={`season-badge ${gold ? 'is-gold' : ''}`}>{statusLabel(s)}</span>
      </div>
      {reasons && reasons.length > 0 && (
        <div className="season-reasons">
          {reasons.map((r) => (
            <span key={r} className="chip chip-gold">
              {r}
            </span>
          ))}
        </div>
      )}
      <div className="season-card-numbers">
        <span>
          <b>{s.position ? `${s.position}º` : '—'}</b>
          <i>Posição</i>
        </span>
        <span>
          <b>{s.points}</b>
          <i>Pontos</i>
        </span>
        <span>
          <b>
            {s.wins}-{s.draws}-{s.losses}
          </b>
          <i>V-E-D</i>
        </span>
        <span>
          <b>
            {s.goalsFor}:{s.goalsAgainst}
          </b>
          <i>Gols</i>
        </span>
      </div>
      <div className="season-card-foot">
        <span>
          Overall <b>{Math.round(s.squadOverall)}</b>
        </span>
        <span>
          Química <b>{s.chemistry}</b>
        </span>
        {s.captainName && (
          <span>
            Capitão <b>{s.captainName}</b>
          </span>
        )}
      </div>
      <div className="season-card-dates dim">
        Início {fmtDate(s.startedAt)}
        {s.finishedAt ? ` · Fim ${fmtDate(s.finishedAt)}` : ''}
        {s.status === 'abandoned' ? ` · ${s.played} jogos disputados` : ''}
      </div>
      {s.achievements.length > 0 && (
        <div className="season-card-medals" aria-label="Conquistas desta temporada">
          {s.achievements.map((id) => {
            const a = ACHIEVEMENT_BY_ID[id];
            return a ? (
              <span key={id} title={a.name} className="mini-medal">
                <Medal tier={a.tier} icon={a.icon} size={26} />
              </span>
            ) : null;
          })}
        </div>
      )}
    </a>
  );
}

/** Escalação salva da temporada no campo. */
export function SeasonLineup({ formationId, lineup }: { formationId: SeasonEntry['formationId']; lineup: LineupEntry[] }) {
  const bySlot = new Map(lineup.map((p) => [p.slotId, p]));
  return (
    <Pitch
      formationId={formationId}
      renderSlot={(slot) => {
        const p = bySlot.get(slot.id);
        if (!p) return null;
        const card = db.cardMaybe(p.cardKey);
        if (card) return <PlayerCard card={{ ...card, overall: p.overall }} size="sm" pos={p.pos} captain={p.captain} />;
        return (
          <div className="pcard pcard-sm saved-card">
            <span className="pcard-top">
              <span className="pcard-ovr">
                <span className="pcard-ovr-num">{p.overall}</span>
                <span className="pcard-pos">{p.pos}</span>
              </span>
            </span>
            <span className="pcard-name">{p.name}</span>
            {p.captain && <span className="armband">C</span>}
          </div>
        );
      }}
    />
  );
}
