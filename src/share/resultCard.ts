// Arte do resultado da temporada (1080 × 1350), sempre com os dados reais e
// originais daquela temporada. Itens sem dado não aparecem.
import { CLUB_BY_ID } from '../data/clubs';
import { DIFFICULTIES } from '../engine/team';
import { decadesLabel, efficiency } from '../history/record';
import type { SeasonDetails, SeasonEntry } from '../history/types';
import { estadualOf } from '../history/competitions';
import {
  C,
  createCanvas,
  drawBackground,
  drawBrand,
  drawCrest,
  drawIcon,
  drawLogoMark,
  drawSequence,
  ellipsis,
  ensureFonts,
  fitSize,
  font,
  goldGradient,
  H,
  roundRect,
  spacing,
  W,
  wrap,
} from './draw';
import { fileSlug } from './export';

export interface ResultCardInput {
  season: SeasonEntry;
  details: SeasonDetails | null;
  /** Nome do jogador (perfil), se houver. */
  playerName?: string | null;
  /** Como o jogador aparece ("Técnico" ou um título especial, como "Presidente"). */
  playerRole?: string | null;
}

const M = 64;
const fmt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export function headline(s: SeasonEntry): { text: string; tone: 'gold' | 'silver' } {
  if (s.perfect) return { text: 'CAMPEÃO INVICTO — TEMPORADA PERFEITA', tone: 'gold' };
  if (s.triple) return { text: 'TRÍPLICE COROA', tone: 'gold' };
  if (s.champion && s.unbeaten) return { text: 'CAMPEÃO BRASILEIRO INVICTO', tone: 'gold' };
  if (s.champion) return { text: 'CAMPEÃO BRASILEIRO', tone: 'gold' };
  if (s.status === 'abandoned') return { text: `TEMPORADA INTERROMPIDA · ${s.played} JOGOS`, tone: 'silver' };
  return { text: s.position ? `${s.position}º LUGAR NO BRASILEIRÃO` : 'BRASILEIRÃO', tone: 'silver' };
}

/** Início do nome dos arquivos das artes: PRAG-<Clube>-<década(s)> */
export function fileBase(s: SeasonEntry): string {
  const decades = s.fixedDecade ? [s.fixedDecade] : s.decades;
  const dec = decades.length === 0 ? '' : decades.length <= 2 ? decades.slice().sort().join('-') : 'Varias-Decadas';
  return ['PRAG', fileSlug(s.teamName), dec].filter(Boolean).join('-');
}

/** Nome do arquivo: PRAG-<Clube>-<década(s)>-Resultado.png */
export function resultFilename(s: SeasonEntry): string {
  return `${fileBase(s)}-Resultado.png`;
}

