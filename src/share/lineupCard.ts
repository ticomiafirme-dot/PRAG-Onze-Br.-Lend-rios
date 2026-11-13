// Arte da escalação (1080 × 1350): o campo na formação usada, com o avatar,
// o nome, o número, o overall e o capitão de cada titular, sempre com os dados
// reais daquela temporada.
import { CLUB_BY_ID } from '../data/clubs';
import { db } from '../data/db';
import { FORMATION_BY_ID } from '../data/formations';
import { decadeLabel, type Position } from '../data/types';
import { DIFFICULTIES } from '../engine/team';
import { decadesLabel } from '../history/record';
import type { LineupEntry, SeasonDetails, SeasonEntry } from '../history/types';
import { avatarFrameUrls, avatarMarkup, avatarRefOf, customAvatar } from '../avatars';
import { tierOf, type Tier } from '../components/cardTier';
import { C, createCanvas, drawBackground, drawBrand, drawCrest, drawLogoMark, ellipsis, ensureFonts, fitSize, font, goldGradient, H, roundRect, spacing, W } from './draw';
import { fileBase } from './resultCard';

export interface LineupCardInput {
  season: SeasonEntry;
  details: SeasonDetails | null;
  /** Nome do jogador (perfil), se houver. */
  playerName?: string | null;
}

type Ctx = CanvasRenderingContext2D;

const M = 64;
const PITCH = { x: 48, y: 304, w: W - 96, h: 880 };

export function hasLineup(details: SeasonDetails | null | undefined): details is SeasonDetails {
  return !!details?.lineup?.length;
}

/** Nome do arquivo: PRAG-<Clube>-<década(s)>-Escalacao.png */
export function lineupFilename(s: SeasonEntry): string {
  return `${fileBase(s)}-Escalacao.png`;
}

const CAT_ORDER: Position[] = ['GOL', 'DEF', 'MEI', 'ATA'];

/** Escalação em texto, por categoria (para acompanhar o compartilhamento). */
export function lineupText(s: SeasonEntry, d: SeasonDetails): string {
  const by = (pos: Position) =>
    d.lineup
      .filter((l) => l.pos === pos)
      .map((l) => (l.captain ? `${l.name} (C)` : l.name))
      .join(', ');
  return [
    `Minha escalação no PRAG Onze BR Lendário — ${s.teamName} (${s.formationId})`,
    ...CAT_ORDER.map((p) => `${p}: ${by(p)}`).filter((line) => !line.endsWith(': ')),
  ].join('\n');
}

const TIER_BADGE: Record<Tier, { bg: string | 'gold'; fg: string }> = {
  lenda: { bg: 'gold', fg: C.navy },
  idolo: { bg: '#c48f00', fg: '#fffbe8' },
  craque: { bg: '#e3e8ef', fg: C.navy },
  titular: { bg: '#2a5cc4', fg: C.white },
  elenco: { bg: '#3c4968', fg: C.white },
};

// ------------------------------------------------------------------ avatares

