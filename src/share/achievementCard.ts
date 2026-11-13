// Arte de uma conquista desbloqueada (1080 × 1350).
import { ACHIEVEMENT_BY_ID, TIER_LABEL } from '../history/achievements';
import { decadesLabel } from '../history/record';
import type { SeasonEntry, UnlockRecord } from '../history/types';
import { C, createCanvas, drawBackground, drawBrand, drawMedal, ensureFonts, fitSize, font, goldGradient, H, roundRect, spacing, TIER_COLORS, W, wrap } from './draw';
import { fileSlug } from './export';

export interface AchievementCardInput {
  unlock: UnlockRecord;
  season: SeasonEntry | null;
  playerName?: string | null;
  playerRole?: string | null;
}

export function achievementFilename(u: UnlockRecord): string {
  return `PRAG-Conquista-${fileSlug(u.name)}.png`;
}

export async function renderAchievementCard({ unlock, season, playerName, playerRole }: AchievementCardInput): Promise<HTMLCanvasElement> {
  await ensureFonts();
  const { canvas, ctx } = createCanvas();
  const def = ACHIEVEMENT_BY_ID[unlock.id];
  const tier = unlock.tier;
  const t = TIER_COLORS[tier];
  drawBackground(ctx, season?.colors ?? null, { pitch: true });
  // brilho da raridade atrás da medalha
  const glow = ctx.createRadialGradient(W / 2, 560, 60, W / 2, 560, 620);
  glow.addColorStop(0, t.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  // raios
  ctx.save();
  ctx.translate(W / 2, 560);
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 16; i++) {
    ctx.rotate((Math.PI * 2) / 16);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-40, -700);
    ctx.lineTo(40, -700);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  drawBrand(ctx, 64, 48, 'Conquista');

  ctx.textAlign = 'center';
  font(ctx, 800, 44);
  spacing(ctx, 8);
  ctx.fillStyle = goldGradient(ctx, 210, 250);
  ctx.fillText('CONQUISTA DESBLOQUEADA!', W / 2, 250);
  spacing(ctx, 0);

  drawMedal(ctx, W / 2, 600, 190, tier, def?.icon ?? 'medal');

  // raridade
  const label = `${TIER_LABEL[tier].toUpperCase()}${def?.reward ? ` · ${def.reward.toUpperCase()}` : ''}`;
  font(ctx, 700, 26);
  spacing(ctx, 4);
  const lw = ctx.measureText(label).width + 56;
  roundRect(ctx, (W - lw) / 2, 836, lw, 52, 26);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();
  ctx.strokeStyle = t.label;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = t.label;
  ctx.fillText(label, W / 2, 871);
  spacing(ctx, 0);

  // nome
  const name = unlock.name.toUpperCase();
  const ns = fitSize(ctx, name, W - 160, 800, 120, 70);
  ctx.fillStyle = C.white;
  font(ctx, 800, ns);
  ctx.fillText(name, W / 2, 1000);

  // mensagem
  const message = def ? def.message({ value: unlock.value, detail: unlock.detail }) : '';
  font(ctx, 500, 36, '"Barlow", Arial, sans-serif');
  ctx.fillStyle = C.text2;
  wrap(ctx, message, W - 200, 3).forEach((line, i) => ctx.fillText(line, W / 2, 1066 + i * 46));

  // contexto
  const ctxLine = [
    season ? `${season.teamName}${decadesLabel(season) ? ` · ${decadesLabel(season)}` : ''} · ${season.formationId}` : null,
    playerName ? `${playerRole || 'Técnico'}: ${playerName}` : null,
  ]
    .filter(Boolean)
    .join('   ·   ');
  if (ctxLine) {
    font(ctx, 600, 26, '"Barlow", Arial, sans-serif');
    ctx.fillStyle = C.gold;
    ctx.fillText(ctxLine, W / 2, H - 120);
  }
  font(ctx, 700, 22);
  spacing(ctx, 3);
  ctx.fillStyle = C.text3;
  ctx.textAlign = 'left';
  ctx.fillText('PRAG · ONZE BR LENDÁRIO', 64, H - 40);
  ctx.textAlign = 'right';
  ctx.fillText(new Date(unlock.unlockedAt).toLocaleDateString('pt-BR'), W - 64, H - 40);
  spacing(ctx, 0);
  return canvas;
}
