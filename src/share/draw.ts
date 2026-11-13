// Ferramentas de desenho das artes (canvas 2D). Usam a logo oficial do jogo e
// os mesmos traços dos escudos e dos ícones da interface.
import type { Club } from '../data/types';
import { crestBand, crestPattern, crestShape, crestStars, STAR_PATH } from '../components/crestGeometry';
import { ICONS, type IconName } from '../components/icons';
import { LOGO_URL } from '../components/Logo';
import type { AchievementTier } from '../history/types';
import { TIER_COLORS } from '../history/tiers';

export { TIER_COLORS };

export const W = 1080;
export const H = 1350;
export const DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif';
export const TEXT = 'Barlow, Arial, sans-serif';

export const C = {
  bg0: '#040a1c',
  bg1: '#0a1b42',
  navy: '#0b1530',
  blue: '#1a4fb5',
  gold: '#ffcf1f',
  gold2: '#f2b705',
  goldLight: '#fff1a8',
  silver: '#c3cad3',
  white: '#ffffff',
  text2: '#c9d3e6',
  text3: '#8796b5',
  green: '#22c55e',
  greenDark: '#15803d',
  red: '#ef4444',
  amber: '#f59e0b',
};

type Ctx = CanvasRenderingContext2D;

/** Garante que as fontes do jogo estejam prontas antes de desenhar. */
export async function ensureFonts(): Promise<void> {
  const specs = [`800 64px ${DISPLAY}`, `700 64px ${DISPLAY}`, `600 64px ${DISPLAY}`, `400 32px ${TEXT}`, `500 32px ${TEXT}`, `600 32px ${TEXT}`];
  const fonts = document.fonts?.load ? specs.map((s) => document.fonts.load(s).catch(() => [])) : [];
  await Promise.all([...fonts, ensureLogo()]);
}

let logoImage: HTMLImageElement | null = null;
let logoLoading: Promise<void> | null = null;

/** Carrega a logo uma vez; as artes esperam por ela antes de desenhar. */
function ensureLogo(): Promise<void> {
  logoLoading ??= new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      logoImage = img;
      resolve();
    };
    img.onerror = () => {
      logoLoading = null; // tenta de novo na próxima arte
      resolve();
    };
    img.src = LOGO_URL;
  });
  return logoLoading;
}

export function createCanvas(w = W, h = H): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.textBaseline = 'alphabetic';
  return { canvas, ctx };
}

export function font(ctx: Ctx, weight: number, size: number, family = DISPLAY): void {
  ctx.font = `${weight} ${size}px ${family}`;
}

export function spacing(ctx: Ctx, px: number): void {
  (ctx as unknown as { letterSpacing?: string }).letterSpacing = `${px}px`;
}

/** Maior tamanho de fonte (entre min e max) em que o texto cabe na largura. */
export function fitSize(ctx: Ctx, text: string, maxWidth: number, weight: number, max: number, min: number, family = DISPLAY): number {
  for (let size = max; size > min; size -= 2) {
    font(ctx, weight, size, family);
    if (ctx.measureText(text).width <= maxWidth) return size;
  }
  font(ctx, weight, min, family);
  return min;
}

/** Quebra o texto em linhas que cabem na largura (com a fonte atual). */
export function wrap(ctx: Ctx, text: string, maxWidth: number, maxLines = 3): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines;
}

/** Corta o texto com reticências se não couber. */
export function ellipsis(ctx: Ctx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function goldGradient(ctx: Ctx, y0: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, C.goldLight);
  g.addColorStop(0.45, C.gold);
  g.addColorStop(1, '#d99a00');
  return g;
}

export function drawIcon(ctx: Ctx, name: IconName, x: number, y: number, size: number, color: string | CanvasGradient): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(ICONS[name]), 'evenodd');
  ctx.restore();
}

