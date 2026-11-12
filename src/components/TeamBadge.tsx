import { CLUB_BY_ID } from '../data/clubs';
import type { TeamSheet } from '../engine/team';
import { Crest } from './Crest';
import { LogoMark } from './Logo';

export function TeamCrest({ team, size = 24 }: { team: TeamSheet; size?: number }) {
  const club = team.clubId ? CLUB_BY_ID[team.clubId] : null;
  if (club) return <Crest club={club} size={size} />;
  return <LogoMark size={size} />;
}

export function TeamName({ team, short = false }: { team: TeamSheet; short?: boolean }) {
  return (
    <span className={`team-name ${team.isUser ? 'is-user' : ''}`}>
      <TeamCrest team={team} size={short ? 16 : 20} />
      <span>{short ? team.short : team.name}</span>
      {team.isUser && !short && <span className="chip chip-gold you-chip">Você</span>}
    </span>
  );
}