interface Face {
  img?: HTMLImageElement | null;
  frame?: HTMLImageElement | null;
  art?: HTMLImageElement | null;
  ring?: HTMLImageElement | null;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** SVG com tamanho explícito, para o navegador rasterizar nítido no canvas. */
function sizedSvgUrl(svg: string, px: number): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace('<svg ', `<svg width="${px}" height="${px}" `))}`;
}

async function loadFaces(lineup: LineupEntry[]): Promise<Map<string, Face>> {
  const out = new Map<string, Face>();
  await Promise.all(
    lineup.map(async (l) => {
      const card = db.cardMaybe(l.cardKey);
      if (!card) return;
      const ref = avatarRefOf(card, tierOf(l.overall));
      const custom = customAvatar(ref);
      if (custom) {
        const urls = avatarFrameUrls(ref);
        const [frame, art, ring] = await Promise.all([loadImage(urls.frame), loadImage(custom), loadImage(urls.ring)]);
        if (art) {
          out.set(l.slotId, { frame, art, ring });
          return;
        }
      }
      out.set(l.slotId, { img: await loadImage(sizedSvgUrl(avatarMarkup(ref), 256)) });
    }),
  );
  return out;
}

function initialsOf(name: string): string {
  const parts = name.replace(/\(.*\)/, '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function drawFace(ctx: Ctx, face: Face | undefined, l: LineupEntry, cx: number, cy: number, d: number): void {
  const x = cx - d / 2;
  const y = cy - d / 2;
  if (face?.img) {
    ctx.drawImage(face.img, x, y, d, d);
    return;
  }
  if (face?.art) {
    if (face.frame) ctx.drawImage(face.frame, x, y, d, d);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, d * 0.45, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(face.art, cx - d * 0.45, cy - d * 0.45, d * 0.9, d * 0.9);
    ctx.restore();
    if (face.ring) ctx.drawImage(face.ring, x, y, d, d);
    return;
  }
  // sem imagem: círculo com as iniciais
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, d / 2 - 3, 0, Math.PI * 2);
  ctx.fillStyle = '#1a2a55';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.stroke();
  ctx.fillStyle = C.white;
  ctx.textAlign = 'center';
  font(ctx, 800, d * 0.36);
  ctx.fillText(initialsOf(l.name), cx, cy + d * 0.13);
  ctx.restore();
}

// ------------------------------------------------------------------ campo

function drawPitch(ctx: Ctx): void {
  const { x, y, w, h } = PITCH;
  ctx.save();
  roundRect(ctx, x, y, w, h, 30);
  ctx.clip();
  const grass = ctx.createLinearGradient(0, y, 0, y + h);
  grass.addColorStop(0, '#1d8a45');
  grass.addColorStop(1, '#126437');
  ctx.fillStyle = grass;
  ctx.fillRect(x, y, w, h);
  const bands = 11;
  for (let i = 0; i < bands; i += 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    ctx.fillRect(x, y + (i * h) / bands, w, h / bands);
  }
  const vignette = ctx.createRadialGradient(x + w / 2, y + h / 2, h * 0.25, x + w / 2, y + h / 2, h * 0.8);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vignette;
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 4;
  const m = 24;
  ctx.strokeRect(x + m, y + m, w - 2 * m, h - 2 * m);
  ctx.beginPath();
  ctx.moveTo(x + m, y + h / 2);
  ctx.lineTo(x + w - m, y + h / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, h * 0.1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, 6, 0, Math.PI * 2);
  ctx.fill();
  // grandes áreas, pequenas áreas e meias-luas (ataque em cima, defesa embaixo)
  const bw = w * 0.56;
  const bh = h * 0.15;
  const sw = w * 0.26;
  const sh = h * 0.06;
  for (const top of [true, false]) {
    const by = top ? y + m : y + h - m - bh;
    const sy = top ? y + m : y + h - m - sh;
    ctx.strokeRect(x + (w - bw) / 2, by, bw, bh);
    ctx.strokeRect(x + (w - sw) / 2, sy, sw, sh);
    ctx.beginPath();
    if (top) ctx.arc(x + w / 2, by + bh, h * 0.06, 0.15 * Math.PI, 0.85 * Math.PI);
    else ctx.arc(x + w / 2, by, h * 0.06, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();
  roundRect(ctx, x, y, w, h, 30);
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

/**
 * Posição de uma vaga (coordenadas da formação em %) no campo da arte. As
 * linhas de linha usam a faixa de 12% a 80% da altura; o goleiro fica fixo
 * junto ao gol, para não encostar nos zagueiros.
 */
function slotPoint(sx: number, sy: number, goalkeeper: boolean): { x: number; y: number } {
  const { x, y, w, h } = PITCH;
  const px = x + 76 + ((sx - 8) / 84) * (w - 152);
  if (goalkeeper) return { x: px, y: y + h - 92 };
  const t = (Math.min(80, Math.max(12, sy)) - 12) / 68;
  return { x: px, y: y + 86 + t * (h - 312) };
}

function drawPlayer(ctx: Ctx, l: LineupEntry, face: Face | undefined, px: number, py: number, mixed: boolean): void {
  const D = 104;
  const cy = py - 8;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  ctx.beginPath();
  ctx.arc(px, cy, D / 2 - 4, 0, Math.PI * 2);
  ctx.fillStyle = '#0b1530';
  ctx.fill();
  ctx.restore();
  drawFace(ctx, face, l, px, cy, D);

  // overall
  const tier = tierOf(l.overall);
  const badge = TIER_BADGE[tier];
  const bx = px - D / 2 - 10;
  const by = cy - D / 2 - 4;
  roundRect(ctx, bx, by, 48, 36, 10);
  ctx.fillStyle = badge.bg === 'gold' ? goldGradient(ctx, by, by + 36) : badge.bg;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.stroke();
  ctx.fillStyle = badge.fg;
  ctx.textAlign = 'center';
  font(ctx, 800, 27);
  ctx.fillText(String(l.overall), bx + 24, by + 27);

  // capitão
  if (l.captain) {
    const ax = px + D / 2 - 4;
    const ay = cy - D / 2 + 12;
    ctx.beginPath();
    ctx.arc(ax, ay, 18, 0, Math.PI * 2);
    ctx.fillStyle = goldGradient(ctx, ay - 18, ay + 18);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.navy;
    ctx.stroke();
    ctx.fillStyle = C.navy;
    font(ctx, 800, 23);
    ctx.fillText('C', ax, ay + 8);
  }

  // década (e o clube, quando o time mistura clubes)
  const club = mixed ? CLUB_BY_ID[l.club]?.short : null;
  const tag = [decadeLabel(l.decade).replace('Anos ', "'"), club].filter(Boolean).join(' ');
  font(ctx, 700, 18);
  spacing(ctx, 1);
  const tagW = ctx.measureText(tag).width + 16;
  const tagX = px + D / 2 - tagW + 14;
  const tagY = cy + D / 2 - 24;
  roundRect(ctx, tagX, tagY, tagW, 24, 12);
  ctx.fillStyle = 'rgba(3, 10, 30, 0.88)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.stroke();
  ctx.fillStyle = C.white;
  ctx.fillText(tag, tagX + tagW / 2, tagY + 18);
  spacing(ctx, 0);

  // número e nome
  const num = String(l.number);
  const name = l.name.toUpperCase();
  font(ctx, 800, 23);
  spacing(ctx, 0.5);
  const numW = ctx.measureText(num).width;
  const maxName = 176 - numW - 30;
  const shown = ellipsis(ctx, name, maxName);
  const nameW = ctx.measureText(shown).width;
  const pillW = numW + nameW + 30;
  const pillY = py + 46;
  roundRect(ctx, px - pillW / 2, pillY, pillW, 32, 16);
  ctx.fillStyle = 'rgba(3, 10, 30, 0.86)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.stroke();
  ctx.textAlign = 'left';
  const tx = px - pillW / 2 + 13;
  ctx.fillStyle = C.gold;
  ctx.fillText(num, tx, pillY + 24);
  ctx.fillStyle = C.white;
  ctx.fillText(shown, tx + numW + 7, pillY + 24);
  spacing(ctx, 0);
}

// ------------------------------------------------------------------ arte

export async function renderLineupCard(input: LineupCardInput, opts: { avatars?: boolean } = {}): Promise<HTMLCanvasElement> {
  const { season: s, details: d, playerName } = input;
  if (!hasLineup(d)) throw new Error('Esta temporada não tem a escalação registrada.');
  await ensureFonts();
  const faces = opts.avatars === false ? new Map<string, Face>() : await loadFaces(d.lineup);
  const { canvas, ctx } = createCanvas();
  const club = s.clubId ? CLUB_BY_ID[s.clubId] : null;
  drawBackground(ctx, s.colors, { pitch: false });

  // 1. Cabeçalho
  drawBrand(ctx, M, 48, 'Escalação');
  const ty = 150;
  if (club) drawCrest(ctx, club, M, ty - 4, 92);
  else drawLogoMark(ctx, M - 6, ty - 8, 104);
  const tx = M + 120;
  const tw = W - M - tx;
  ctx.textAlign = 'left';
  const name = s.teamName.toUpperCase();
  const ns = fitSize(ctx, name, tw, 800, 74, 44);
  font(ctx, 800, ns);
  ctx.fillStyle = C.white;
  ctx.fillText(ellipsis(ctx, name, tw), tx, ty + 56);
  const diff = DIFFICULTIES.find((x) => x.id === s.difficulty)?.name ?? '';
  const sub = [s.formationId, decadesLabel(s).toUpperCase(), (s.challengeLabel ?? s.modeLabel).toUpperCase(), diff.toUpperCase()].filter(Boolean).join(' · ');
  font(ctx, 700, 27);
  spacing(ctx, 2);
  ctx.fillStyle = C.gold;
  ctx.fillText(ellipsis(ctx, sub, tw), tx, ty + 96);
  if (playerName) {
    font(ctx, 600, 22);
    ctx.fillStyle = C.text2;
    ctx.fillText(ellipsis(ctx, `TÉCNICO: ${playerName.toUpperCase()}`, tw), tx, ty + 128);
  }
  spacing(ctx, 0);

  // 2. Campo com os titulares na formação
  drawPitch(ctx);
  const formation = FORMATION_BY_ID[s.formationId];
  const mixed = !s.clubId || new Set(d.lineup.map((l) => l.club)).size > 1;
  const order = new Map(formation?.slots.map((sl, i) => [sl.id, i]) ?? []);
  const lineup = [...d.lineup].sort((a, b) => (order.get(a.slotId) ?? 99) - (order.get(b.slotId) ?? 99));
  // de trás para a frente, para os nomes de cima ficarem por cima
  for (const l of lineup.reverse()) {
    const slot = formation?.slots.find((sl) => sl.id === l.slotId);
    if (!slot) continue;
    const p = slotPoint(slot.x, slot.y, slot.pos === 'GOL');
    drawPlayer(ctx, l, faces.get(l.slotId), p.x, p.y, mixed);
  }

  // 3. Rodapé: força do time e campanha
  const fy = PITCH.y + PITCH.h + 22;
  const blocks: { k: string; v: string; gold?: boolean }[] = [
    { k: 'OVERALL DO TIME', v: String(Math.round(s.squadOverall)) },
    { k: 'QUÍMICA', v: String(s.chemistry) },
    s.status === 'finished' && s.position
      ? { k: 'CAMPANHA', v: `${s.position}º · ${s.points} PTS · ${s.wins}-${s.draws}-${s.losses}`, gold: s.champion }
      : { k: 'CAMPANHA', v: `${s.played} JOGOS · ${s.points} PTS` },
  ];
  const widths = [0.29, 0.19, 0.52].map((f) => (W - 2 * M) * f);
  let bx = M;
  blocks.forEach((b, i) => {
    ctx.textAlign = 'left';
    font(ctx, 700, 20);
    spacing(ctx, 3);
    ctx.fillStyle = C.text3;
    ctx.fillText(b.k, bx, fy + 22);
    spacing(ctx, 0);
    const vs = fitSize(ctx, b.v, widths[i] - 16, 800, 50, 30);
    font(ctx, 800, vs);
    ctx.fillStyle = b.gold ? goldGradient(ctx, fy + 30, fy + 80) : C.white;
    ctx.fillText(b.v, bx, fy + 72);
    bx += widths[i];
  });
  font(ctx, 700, 21);
  spacing(ctx, 3);
  ctx.fillStyle = C.text3;
  ctx.textAlign = 'left';
  ctx.fillText('PRAG · ONZE BR LENDÁRIO', M, H - 26);
  ctx.textAlign = 'right';
  const when = new Date(s.finishedAt ?? s.startedAt);
  ctx.fillText(when.toLocaleDateString('pt-BR'), W - M, H - 26);
  spacing(ctx, 0);

  // Garante que a arte pode ser exportada; se algum navegador bloquear os
  // avatares desenhados, refaz a arte com as iniciais no lugar.
  if (opts.avatars !== false) {
    try {
      ctx.getImageData(0, 0, 1, 1);
    } catch {
      return renderLineupCard(input, { avatars: false });
    }
  }
  return canvas;
}