/** Fundo escuro com holofote, linhas de campo e detalhes nas cores do clube. */
export function drawBackground(ctx: Ctx, colors: { primary: string; secondary: string } | null, opts: { pitch?: boolean } = {}): void {
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, C.bg1);
  base.addColorStop(0.55, '#071231');
  base.addColorStop(1, C.bg0);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // holofote
  const spot = ctx.createRadialGradient(W * 0.5, -120, 40, W * 0.5, 120, 900);
  spot.addColorStop(0, 'rgba(37, 99, 214, 0.55)');
  spot.addColorStop(1, 'rgba(37, 99, 214, 0)');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, W, H);

  if (colors) {
    // faixas diagonais nas cores do clube (canto superior direito)
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.translate(W, 0);
    ctx.rotate(Math.PI / 4);
    const stripes = [colors.primary, colors.secondary, colors.primary];
    stripes.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(-60 + i * 46, -420, 34, 840);
    });
    ctx.restore();
    // barra lateral
    const bar = ctx.createLinearGradient(0, 0, 0, H);
    bar.addColorStop(0, colors.primary);
    bar.addColorStop(1, colors.secondary);
    ctx.fillStyle = bar;
    ctx.fillRect(0, 0, 14, H);
  }

  if (opts.pitch !== false) {
    // linhas de campo, discretas, na parte de baixo
    ctx.save();
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.10)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(W / 2, H + 40, 220, Math.PI, 2 * Math.PI);
    ctx.stroke();
    ctx.strokeRect(W / 2 - 300, H - 96, 600, 120);
    ctx.restore();
  }
}

