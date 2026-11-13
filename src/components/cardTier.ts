// Nível da carta pelo overall (define a cor da carta e o fundo do avatar).
export type Tier = 'lenda' | 'idolo' | 'craque' | 'titular' | 'elenco';

export function tierOf(ovr: number): Tier {
  if (ovr >= 90) return 'lenda';
  if (ovr >= 85) return 'idolo';
  if (ovr >= 80) return 'craque';
  if (ovr >= 75) return 'titular';
  return 'elenco';
}

export const TIER_LABEL: Record<Tier, string> = {
  lenda: 'Lenda',
  idolo: 'Ídolo',
  craque: 'Craque',
  titular: 'Titular',
  elenco: 'Elenco',
};