export async function renderResultCard({ season: s, details: d, playerName, playerRole }: ResultCardInput): Promise<HTMLCanvasElement> {
  await ensureFonts();
  const { canvas, ctx } = createCanvas();
  const club = s.clubId ? CLUB_BY_ID[s.clubId] : null;
  drawBackground(ctx, s.colors);

  // 1. Cabeçalho
  const diff = DIFFICULTIES.find((x) => x.id === s.difficulty)?.name ?? '';
  drawBrand(ctx, M, 48, s.challengeLabel ? `${s.challengeLabel}` : `${s.modeLabel} · ${diff}`);

  // 2. Emblema + clube
  const heroY = 160;
  if (club) drawCrest(ctx, club, M, heroY, 228);
  else drawLogoMark(ctx, M, heroY, 228);
  const tx = M + 228 + 44;
  const tw = W - M - tx;
  ctx.textAlign = 'left';
  font(ctx, 700, 26);
  spacing(ctx, 4);
  ctx.fillStyle = C.gold;
  ctx.fillText(s.status === 'finished' ? `BRASILEIRÃO · ${s.played} RODADAS` : `BRASILEIRÃO · ${s.played} JOGOS`, tx, heroY + 30);
  spacing(ctx, 0);
  const name = s.teamName.toUpperCase();
  let size = fitSize(ctx, name, tw, 800, 118, 74);
  let nameLines = [name];
  if (size <= 74) {
    font(ctx, 800, 88);
    nameLines = wrap(ctx, name, tw, 2);
    size = 88;
  }
  ctx.fillStyle = C.white;
  let y = heroY + 30 + size * 0.95;
  for (const line of nameLines) {
    font(ctx, 800, size);
    ctx.fillText(line, tx, y);
    y += size * 0.92;
  }
  y += 6;
  const dec = decadesLabel(s, 4).toUpperCase();
  if (dec) {
    font(ctx, 700, 46);
    spacing(ctx, 2);
    ctx.fillStyle = goldGradient(ctx, y - 40, y);
    ctx.fillText(dec, tx, y);
    spacing(ctx, 0);
    y += 22;
  }
  // chips: formação e técnico
  let cx = tx;
  const chip = (text: string, strong = false) => {
    font(ctx, 700, 28);
    spacing(ctx, 1.5);
    const w = ctx.measureText(text).width + 36;
    if (cx + w > W - M) return;
    roundRect(ctx, cx, y, w, 50, 25);
    ctx.fillStyle = strong ? 'rgba(255, 207, 31, 0.16)' : 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
    ctx.strokeStyle = strong ? 'rgba(255, 207, 31, 0.6)' : 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = strong ? C.gold : C.text2;
    ctx.fillText(text, cx + 18, y + 35);
    spacing(ctx, 0);
    cx += w + 12;
  };
  chip(s.formationId, true);
  if (playerName) chip(`${(playerRole || 'Técnico').toUpperCase()}: ${playerName.toUpperCase()}`);

  // 3. Faixa de destaque
  const hl = headline(s);
  const by = 508;
  ctx.save();
  roundRect(ctx, M, by, W - 2 * M, 80, 16);
  if (hl.tone === 'gold') {
    const g = ctx.createLinearGradient(M, 0, W - M, 0);
    g.addColorStop(0, '#d99a00');
    g.addColorStop(0.5, C.goldLight);
    g.addColorStop(1, '#d99a00');
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = 'rgba(195, 202, 211, 0.14)';
  }
  ctx.fill();
  if (hl.tone !== 'gold') {
    ctx.strokeStyle = 'rgba(195, 202, 211, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
  ctx.textAlign = 'center';
  const iconW = s.perfect ? 44 : 0;
  const hs = fitSize(ctx, hl.text, W - 2 * M - 60 - iconW * 2, 800, 50, 30);
  spacing(ctx, 2);
  font(ctx, 800, hs);
  ctx.fillStyle = hl.tone === 'gold' ? C.navy : C.white;
  ctx.fillText(hl.text, W / 2, by + 40 + hs * 0.36);
  spacing(ctx, 0);
  if (s.perfect) {
    drawIcon(ctx, 'star', M + 26, by + 18, 44, C.navy);
    drawIcon(ctx, 'star', W - M - 70, by + 18, 44, C.navy);
  }

  // 4. Números grandes
  const ny = 612;
  const colW = (W - 2 * M) / 3;
  const big = [
    { v: s.position ? `${s.position}º` : '—', k: 'POSIÇÃO', gold: s.position === 1 },
    { v: String(s.points), k: 'PONTOS', gold: false },
    { v: `${s.wins}-${s.draws}-${s.losses}`, k: 'V · E · D', gold: s.perfect },
  ];
  big.forEach((b, i) => {
    const x = M + colW * i + colW / 2;
    const vs = fitSize(ctx, b.v, colW - 30, 800, 150, 80);
    ctx.fillStyle = b.gold ? goldGradient(ctx, ny, ny + 140) : C.white;
    font(ctx, 800, vs);
    ctx.fillText(b.v, x, ny + 132);
    font(ctx, 700, 26);
    spacing(ctx, 4);
    ctx.fillStyle = C.text3;
    ctx.fillText(b.k, x, ny + 176);
    spacing(ctx, 0);
    if (i > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(M + colW * i, ny + 30, 2, 140);
    }
  });

  // 5. Estatísticas
  const gy = 814;
  const gd = s.goalsFor - s.goalsAgainst;
  const tiles = [
    { v: String(s.goalsFor), k: 'GOLS MARCADOS' },
    { v: String(s.goalsAgainst), k: 'GOLS SOFRIDOS' },
    { v: `${gd > 0 ? '+' : ''}${gd}`, k: 'SALDO DE GOLS' },
    { v: `${fmt(s.metrics?.efficiency ?? efficiency(s.points, s.played))}%`, k: 'APROVEITAMENTO' },
    { v: String(Math.round(s.squadOverall)), k: 'OVERALL DO TIME' },
    { v: String(s.chemistry), k: 'QUÍMICA' },
  ];
  const tW = (W - 2 * M - 2 * 16) / 3;
  const tH = 100;
  tiles.forEach((t, i) => {
    const x = M + (i % 3) * (tW + 16);
    const ty = gy + Math.floor(i / 3) * (tH + 14);
    roundRect(ctx, x, ty, tW, tH, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'left';
    font(ctx, 800, 58);
    ctx.fillStyle = C.white;
    ctx.fillText(t.v, x + 24, ty + 60);
    font(ctx, 700, 20);
    spacing(ctx, 2.5);
    ctx.fillStyle = C.text3;
    ctx.fillText(t.k, x + 24, ty + 86);
    spacing(ctx, 0);
  });

  // 6. Destaques (capitão, artilheiro, melhor nota)
  const hy = gy + 2 * (tH + 14) + 22;
  const items: { icon: 'captain' | 'ball' | 'star'; k: string; v: string }[] = [];
  if (s.captainName) items.push({ icon: 'captain', k: 'CAPITÃO', v: s.captainName });
  if (d?.topScorer) items.push({ icon: 'ball', k: 'ARTILHEIRO', v: `${d.topScorer.name} · ${d.topScorer.goals} ${d.topScorer.goals === 1 ? 'gol' : 'gols'}` });
  if (d?.bestPlayer) items.push({ icon: 'star', k: 'DESTAQUE', v: `${d.bestPlayer.name} · nota ${d.bestPlayer.rating.toFixed(1).replace('.', ',')}` });
  if (items.length) {
    const iw = (W - 2 * M) / items.length;
    items.forEach((it, i) => {
      const x = M + iw * i;
      drawIcon(ctx, it.icon, x, hy + 6, 40, C.gold);
      ctx.textAlign = 'left';
      font(ctx, 700, 20);
      spacing(ctx, 2.5);
      ctx.fillStyle = C.text3;
      ctx.fillText(it.k, x + 52, hy + 22);
      spacing(ctx, 0);
      font(ctx, 600, 27, '"Barlow", Arial, sans-serif');
      ctx.fillStyle = C.white;
      ctx.fillText(ellipsis(ctx, it.v, iw - 64), x + 52, hy + 54);
    });
  }

  // 7. Títulos e recordes
  const ry = hy + 80;
  const chips: string[] = [];
  if (s.champion) chips.push('Brasileirão');
  if (s.copaChampion) chips.push('Copa do Brasil');
  if (s.estadualChampion) chips.push(estadualOf(s.clubId)?.short ?? 'Estadual');
  const marks = (d?.marks ?? []).filter((m) => ['goleada', 'sequencia', 'invencibilidade', 'artilheiro', 'defesa', 'ataque'].includes(m.id)).slice(0, chips.length ? 1 : 2);
  ctx.textAlign = 'left';
  let rx = M;
  for (const c of chips) {
    font(ctx, 700, 24);
    spacing(ctx, 1.5);
    const label = c.toUpperCase();
    const w = ctx.measureText(label).width + 66;
    roundRect(ctx, rx, ry, w, 46, 23);
    ctx.fillStyle = 'rgba(255, 207, 31, 0.14)';
    ctx.fill();
    drawIcon(ctx, 'trophy', rx + 12, ry + 9, 28, C.gold);
    ctx.fillStyle = C.gold;
    ctx.fillText(label, rx + 48, ry + 31);
    spacing(ctx, 0);
    rx += w + 10;
  }
  for (const m of marks) {
    font(ctx, 600, 24, '"Barlow", Arial, sans-serif');
    const label = `${m.label}: ${m.value}`;
    const w = Math.min(ctx.measureText(label).width + 36, W - M - rx);
    if (w < 160) break;
    roundRect(ctx, rx, ry, w, 46, 23);
    ctx.fillStyle = 'rgba(34, 197, 94, 0.14)';
    ctx.fill();
    ctx.fillStyle = '#86efac';
    ctx.fillText(ellipsis(ctx, label, w - 36), rx + 18, ry + 31);
    rx += w + 10;
  }

  // 8. Sequência e rodapé
  if (d?.sequence?.length) {
    ctx.textAlign = 'left';
    font(ctx, 700, 20);
    spacing(ctx, 3);
    ctx.fillStyle = C.text3;
    ctx.fillText('CAMPANHA NO BRASILEIRÃO', M, H - 122);
    spacing(ctx, 0);
    drawSequence(ctx, d.sequence, M, H - 104, W - 2 * M);
  }
  ctx.textAlign = 'left';
  font(ctx, 700, 22);
  spacing(ctx, 3);
  ctx.fillStyle = C.text3;
  ctx.fillText('PRAG · ONZE BR LENDÁRIO', M, H - 40);
  ctx.textAlign = 'right';
  const date = new Date(s.finishedAt ?? s.startedAt).toLocaleDateString('pt-BR');
  ctx.fillText(date, W - M, H - 40);
  spacing(ctx, 0);
  return canvas;
}
