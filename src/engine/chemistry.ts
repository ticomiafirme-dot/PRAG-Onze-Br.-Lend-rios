// Sistema de química.
// Cada par de posições vizinhas na formação forma uma ligação que vale de 0 a 3:
//   +1 se os jogadores atuaram no mesmo clube (o clube da carta ou qualquer clube
//      da base em que ambos tenham passagem registrada),
//   +1 se são da mesma década,
//   +1 se têm a mesma nacionalidade.
// A química individual (0–10) é a média ponderada das ligações do jogador.
// O capitão: +3 de overall, ligações com ele contam em dobro e sua química
// individual pesa em dobro na química do time (0–100).

import type { Card } from '../data/types';
import { getFormation, type FormationId } from '../data/formations';
import type { Database } from './database';

export interface ChemLink {
  a: string;
  b: string;
  value: 0 | 1 | 2 | 3;
  club: boolean;
  decade: boolean;
  nation: boolean;
  captain: boolean;
}

export interface ChemistryResult {
  links: ChemLink[];
  /** slotId -> química individual 0–10 */
  player: Record<string, number>;
  /** química do time 0–100 */
  team: number;
  /** slotId -> bônus de overall vindo da química (−2 a +2) */
  bonus: Record<string, number>;
}

export const CAPTAIN_BONUS = 3;

export function sharedClub(db: Database, a: Card, b: Card): boolean {
  if (a.club === b.club) return true;
  const ca = new Set(db.clubsOfPerson(a.id));
  return db.clubsOfPerson(b.id).some((c) => ca.has(c));
}

export function linkBetween(db: Database, a: Card, b: Card): Omit<ChemLink, 'a' | 'b' | 'captain'> {
  const club = sharedClub(db, a, b);
  const decade = a.decade === b.decade;
  const nation = a.player.nationality === b.player.nationality;
  const value = (Number(club) + Number(decade) + Number(nation)) as 0 | 1 | 2 | 3;
  return { value, club, decade, nation };
}

export function chemBonus(playerChem: number): number {
  if (playerChem >= 9) return 2;
  if (playerChem >= 7) return 1;
  if (playerChem >= 4) return 0;
  if (playerChem >= 2) return -1;
  return -2;
}

export function computeChemistry(
  db: Database,
  formationId: FormationId,
  lineup: Record<string, Card | undefined>,
  captainSlot: string | null,
): ChemistryResult {
  const formation = getFormation(formationId);
  const links: ChemLink[] = [];
  const acc: Record<string, { sum: number; max: number }> = {};
  for (const s of formation.slots) acc[s.id] = { sum: 0, max: 0 };

  for (const [a, b] of formation.links) {
    const ca = lineup[a];
    const cb = lineup[b];
    if (!ca || !cb) continue;
    const l = linkBetween(db, ca, cb);
    const captain = captainSlot === a || captainSlot === b;
    links.push({ a, b, ...l, captain });
    const w = captain ? 2 : 1;
    acc[a].sum += w * l.value;
    acc[a].max += w * 3;
    acc[b].sum += w * l.value;
    acc[b].max += w * 3;
  }

  const player: Record<string, number> = {};
  const bonus: Record<string, number> = {};
  let teamSum = 0;
  let teamMax = 0;
  for (const s of formation.slots) {
    if (!lineup[s.id]) continue;
    const { sum, max } = acc[s.id];
    const chem = max > 0 ? Math.round((10 * sum) / max) : 5;
    player[s.id] = chem;
    bonus[s.id] = chemBonus(chem);
    const w = captainSlot === s.id ? 2 : 1;
    teamSum += w * chem;
    teamMax += w * 10;
  }
  const team = teamMax > 0 ? Math.round((100 * teamSum) / teamMax) : 0;
  return { links, player, team, bonus };
}

export function chemLabel(team: number): string {
  if (team >= 90) return 'Entrosamento perfeito';
  if (team >= 75) return 'Muito entrosado';
  if (team >= 55) return 'Entrosado';
  if (team >= 35) return 'Em formação';
  return 'Desentrosado';
}