/** Emblema do clube (mesma geometria do componente da interface). */
export function drawCrest(ctx: Ctx, club: Club, x: number, y: number, width: number): void {
  const s = width / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const shape = new Path2D(crestShape(club));
  ctx.save();
  ctx.clip(shape);
  for (const op of crestPattern(club)) {
    ctx.globalAlpha = 'opacity' in op && op.opacity != null ? op.opacity : 1;
    if (op.kind === 'rect') {
      ctx.fillStyle = op.fill;
      ctx.fillRect(op.x, op.y, op.w, op.h);
    } else if (op.kind === 'path') {
      ctx.fillStyle = op.fill;
      ctx.fill(new Path2D(op.d));
    } else {
      ctx.strokeStyle = op.stroke;
      ctx.lineWidth = op.width;
      ctx.beginPath();
      ctx.arc(op.cx, op.cy, op.r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  const band = crestBand(club);
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = band.color;
  ctx.fillRect(0, 48, 100, 26);
  ctx.globalAlpha = 1;
  const shine = ctx.createLinearGradient(0, 0, 0, 120);
  shine.addColorStop(0, 'rgba(255,255,255,0.28)');
  shine.addColorStop(0.5, 'rgba(255,255,255,0)');
  shine.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, 100, 120);
  ctx.restore();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#e8edf3';
  ctx.stroke(shape);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.stroke(shape);
  font(ctx, 800, band.fontSize);
  spacing(ctx, 0.5);
  ctx.textAlign = 'center';
  ctx.fillStyle = band.textColor;
  ctx.fillText(band.label, 50, 66.5);
  spacing(ctx, 0);
  for (const st of crestStars(club)) {
    ctx.save();
    ctx.translate(st.x, st.y);
    ctx.scale(st.scale, st.scale);
    const p = new Path2D(STAR_PATH);
    ctx.fillStyle = '#ffd23a';
    ctx.fill(p);
    ctx.lineWidth = 0.4;
    ctx.strokeStyle = '#7a5a00';
    ctx.stroke(p);
    ctx.restore();
  }
  ctx.restore();
}

/** Logo oficial do PRAG Onze BR Lendário (PNG transparente, quadrado). */
export function drawLogoMark(ctx: Ctx, x: number, y: number, size: number): void {
  if (logoImage) ctx.drawImage(logoImage, x, y, size, size);
}

/** Cabeçalho padrão: emblema + "ONZE BR LENDÁRIO · PRAG". */
export function drawBrand(ctx: Ctx, x: number, y: number, right?: string): void {
  drawLogoMark(ctx, x, y - 4, 88);
  x += 12;
  ctx.textAlign = 'left';
  font(ctx, 800, 40);
  spacing(ctx, 3);
  ctx.fillStyle = C.white;
  ctx.fillText('ONZE BR', x + 92, y + 40);
  const w = ctx.measureText('ONZE BR ').width;
  ctx.fillStyle = '#7ea6ff';
  font(ctx, 800, 26);
  ctx.fillText('PRAG', x + 92 + w, y + 40);
  font(ctx, 800, 40);
  ctx.fillStyle = goldGradient(ctx, y + 44, y + 80);
  ctx.fillText('LENDÁRIO', x + 92, y + 80);
  spacing(ctx, 0);
  if (right) {
    ctx.textAlign = 'right';
    font(ctx, 700, 26);
    spacing(ctx, 3);
    ctx.fillStyle = C.text2;
    ctx.fillText(right.toUpperCase(), W - 64, y + 56);
    spacing(ctx, 0);
  }
}

/** Medalha com fita, aro e o ícone da conquista. */
export function drawMedal(ctx: Ctx, cx: number, cy: number, r: number, tier: AchievementTier, icon: IconName, locked = false): void {
  const t = TIER_COLORS[tier];
  ctx.save();
  if (locked) ctx.globalAlpha = 0.35;
  // fitas
  const rw = r * 0.42;
  const top = cy - r * 2.05;
  ctx.fillStyle = t.ribbon[0];
  ctx.beginPath();
  ctx.moveTo(cx - rw * 1.6, top);
  ctx.lineTo(cx - rw * 0.1, top);
  ctx.lineTo(cx + rw * 0.35, cy - r * 0.6);
  ctx.lineTo(cx - rw * 0.9, cy - r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = t.ribbon[1];
  ctx.beginPath();
  ctx.moveTo(cx + rw * 0.1, top);
  ctx.lineTo(cx + rw * 1.6, top);
  ctx.lineTo(cx + rw * 0.9, cy - r * 0.6);
  ctx.lineTo(cx - rw * 0.35, cy - r * 0.6);
  ctx.closePath();
  ctx.fill();
  // brilho
  if (!locked) {
    const glow = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.7);
    glow.addColorStop(0, t.glow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  // aro
  const rim = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  rim.addColorStop(0, t.light);
  rim.addColorStop(0.5, t.dark);
  rim.addColorStop(1, t.mid);
  ctx.fillStyle = tier === 'lendaria' ? goldGradient(ctx, cy - r, cy + r) : rim;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // disco
  const disc = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r * 0.86);
  disc.addColorStop(0, t.light);
  disc.addColorStop(0.55, t.mid);
  disc.addColorStop(1, t.dark);
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.84, 0, Math.PI * 2);
  ctx.fill();
  // ícone
  const size = r * 0.95;
  drawIcon(ctx, icon, cx - size / 2 + 2, cy - size / 2 + 3, size, 'rgba(0,0,0,0.35)');
  drawIcon(ctx, icon, cx - size / 2, cy - size / 2, size, tier === 'prata' ? '#1b2c57' : tier === 'lendaria' ? '#ffffff' : t.dark);
  // reflexo
  ctx.globalAlpha = locked ? 0.15 : 0.35;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.32, cy - r * 0.42, r * 0.34, r * 0.14, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Selo com a sequência de resultados (quadrados verde/amarelo/vermelho). */
export function drawSequence(ctx: Ctx, seq: ('V' | 'E' | 'D')[], x: number, y: number, width: number): void {
  if (!seq.length) return;
  const gap = 4;
  const cell = Math.min(22, (width - gap * (seq.length - 1)) / seq.length);
  const total = seq.length * cell + (seq.length - 1) * gap;
  let cx = x + (width - total) / 2;
  for (const r of seq) {
    ctx.fillStyle = r === 'V' ? C.green : r === 'E' ? C.amber : C.red;
    roundRect(ctx, cx, y, cell, cell, 4);
    ctx.fill();
    cx += cell + gap;
  }
}
