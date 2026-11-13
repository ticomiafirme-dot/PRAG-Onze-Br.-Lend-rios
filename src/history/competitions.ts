// Catálogo de competições que podem ser conquistadas no jogo. Ao criar uma nova
// competição, basta incluí-la aqui: a galeria de troféus, os títulos e a
// conquista "Rei do Brasil" passam a considerá-la automaticamente.
import { CLUBS } from '../data/clubs';

export type TrophyStyle = 'brasileirao' | 'copa' | 'estadual';

export interface Competition {
  id: string;
  name: string;
  short: string;
  trophy: TrophyStyle;
  /** Onde é disputada (texto para o jogador). */
  where: string;
  /** UF do estadual. */
  state?: string;
}

const STATE_NAMES: Record<string, string> = {
  SP: 'São Paulo',
  RJ: 'Rio de Janeiro',
  MG: 'Minas Gerais',
  RS: 'Rio Grande do Sul',
  PR: 'Paraná',
  BA: 'Bahia',
  PE: 'Pernambuco',
  CE: 'Ceará',
  GO: 'Goiás',
};

function estaduais(): Competition[] {
  const byState = new Map<string, { name: string; clubs: number }>();
  for (const c of CLUBS) {
    const cur = byState.get(c.state) ?? { name: c.stateCup, clubs: 0 };
    byState.set(c.state, { name: cur.name, clubs: cur.clubs + 1 });
  }
  // um estadual só pode ser vencido se houver ao menos dois clubes do estado
  return [...byState.entries()]
    .filter(([, v]) => v.clubs >= 2)
    .sort((a, b) => a[1].name.localeCompare(b[1].name, 'pt-BR'))
    .map(([uf, v]) => ({
      id: `estadual-${uf.toLowerCase()}`,
      name: v.name,
      short: v.name.replace('Campeonato ', ''),
      trophy: 'estadual' as const,
      where: `Tríplice Coroa com um clube de ${STATE_NAMES[uf] ?? uf}`,
      state: uf,
    }));
}

export const COMPETITIONS: Competition[] = [
  { id: 'brasileirao', name: 'Campeonato Brasileiro', short: 'Brasileirão', trophy: 'brasileirao', where: 'Todos os modos' },
  { id: 'copa-do-brasil', name: 'Copa do Brasil', short: 'Copa do Brasil', trophy: 'copa', where: 'Tríplice Coroa' },
  ...estaduais(),
];

export const COMPETITION_BY_ID: Record<string, Competition> = Object.fromEntries(COMPETITIONS.map((c) => [c.id, c]));

/** Estadual de um clube (ou null se o estado não tiver estadual disputável). */
export function estadualOf(clubId: string | null): Competition | null {
  const club = CLUBS.find((c) => c.id === clubId);
  if (!club) return null;
  return COMPETITIONS.find((c) => c.state === club.state) ?? null;
}
