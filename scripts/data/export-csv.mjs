#!/usr/bin/env node
// Exporta a base para docs/jogadores.csv (uma linha por jogador e clube).
import fs from 'node:fs';
import path from 'node:path';

const dir = 'src/data/players';
const esc = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const lines = ['clube,jogador,posicao,posicoes_secundarias,nacionalidade,decadas_e_notas,passagem,jogos,gols,jogos_selecao,nota_editorial_manual,fonte'];
for (const f of fs.readdirSync(dir).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const p of d.players) {
    const eras = Object.entries(p.eras).map(([k, v]) => `${k}:${v}`).join(' ');
    lines.push([d.club, p.name, p.position, p.secondary.join('/'), p.nationality, eras, p.years, p.apps, p.goals, p.caps, p.editorial ? 'sim' : 'não', p.source].map(esc).join(','));
  }
}
fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync('docs/jogadores.csv', lines.join('\n') + '\n');
console.log(`docs/jogadores.csv: ${lines.length - 1} linhas`);
