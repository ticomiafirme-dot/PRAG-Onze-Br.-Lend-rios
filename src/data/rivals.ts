// Clássicos regionais entre os clubes do jogo (usados pela conquista "Dono do
// Clássico"). A relação é simétrica: se A é rival de B, B é rival de A.

const DERBIES: [string, string][] = [
  // São Paulo: Majestoso, Derby, San-São, Choque-Rei, Clássico Alvinegro...
  ['corinthians', 'palmeiras'],
  ['corinthians', 'sao-paulo'],
  ['corinthians', 'santos'],
  ['palmeiras', 'sao-paulo'],
  ['palmeiras', 'santos'],
  ['sao-paulo', 'santos'],
  // Rio: Fla-Flu, Clássico dos Milhões, Clássico Vovô...
  ['flamengo', 'fluminense'],
  ['flamengo', 'vasco'],
  ['flamengo', 'botafogo'],
  ['fluminense', 'vasco'],
  ['fluminense', 'botafogo'],
  ['vasco', 'botafogo'],
  // Grenal, clássico mineiro, Atletiba, Ba-Vi, Clássico-Rei
  ['gremio', 'internacional'],
  ['atletico-mg', 'cruzeiro'],
  ['athletico-pr', 'coritiba'],
  ['bahia', 'vitoria'],
  ['ceara', 'fortaleza'],
  // Goiânia e Recife
  ['goias', 'vila-nova'],
  ['goias', 'atletico-go'],
  ['vila-nova', 'atletico-go'],
  ['sport', 'nautico'],
  ['sport', 'santa-cruz'],
  ['nautico', 'santa-cruz'],
];

export const RIVALS: Record<string, string[]> = {};
for (const [a, b] of DERBIES) {
  (RIVALS[a] ??= []).push(b);
  (RIVALS[b] ??= []).push(a);
}

export function isDerby(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && (RIVALS[a] ?? []).includes(b);
}
