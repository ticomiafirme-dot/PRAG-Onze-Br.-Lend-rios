#!/usr/bin/env node
// Exporta a base para docs/jogadores.csv (uma linha por jogador e clube).
import fs from 'node:fs';
import path from 'node:path';

const dir = 'src/data/players';
const esc = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
// Mesma tabela de src/data/types.ts (ROLE_CATEGORY): função histórica → categoria do jogo.
const CATEGORY = { GOL: 'GOL', LD: 'DEF', ZAG: 'DEF', LE: 'DEF', VOL: 'MEI', MC: 'MEI', MEI: 'MEI', PD: 'ATA', PE: 'ATA', SA: 'ATA', CA: 'ATA' };
const categories = (p) => [...new Set([p.position, ...p.secondary].map((r) => CATEGORY[r] ?? 'MEI'))];
const lines = ['clube,jogador,categoria,categorias_possiveis,funcao_historica,funcoes_secundarias,nacionalidade,decadas_e_notas,passagem,jogos,gols,jogos_selecao,nota_editorial_manual,fonte'];
for (const f of fs.readdirSync(dir).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const p of d.players) {
    const eras = Object.entries(p.eras).map(([k, v]) => `${k}:${v}`).join(' ');
    const cats = categories(p);
    lines.push([d.club, p.name, cats[0], cats.join('/'), p.position, p.secondary.join('/'), p.nationality, eras, p.years, p.apps, p.goals, p.caps, p.editorial ? 'sim' : 'não', p.source].map(esc).join(','));
  }
}
fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync('docs/jogadores.csv', lines.join('\n') + '\n');
console.log(`docs/jogadores.csv: ${lines.length - 1} linhas`);
