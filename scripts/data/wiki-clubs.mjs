// Mapeamento entre os clubes do jogo e a Wikipédia (pt/en).
// Usado pelos scripts de coleta e verificação de passagens.
// `aliases`: alvos de link ([[Alvo|texto]]) e nomes de predefinições ({{Futebol X}})
// que identificam o clube nas infobox. Comparação é feita sem acentos/pontuação.

export const WIKI_CLUBS = {
  corinthians: {
    category: 'Futebolistas do Sport Club Corinthians Paulista',
    enCategory: 'Sport Club Corinthians Paulista players',
    aliases: ['Sport Club Corinthians Paulista', 'SC Corinthians Paulista', 'Corinthians Paulista', 'Corinthians', 'Futebol Corinthians', 'Sport Club Corinthians Paulista (futebol)'],
  },
  flamengo: {
    category: 'Futebolistas do Clube de Regatas do Flamengo',
    enCategory: 'CR Flamengo footballers',
    aliases: ['Clube de Regatas do Flamengo', 'Clube de Regatas Flamengo', 'CRF', 'CR Flamengo', 'Flamengo', 'Futebol Flamengo', 'Clube de Regatas do Flamengo (futebol)', 'CR Flamengo (football)'],
  },
  vasco: {
    category: 'Futebolistas do Club de Regatas Vasco da Gama',
    enCategory: 'CR Vasco da Gama players',
    aliases: ['Club de Regatas Vasco da Gama', 'Clube de Regatas Vasco da Gama', 'CRVG', 'CR Vasco da Gama', 'Vasco da Gama', 'Vasco', 'Futebol Vasco da Gama', 'Futebol Vasco', 'Club de Regatas Vasco da Gama (futebol)'],
  },
  'sao-paulo': {
    category: 'Futebolistas do São Paulo Futebol Clube',
    enCategory: 'São Paulo FC players',
    aliases: ['São Paulo Futebol Clube', 'São Paulo FC', 'Futebol São Paulo', 'São Paulo Futebol Clube (futebol)'],
  },
  palmeiras: {
    category: 'Futebolistas da Sociedade Esportiva Palmeiras',
    enCategory: 'Sociedade Esportiva Palmeiras players',
    aliases: ['Sociedade Esportiva Palmeiras', 'SE Palmeiras', 'Palmeiras', 'Futebol Palmeiras', 'Sociedade Esportiva Palmeiras (futebol)'],
  },
  santos: {
    category: 'Futebolistas do Santos Futebol Clube',
    enCategory: 'Santos FC players',
    aliases: ['Santos Futebol Clube', 'Santos FC', 'Futebol Santos', 'Santos Futebol Clube (futebol)'],
  },
  gremio: {
    category: 'Futebolistas do Grêmio Foot-Ball Porto Alegrense',
    enCategory: 'Grêmio Foot-Ball Porto Alegrense players',
    aliases: ['Grêmio Foot-Ball Porto Alegrense', 'Grêmio Foot-Ball Porto-Alegrense', 'Grêmio Foot Ball Porto Alegrense', 'Grêmio FBPA', 'Grêmio', 'Futebol Grêmio', 'Gremio Foot-Ball Porto Alegrense', 'Grêmio Foot-Ball Porto Alegrense (futebol)'],
  },
  internacional: {
    category: 'Futebolistas do Sport Club Internacional',
    enCategory: 'Sport Club Internacional players',
    aliases: ['Sport Club Internacional', 'SC Internacional', 'Internacional', 'Futebol Internacional', 'Futebol Internacional-RS', 'Sport Club Internacional (futebol)'],
  },
  cruzeiro: {
    category: 'Futebolistas do Cruzeiro Esporte Clube',
    enCategory: 'Cruzeiro Esporte Clube players',
    aliases: ['Cruzeiro Esporte Clube', 'Cruzeiro EC', 'Cruzeiro', 'Futebol Cruzeiro', 'Palestra Itália (Belo Horizonte)', 'Cruzeiro Esporte Clube (futebol)'],
  },
  'atletico-mg': {
    category: 'Futebolistas do Clube Atlético Mineiro',
    enCategory: 'Clube Atlético Mineiro players',
    aliases: ['Clube Atlético Mineiro', 'Atlético Mineiro', 'Atlético-MG', 'CA Mineiro', 'Futebol Atlético Mineiro', 'Futebol Atlético-MG', 'Clube Atlético Mineiro (futebol)'],
  },
  botafogo: {
    category: 'Futebolistas do Botafogo de Futebol e Regatas',
    enCategory: 'Botafogo de Futebol e Regatas players',
    aliases: ['Botafogo de Futebol e Regatas', 'Botafogo Futebol e Regatas', 'Botafogo FR', 'Botafogo', 'Futebol Botafogo', 'Botafogo Football Club', 'Botafogo de Futebol e Regatas (futebol)'],
  },
  fluminense: {
    category: 'Futebolistas do Fluminense Football Club',
    enCategory: 'Fluminense FC players',
    aliases: ['Fluminense Football Club', 'Fluminense FC', 'Fluminense', 'Futebol Fluminense', 'Fluminense Football Club (futebol)'],
  },
  bahia: {
    category: 'Futebolistas do Esporte Clube Bahia',
    enCategory: 'Esporte Clube Bahia players',
    aliases: ['Esporte Clube Bahia', 'EC Bahia', 'Futebol Bahia', 'Esporte Clube Bahia (futebol)'],
  },
  'athletico-pr': {
    category: 'Futebolistas do Club Athletico Paranaense',
    enCategory: 'Club Athletico Paranaense players',
    aliases: ['Club Athletico Paranaense', 'Clube Atlético Paranaense', 'Athletico Paranaense', 'Atlético Paranaense', 'CA Paranaense', 'Futebol Athletico Paranaense', 'Futebol Atlético Paranaense', 'Futebol Atlético-PR', 'Futebol Athletico-PR', 'Club Athletico Paranaense (futebol)'],
  },
  coritiba: {
    category: 'Futebolistas do Coritiba Foot Ball Club',
    enCategory: 'Coritiba Foot Ball Club players',
    aliases: ['Coritiba Foot Ball Club', 'Coritiba FBC', 'Coritiba', 'Futebol Coritiba'],
  },
  vitoria: {
    category: 'Futebolistas do Esporte Clube Vitória',
    enCategory: 'Esporte Clube Vitória players',
    aliases: ['Esporte Clube Vitória', 'EC Vitória', 'Futebol Vitória', 'Esporte Clube Vitória (futebol)'],
  },
  sport: {
    category: 'Futebolistas do Sport Club do Recife',
    enCategory: 'Sport Club do Recife players',
    aliases: ['Sport Club do Recife', 'Sport Recife', 'Futebol Sport', 'Futebol Sport Recife', 'Sport Club do Recife (futebol)'],
  },
  fortaleza: {
    category: 'Futebolistas do Fortaleza Esporte Clube',
    enCategory: 'Fortaleza Esporte Clube players',
    aliases: ['Fortaleza Esporte Clube', 'Fortaleza EC', 'Futebol Fortaleza'],
  },
  ceara: {
    category: 'Futebolistas do Ceará Sporting Club',
    enCategory: 'Ceará Sporting Club players',
    aliases: ['Ceará Sporting Club', 'Ceará SC', 'Futebol Ceará'],
  },
  goias: {
    category: 'Futebolistas do Goiás Esporte Clube',
    enCategory: 'Goiás Esporte Clube players',
    aliases: ['Goiás Esporte Clube', 'Goiás EC', 'Futebol Goiás'],
  },
  // Clubes extras (usados nos estaduais de PE e GO; também disponíveis para draft)
  nautico: {
    category: 'Futebolistas do Clube Náutico Capibaribe',
    aliases: ['Clube Náutico Capibaribe', 'Náutico Capibaribe', 'Náutico', 'Futebol Náutico'],
  },
  'santa-cruz': {
    category: 'Futebolistas do Santa Cruz Futebol Clube',
    aliases: ['Santa Cruz Futebol Clube', 'Santa Cruz FC', 'Futebol Santa Cruz'],
  },
  'atletico-go': {
    category: 'Futebolistas do Atlético Clube Goianiense',
    aliases: ['Atlético Clube Goianiense', 'Atlético Goianiense', 'Futebol Atlético Goianiense', 'Futebol Atlético-GO'],
  },
  'vila-nova': {
    category: 'Futebolistas do Vila Nova Futebol Clube',
    aliases: ['Vila Nova Futebol Clube', 'Vila Nova FC', 'Futebol Vila Nova', 'Futebol Vila Nova-GO'],
  },
};

export function normalize(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const aliasIndex = new Map();
for (const [id, c] of Object.entries(WIKI_CLUBS)) {
  for (const a of c.aliases) aliasIndex.set(normalize(a), id);
}

/** Retorna o id do clube do jogo para um alvo de link/predefinição, ou null. */
export function clubIdFromAlias(target) {
  if (!target) return null;
  return aliasIndex.get(normalize(target)) ?? null;
}
