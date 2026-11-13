// Desenho dos avatares: personagem ilustrado em estilo vetorial (traço escuro,
// sombras chapadas), enquadrado em círculo com cabeça, ombros e peito, vestindo
// a camisa do clube. O fundo e o aro seguem a cor da carta (Lenda, Ídolo...).
// Tudo é gerado como SVG, sem fotos e sem imagens externas.
import type { Club, Decade } from '../data/types';
import { crestPattern, crestShape, STAR_PATH, type CrestOp } from '../components/crestGeometry';
import type { Tier } from '../components/cardTier';
import { collarOf, type Kit } from './kits';
import { rng, type FaceShape, type HairColor, type Look, type SkinTone } from './looks';

const INK = '#1b120c';

const SKIN: Record<SkinTone, { base: string; shade: string; light: string; lip: string }> = {
  1: { base: '#f3cdb0', shade: '#d9a587', light: '#fde4d2', lip: '#d08a7a' },
  2: { base: '#e8b893', shade: '#c98f69', light: '#f6d4b6', lip: '#c27a64' },
  3: { base: '#d29b6f', shade: '#ad764d', light: '#e6b58e', lip: '#a65e49' },
  4: { base: '#b07447', shade: '#8a532f', light: '#c88d5f', lip: '#874834' },
  5: { base: '#8a5432', shade: '#683b1f', light: '#a26a45', lip: '#693325' },
  6: { base: '#5e3820', shade: '#422513', light: '#78492b', lip: '#4a2418' },
};

const HAIR: Record<HairColor, { base: string; shade: string; light: string }> = {
  black: { base: '#1e1713', shade: '#0d0907', light: '#3d312a' },
  dark: { base: '#3b2618', shade: '#21150c', light: '#5c3e29' },
  brown: { base: '#6e4527', shade: '#4a2d17', light: '#96663f' },
  blond: { base: '#d6ae58', shade: '#a47d36', light: '#f0d58c' },
  red: { base: '#a54d26', shade: '#773416', light: '#c96b3d' },
  gray: { base: '#8e8a85', shade: '#64605c', light: '#b6b2ad' },
  white: { base: '#dcd8d1', shade: '#aaa59e', light: '#f5f3ef' },
};

const EYES = { brown: '#5b3a20', dark: '#2c1b0f', hazel: '#7b5a2c', green: '#4d7a48', blue: '#4878aa' };

export const TIER_ART: Record<Tier, { light: string; mid: string; dark: string; ring: string; ringShade: string; glow: string }> = {
  lenda: { light: '#fff3b0', mid: '#f4bd16', dark: '#a87400', ring: '#ffd84a', ringShade: '#8a5c00', glow: '#fff8d8' },
  idolo: { light: '#f2c94c', mid: '#c48f00', dark: '#5e4200', ring: '#e8ae0a', ringShade: '#4a3300', glow: '#ffe7a0' },
  craque: { light: '#ffffff', mid: '#cbd3dd', dark: '#7d899a', ring: '#eef1f5', ringShade: '#5a6576', glow: '#ffffff' },
  titular: { light: '#78a6f7', mid: '#2a5cc4', dark: '#0d2460', ring: '#8fb4ff', ringShade: '#0a1d4d', glow: '#bcd3ff' },
  elenco: { light: '#7a89a5', mid: '#3c4968', dark: '#18213a', ring: '#a3aec2', ringShade: '#141b2e', glow: '#c5cee0' },
};

export interface AvatarInput {
  look: Look;
  kit: Kit;
  club: Club;
  decade: Decade;
  tier: Tier;
  /** Semente para os detalhes do fundo. */
  seed: number;
  /** Acessórios e moldura especiais (usados só no avatar exclusivo do fundador). */
  extras?: AvatarExtras;
}

export interface AvatarExtras {
  glasses?: boolean;
  /** Corrente prateada com pingente de cruz. */
  chain?: boolean;
  /** Moldura exclusiva do fundador: fundo preto e roxo, raios dourados, aro duplo com estrelas. */
  frame?: 'fundador';
}

type TierArtColors = (typeof TIER_ART)[Tier];

const FUNDADOR_ART: TierArtColors = { light: '#9d5cff', mid: '#3a1466', dark: '#07020f', ring: '#ffcf1f', ringShade: '#1c0838', glow: '#ffd84a' };

/** Raios dourados atrás do personagem (moldura do fundador). */
function goldRays(): string {
  let out = '';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const w = 0.09;
    const x1 = 100 + Math.cos(a - w) * 130;
    const y1 = 92 + Math.sin(a - w) * 130;
    const x2 = 100 + Math.cos(a + w) * 130;
    const y2 = 92 + Math.sin(a + w) * 130;
    out += `<path d="M100 92 L${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)} Z" fill="#ffcf1f" opacity="${i % 2 ? 0.1 : 0.2}"/>`;
  }
  for (let i = 0; i < 14; i++) {
    const a = i * 2.39996;
    const rr = 30 + ((i * 37) % 55);
    const x = 100 + Math.cos(a) * rr;
    const y = 80 + Math.sin(a) * rr * 0.8;
    const sz = 1 + (i % 3) * 0.6;
    out += `<path d="M${f(x)} ${f(y - sz * 2.4)} L${f(x + sz * 0.6)} ${f(y - sz * 0.6)} L${f(x + sz * 2.4)} ${f(y)} L${f(x + sz * 0.6)} ${f(y + sz * 0.6)} L${f(x)} ${f(y + sz * 2.4)} L${f(x - sz * 0.6)} ${f(y + sz * 0.6)} L${f(x - sz * 2.4)} ${f(y)} L${f(x - sz * 0.6)} ${f(y - sz * 0.6)} Z" fill="#fff1a8" opacity="0.85"/>`;
  }
  return out;
}

/** Aro do fundador: duplo, dourado, com estrelas em volta. */
function fundadorRing(): string {
  let stars = '';
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + ((i - 2) * Math.PI) / 9;
    stars += `<path d="${STAR_PATH}" transform="translate(${f(100 + Math.cos(a) * 93)} ${f(100 + Math.sin(a) * 93)}) scale(0.95)" fill="#fff1a8" stroke="#5c3b00" stroke-width="0.6"/>`;
  }
  return (
    `<circle cx="100" cy="100" r="93.5" fill="none" stroke="url(#goldRing)" stroke-width="7"/>` +
    `<circle cx="100" cy="100" r="89.6" fill="none" stroke="${INK}" stroke-width="1.6"/>` +
    `<circle cx="100" cy="100" r="97.4" fill="none" stroke="${INK}" stroke-width="1.6"/>` +
    `<circle cx="100" cy="100" r="86.5" fill="none" stroke="#ffcf1f" stroke-width="1.2" opacity="0.7"/>` +
    stars +
    `<path d="M30 58 A80 80 0 0 1 70 22" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" opacity="0.55"/>`
  );
}

/** Óculos de armação escura retangular (aro só em cima, lentes claras). */
function glasses(g: Geo): string {
  const { fx, cx, hw } = g;
  let out = '';
  for (const side of [-1, 1]) {
    const x = fx + side * 13;
    out += `<path d="M${f(x - 10.5)} 79.5 L${f(x + 10.5)} 79.5 L${f(x + 10)} 89 Q${f(x + 9.5)} 92.5 ${f(x + 6)} 92.5 L${f(x - 6)} 92.5 Q${f(x - 9.5)} 92.5 ${f(x - 10)} 89 Z" fill="#dbe8ff" fill-opacity="0.16" stroke="#3a4250" stroke-width="1.1"/>`;
    out += `<path d="M${f(x - 10.8)} 79.3 L${f(x + 10.8)} 79.3" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/>`;
    out += `<path d="M${f(x - 6)} 82 L${f(x - 2)} 85.5" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" opacity="0.55"/>`;
  }
  out += `<path d="M${f(fx - 2.6)} 80.4 Q${f(fx)} 78.6 ${f(fx + 2.6)} 80.4" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`;
  out += `<path d="M${f(fx - 23.5)} 80 L${f(cx - hw - 1)} 83.5 M${f(fx + 23.5)} 80 L${f(cx + hw + 1)} 83.5" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
  return out;
}

/** Corrente prateada com pingente de cruz, por cima da camisa. */
function chain(g: Geo): string {
  const { cx } = g;
  const silver = '#d9dee6';
  return (
    `<path d="M${f(cx - 15.5)} 137 Q${f(cx - 9)} 156 ${f(cx)} 160 Q${f(cx + 9)} 156 ${f(cx + 15.5)} 137" fill="none" stroke="#5e6672" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M${f(cx - 15.5)} 137 Q${f(cx - 9)} 156 ${f(cx)} 160 Q${f(cx + 9)} 156 ${f(cx + 15.5)} 137" fill="none" stroke="${silver}" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="1.6 1.2"/>` +
    `<path d="M${f(cx - 1.6)} 160 h3.2 v3.4 h3 v3 h-3 v7.6 h-3.2 v-7.6 h-3 v-3 h3 Z" fill="${silver}" stroke="#4a515c" stroke-width="0.9" stroke-linejoin="round"/>` +
    `<path d="M${f(cx - 0.4)} 161.5 v10" stroke="#ffffff" stroke-width="0.7" opacity="0.8"/>`
  );
}

const f = (n: number) => (Math.round(n * 10) / 10).toString();

/** Contorno ondulado (cachos) ao longo de um arco de elipse. */
function scallops(cx: number, cy: number, rx: number, ry: number, from: number, to: number, n: number, amp: number): string {
  const pts: string[] = [];
  const step = (to - from) / n;
  const at = (deg: number, k: number) => {
    const a = (deg * Math.PI) / 180;
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  };
  const [sx, sy] = at(from, 1);
  pts.push(`${f(sx)} ${f(sy)}`);
  for (let i = 0; i < n; i++) {
    const [mx, my] = at(from + step * (i + 0.5), 1 + amp);
    const [ex, ey] = at(from + step * (i + 1), 1);
    pts.push(`Q${f(mx)} ${f(my)} ${f(ex)} ${f(ey)}`);
  }
  return pts.join(' ');
}

function crestOps(op: CrestOp): string {
  switch (op.kind) {
    case 'rect':
      return `<rect x="${op.x}" y="${op.y}" width="${op.w}" height="${op.h}" fill="${op.fill}"${op.opacity != null ? ` opacity="${op.opacity}"` : ''}/>`;
    case 'path':
      return `<path d="${op.d}" fill="${op.fill}"${op.opacity != null ? ` opacity="${op.opacity}"` : ''}/>`;
    case 'ring':
      return `<circle cx="${op.cx}" cy="${op.cy}" r="${op.r}" fill="none" stroke="${op.stroke}" stroke-width="${op.width}"/>`;
  }
}

interface Geo {
  cx: number;
  fx: number;
  top: number;
  chin: number;
  hw: number;
  jw: number;
}

function geometry(look: Look): Geo {
  const dims: Record<FaceShape, { hw: number; jw: number; chin: number; top: number }> = {
    oval: { hw: 31, jw: 21, chin: 130, top: 42 },
    round: { hw: 33.5, jw: 25, chin: 127, top: 43 },
    square: { hw: 32.5, jw: 27, chin: 129, top: 42 },
    long: { hw: 29.5, jw: 20, chin: 133, top: 40 },
  };
  const d = dims[look.face];
  const cx = 100 + look.turn * 0.45;
  return { cx, fx: cx + look.turn * 0.7, ...d };
}

function facePath({ cx, hw, jw, top, chin }: Geo): string {
  return [
    `M${f(cx - hw)} 84`,
    `C${f(cx - hw)} 58 ${f(cx - hw * 0.62)} ${top} ${f(cx)} ${top}`,
    `C${f(cx + hw * 0.62)} ${top} ${f(cx + hw)} 58 ${f(cx + hw)} 84`,
    `C${f(cx + hw)} 102 ${f(cx + jw + 4)} 118 ${f(cx + 10)} ${chin - 3}`,
    `Q${f(cx)} ${chin + 1} ${f(cx - 10)} ${chin - 3}`,
    `C${f(cx - jw - 4)} 118 ${f(cx - hw)} 102 ${f(cx - hw)} 84 Z`,
  ].join(' ');
}

// ---------------------------------------------------------------- cabelo

function hairCap(g: Geo, lift: number, hairline: number, side = 80): string {
  const { cx, hw, top } = g;
  const t = top - lift;
  return [
    `M${f(cx - hw - 1.5)} ${side}`,
    `C${f(cx - hw - 3)} 54 ${f(cx - hw * 0.66)} ${f(t)} ${f(cx)} ${f(t)}`,
    `C${f(cx + hw * 0.66)} ${f(t)} ${f(cx + hw + 3)} 54 ${f(cx + hw + 1.5)} ${side}`,
    `L${f(cx + hw - 3)} ${side}`,
    `C${f(cx + hw - 3)} 66 ${f(cx + hw - 8)} ${hairline + 3} ${f(cx + 15)} ${hairline}`,
    `Q${f(cx)} ${hairline + 3.5} ${f(cx - 15)} ${hairline}`,
    `C${f(cx - hw + 8)} ${hairline + 3} ${f(cx - hw + 3)} 66 ${f(cx - hw + 3)} ${side} Z`,
  ].join(' ');
}

interface HairLayers {
  back: string;
  front: string;
}

function hairLayers(look: Look, g: Geo, r: () => number): HairLayers {
  const c = HAIR[look.hairColor];
  const { cx, hw, top } = g;
  const stroke = `stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"`;
  const shine = (d: string) => `<path d="${d}" fill="none" stroke="${c.light}" stroke-width="2.2" stroke-linecap="round" opacity="0.7"/>`;
  const fill = (d: string, extra = '') => `<path d="${d}" fill="${c.base}" ${stroke}${extra}/>`;
  let back = '';
  let front = '';
  switch (look.hair) {
    case 'bald':
      front = `<path d="M${f(cx - 14)} ${top + 9} Q${f(cx - 4)} ${top + 3} ${f(cx + 8)} ${top + 6}" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.28"/>`;
      break;
    case 'buzz':
      front = `<path d="${hairCap(g, 2.5, 57)}" fill="${c.base}" opacity="0.88"/>` + `<path d="${hairCap(g, 2.5, 57)}" fill="none" stroke="${c.shade}" stroke-width="1.4"/>`;
      break;
    case 'short':
      front = fill(hairCap(g, 7, 56)) + shine(`M${f(cx - 16)} ${top} Q${f(cx - 2)} ${top - 6} ${f(cx + 14)} ${top - 2}`);
      break;
    case 'part': {
      const t = top - 10;
      const d = [
        `M${f(cx - hw - 1.5)} 80`,
        `C${f(cx - hw - 4)} 52 ${f(cx - hw * 0.7)} ${t} ${f(cx - 4)} ${t}`,
        `C${f(cx + hw * 0.8)} ${t - 1} ${f(cx + hw + 4)} 50 ${f(cx + hw + 1.5)} 80`,
        `L${f(cx + hw - 3)} 80`,
        `C${f(cx + hw - 3)} 64 ${f(cx + hw - 10)} 58 ${f(cx + 6)} 55`,
        `C${f(cx - 6)} 53 ${f(cx - 12)} 52 ${f(cx - 16)} 48`,
        `C${f(cx - hw + 4)} 56 ${f(cx - hw + 3)} 66 ${f(cx - hw + 3)} 80 Z`,
      ].join(' ');
      front = fill(d) + `<path d="M${f(cx - 16)} 48 Q${f(cx - 12)} ${top - 4} ${f(cx - 10)} ${t + 2}" fill="none" stroke="${c.shade}" stroke-width="1.6"/>` + shine(`M${f(cx - 4)} ${t + 4} Q${f(cx + 12)} ${t + 1} ${f(cx + 22)} ${t + 8}`);
      break;
    }
    case 'curly': {
      const cap = scallops(cx, top + 16, hw + 5, 27, 170, 370, 12, 0.08);
      const d = `M${f(cx - hw + 3)} 82 L${f(cx - hw - 4)} 74 ${cap.replace(/^[^Q]*/, `L${f(cx - hw - 4)} ${top + 18} `)} L${f(cx + hw + 4)} 74 L${f(cx + hw - 3)} 82 C${f(cx + hw - 4)} 66 ${f(cx + hw - 9)} 59 ${f(cx + 14)} 57 Q${f(cx)} 60 ${f(cx - 14)} 57 C${f(cx - hw + 9)} 59 ${f(cx - hw + 4)} 66 ${f(cx - hw + 3)} 82 Z`;
      front = fill(d);
      for (let i = 0; i < 6; i++) {
        const x = cx - hw * 0.6 + (i * hw * 1.2) / 5 + (r() - 0.5) * 3;
        const y = top - 1 + (r() - 0.5) * 6 + (i === 0 || i === 5 ? 6 : 0);
        front += `<path d="M${f(x - 3)} ${f(y + 2)} q3 -4 6 0" fill="none" stroke="${c.light}" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>`;
      }
      break;
    }
    case 'afro': {
      const big = `M${f(cx - hw - 12)} 92 ${scallops(cx, top + 22, hw + 17, 40, 160, 380, 15, 0.07).replace(/^[^Q]*/, `L${f(cx - hw - 16)} ${top + 30} `)} L${f(cx + hw + 12)} 92 Z`;
      back = fill(big);
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (1.08 + (i / 8) * 0.84);
        const x = cx + Math.cos(a) * (hw + 8);
        const y = top + 20 + Math.sin(a) * 30;
        back += `<path d="M${f(x - 3)} ${f(y + 2)} q3 -4 6 0" fill="none" stroke="${c.light}" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>`;
      }
      front = `<path d="${hairCap(g, 3, 55, 78)}" fill="${c.base}"/>`;
      break;
    }
    case 'wavy': {
      const mass = `M${f(cx)} 128 ${scallops(cx, top + 34, hw + 15, 50, 100, 440, 20, 0.07).replace(/^[^Q]*/, `L${f(cx + Math.cos((100 * Math.PI) / 180) * (hw + 15))} ${f(top + 34 + Math.sin((100 * Math.PI) / 180) * 50)} `)} Z`;
      back = fill(mass);
      for (let i = 0; i < 12; i++) {
        const a = Math.PI * (0.7 + (i / 11) * 1.6);
        const x = cx + Math.cos(a) * (hw + 8);
        const y = top + 34 + Math.sin(a) * 42;
        back += `<path d="M${f(x - 3.5)} ${f(y + 2)} q3.5 -5 7 0" fill="none" stroke="${c.light}" stroke-width="1.7" stroke-linecap="round" opacity="0.7"/>`;
      }
      front = fill(scallopCap(g, 9, 57)) + shine(`M${f(cx - 10)} ${top - 3} q4 -4 8 0 q4 -4 8 0`);
      break;
    }
    case 'long': {
      const d = `M${f(cx - hw - 4)} 130 C${f(cx - hw - 11)} 100 ${f(cx - hw - 10)} ${top - 4} ${f(cx)} ${top - 9} C${f(cx + hw + 10)} ${top - 4} ${f(cx + hw + 11)} 100 ${f(cx + hw + 4)} 130 Q${f(cx)} 138 ${f(cx - hw - 4)} 130 Z`;
      back = fill(d);
      const fr = [
        `M${f(cx - hw - 2)} 104`,
        `C${f(cx - hw - 6)} 70 ${f(cx - hw * 0.6)} ${top - 9} ${f(cx + 2)} ${top - 8}`,
        `C${f(cx + hw * 0.7)} ${top - 8} ${f(cx + hw + 6)} 66 ${f(cx + hw + 2)} 104`,
        `L${f(cx + hw - 3)} 100`,
        `C${f(cx + hw - 3)} 70 ${f(cx + hw - 10)} 58 ${f(cx + 4)} 54`,
        `C${f(cx - 10)} 56 ${f(cx - hw + 4)} 64 ${f(cx - hw + 3)} 100 Z`,
      ].join(' ');
      front = fill(fr) + shine(`M${f(cx - hw + 2)} 70 Q${f(cx - hw + 6)} ${top + 4} ${f(cx - 4)} ${top - 3}`);
      break;
    }
    case 'mullet': {
      back = fill(`M${f(cx - hw - 2)} 84 C${f(cx - hw - 6)} 118 ${f(cx - 16)} 128 ${f(cx - 12)} 136 L${f(cx + 12)} 136 C${f(cx + 16)} 128 ${f(cx + hw + 6)} 118 ${f(cx + hw + 2)} 84 Z`);
      front = fill(hairCap(g, 8, 57, 86)) + shine(`M${f(cx - 14)} ${top - 1} Q${f(cx)} ${top - 7} ${f(cx + 14)} ${top - 2}`);
      break;
    }
    case 'dreads': {
      // massa de dreads atrás da cabeça, caindo até os ombros
      const mass = `M${f(cx - hw - 9)} 132 C${f(cx - hw - 14)} 96 ${f(cx - hw - 12)} ${top - 2} ${f(cx)} ${top - 9} C${f(cx + hw + 12)} ${top - 2} ${f(cx + hw + 14)} 96 ${f(cx + hw + 9)} 132 Q${f(cx)} 142 ${f(cx - hw - 9)} 132 Z`;
      back = fill(mass);
      for (let i = 0; i < 10; i++) {
        const side = i < 5 ? -1 : 1;
        const k = i % 5;
        const x0 = cx + side * (hw + 1 - k * 1.2);
        const x1 = cx + side * (hw + 7 - k * 2.4);
        const y1 = 116 + k * 4 + r() * 6;
        back += `<path d="M${f(x0)} 70 Q${f(x0 + side * 4)} 96 ${f(x1)} ${f(y1)}" fill="none" stroke="${c.shade}" stroke-width="1.6" stroke-linecap="round" opacity="0.9"/>`;
      }
      front = fill(hairCap(g, 9, 56, 84));
      for (let i = 0; i < 7; i++) {
        const x = cx - 24 + i * 8;
        front += `<path d="M${f(x)} ${top - 5} Q${f(x + 1)} ${top + 4} ${f(x - 1)} ${top + 12}" fill="none" stroke="${c.shade}" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>`;
      }
      break;
    }
    case 'cornrows': {
      // tranças rentes à cabeça, da testa para trás, presas num coque trançado
      back = `<circle cx="${f(cx + 1)}" cy="${top - 8}" r="10" fill="${c.base}" stroke="${INK}" stroke-width="2.2"/>`;
      for (let k = -1; k <= 1; k++) back += `<path d="M${f(cx - 6)} ${top - 8 + k * 4.5} q7 -3 14 0" fill="none" stroke="${c.light}" stroke-width="1.3" stroke-linecap="round" opacity="0.7"/>`;
      front = fill(hairCap(g, 4, 56, 82));
      for (let i = -3; i <= 3; i++) {
        const x0 = cx + i * 7.2;
        const x1 = cx + i * 2.6;
        front += `<path d="M${f(x0)} ${f(57.5 - Math.abs(i) * 0.3)} Q${f(x0 * 0.55 + x1 * 0.45)} ${f(top + 10)} ${f(x1)} ${f(top - 1)}" fill="none" stroke="${c.shade}" stroke-width="2" stroke-linecap="round"/>`;
        for (let t = 0; t < 3; t++) {
          const yy = 52 - t * 6.5;
          const xx = x0 + (x1 - x0) * ((57.5 - yy) / (57.5 - top + 1)) + 3.4;
          if (i < 3) front += `<path d="M${f(xx - 1.4)} ${f(yy + 1.2)} l1.4 -1.6 l1.4 1.6" fill="none" stroke="${c.light}" stroke-width="0.9" stroke-linecap="round" opacity="0.65"/>`;
        }
      }
      break;
    }
    case 'bun': {
      // cabelo preso em coque no alto da cabeça
      back = `<circle cx="${f(cx + 2)}" cy="${top - 9}" r="11.5" fill="${c.base}" stroke="${INK}" stroke-width="2.2"/><path d="M${f(cx - 4)} ${top - 12} q6 -5 12 1" fill="none" stroke="${c.light}" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>`;
      front = fill(hairCap(g, 4, 56)) + `<path d="M${f(cx - 18)} ${top + 3} Q${f(cx)} ${top - 6} ${f(cx + 18)} ${top + 3}" fill="none" stroke="${c.shade}" stroke-width="1.4"/>` + shine(`M${f(cx - 14)} ${top} Q${f(cx - 2)} ${top - 5} ${f(cx + 10)} ${top - 2}`);
      break;
    }
    case 'shortafro': {
      // black curto: volume arredondado e texturizado, rente às laterais
      const cap = scallops(cx, top + 15, hw + 6.5, 27, 168, 372, 18, 0.05);
      const d = `M${f(cx - hw + 3)} 82 L${f(cx - hw - 4.5)} 76 ${cap.replace(/^[^Q]*/, `L${f(cx - hw - 5.5)} ${top + 20} `)} L${f(cx + hw + 4.5)} 76 L${f(cx + hw - 3)} 82 C${f(cx + hw - 4)} 66 ${f(cx + hw - 9)} 59 ${f(cx + 14)} 56.5 Q${f(cx)} 58.5 ${f(cx - 14)} 56.5 C${f(cx - hw + 9)} 59 ${f(cx - hw + 4)} 66 ${f(cx - hw + 3)} 82 Z`;
      front = fill(d);
      for (let i = 0; i < 14; i++) {
        const x = cx - hw * 0.75 + r() * hw * 1.5;
        const y = top - 4 + r() * 14;
        front += `<circle cx="${f(x)}" cy="${f(y)}" r="1.1" fill="${c.light}" opacity="0.55"/>`;
      }
      break;
    }
    case 'top': {
      const sides = `<path d="${hairCap(g, 1, 58)}" fill="${c.base}" opacity="0.6"/>`;
      const tuft = [
        `M${f(cx - hw + 2)} 62`,
        `C${f(cx - hw + 1)} 46 ${f(cx - 18)} ${top - 13} ${f(cx + 2)} ${top - 14}`,
        `C${f(cx + 20)} ${top - 14} ${f(cx + hw + 1)} 44 ${f(cx + hw - 2)} 60`,
        `C${f(cx + 12)} 52 ${f(cx - 10)} 52 ${f(cx - hw + 2)} 62 Z`,
      ].join(' ');
      const strands = [-12, -4, 4, 12].map((dx) => `<path d="M${f(cx + dx - 2)} ${top - 9} Q${f(cx + dx + 1)} ${top - 2} ${f(cx + dx - 1)} ${top + 6}" fill="none" stroke="${c.shade}" stroke-width="1.3" stroke-linecap="round" opacity="0.75"/>`).join('');
      front = sides + fill(tuft) + strands + shine(`M${f(cx - 14)} ${top - 6} Q${f(cx)} ${top - 13} ${f(cx + 14)} ${top - 8}`);
      break;
    }
    case 'mohawk': {
      const sides = `<path d="${hairCap(g, 0.5, 58)}" fill="${c.base}" opacity="0.45"/>`;
      const crest = [
        `M${f(cx - 9)} 58`,
        `C${f(cx - 12)} 44 ${f(cx - 10)} ${top - 10} ${f(cx + 1)} ${top - 15}`,
        `C${f(cx + 11)} ${top - 11} ${f(cx + 12)} 44 ${f(cx + 9)} 58`,
        `Q${f(cx)} 61 ${f(cx - 9)} 58 Z`,
      ].join(' ');
      front = sides + fill(crest) + shine(`M${f(cx - 3)} ${top - 9} Q${f(cx + 2)} ${top - 12} ${f(cx + 5)} ${top - 6}`);
      break;
    }
    case 'receding': {
      const d = [
        `M${f(cx - hw - 1.5)} 82`,
        `C${f(cx - hw - 3)} 58 ${f(cx - hw * 0.66)} ${top - 4} ${f(cx)} ${top - 4}`,
        `C${f(cx + hw * 0.66)} ${top - 4} ${f(cx + hw + 3)} 58 ${f(cx + hw + 1.5)} 82`,
        `L${f(cx + hw - 3)} 82`,
        `C${f(cx + hw - 3)} 64 ${f(cx + hw - 6)} 58 ${f(cx + hw - 10)} 52`,
        `C${f(cx + 10)} 52 ${f(cx + 6)} ${top + 4} ${f(cx)} ${top + 4}`,
        `C${f(cx - 6)} ${top + 4} ${f(cx - 10)} 52 ${f(cx - hw + 10)} 52`,
        `C${f(cx - hw + 6)} 58 ${f(cx - hw + 3)} 64 ${f(cx - hw + 3)} 82 Z`,
      ].join(' ');
      front = fill(d);
      break;
    }
  }
  return { back, front };
}

function scallopCap(g: Geo, lift: number, hairline: number): string {
  const { cx, hw, top } = g;
  const cap = scallops(cx, top + 18 - lift / 2, hw + 6, 28 + lift / 2, 175, 365, 11, 0.09);
  return `M${f(cx - hw + 3)} 84 L${f(cx - hw - 5)} 78 ${cap.replace(/^[^Q]*/, `L${f(cx - hw - 5)} ${top + 16} `)} L${f(cx + hw + 5)} 78 L${f(cx + hw - 3)} 84 C${f(cx + hw - 4)} 66 ${f(cx + hw - 9)} ${hairline + 3} ${f(cx + 14)} ${hairline} Q${f(cx)} ${hairline + 3} ${f(cx - 14)} ${hairline} C${f(cx - hw + 9)} ${hairline + 3} ${f(cx - hw + 4)} 66 ${f(cx - hw + 3)} 84 Z`;
}

// ---------------------------------------------------------------- rosto

function facialHair(look: Look, g: Geo): { under: string; over: string } {
  if (look.facial === 'none') return { under: '', over: '' };
  const c = HAIR[look.hairColor];
  const { cx, fx, hw, chin } = g;
  const mustache = `<path d="M${f(fx - 12.5)} 112.5 C${f(fx - 9)} 105.5 ${f(fx - 3)} 106 ${f(fx)} 108.4 C${f(fx + 3)} 106 ${f(fx + 9)} 105.5 ${f(fx + 12.5)} 112.5 C${f(fx + 7)} 110.4 ${f(fx + 3)} 110.6 ${f(fx)} 111.2 C${f(fx - 3)} 110.6 ${f(fx - 7)} 110.4 ${f(fx - 12.5)} 112.5 Z" fill="${c.base}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`;
  const jaw = (drop: number) =>
    `M${f(cx - hw + 0.5)} 86 C${f(cx - hw + 1)} 112 ${f(cx - 18)} ${chin + drop} ${f(cx)} ${chin + drop + 1} C${f(cx + 18)} ${chin + drop} ${f(cx + hw - 1)} 112 ${f(cx + hw - 0.5)} 86 C${f(cx + hw - 4)} 100 ${f(cx + hw - 9)} 104 ${f(fx + 12)} 106.5 Q${f(fx)} 103.5 ${f(fx - 12)} 106.5 C${f(cx - hw + 9)} 104 ${f(cx - hw + 4)} 100 ${f(cx - hw + 0.5)} 86 Z`;
  switch (look.facial) {
    case 'stubble':
      return { under: `<path d="${jaw(0)}" fill="${c.shade}" opacity="0.3"/>`, over: '' };
    case 'mustache':
      return { under: '', over: mustache };
    case 'goatee':
      return {
        under: `<path d="M${f(fx - 9)} 120.5 Q${f(fx)} 118.5 ${f(fx + 9)} 120.5 Q${f(fx + 8)} ${chin - 1} ${f(fx)} ${chin + 2} Q${f(fx - 8)} ${chin - 1} ${f(fx - 9)} 120.5 Z" fill="${c.base}" stroke="${INK}" stroke-width="1.3"/>`,
        over: mustache,
      };
    case 'beard':
      return { under: `<path d="${jaw(6)}" fill="${c.base}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` + `<path d="M${f(cx - 14)} ${chin - 4} q3 3 6 0 M${f(cx + 6)} ${chin - 3} q3 3 6 0 M${f(cx - hw + 6)} 104 q2 4 5 2 M${f(cx + hw - 11)} 104 q3 2 5 -2" fill="none" stroke="${c.light}" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>`, over: mustache };
    case 'short-beard':
      return { under: `<path d="${jaw(2)}" fill="${c.base}" opacity="0.82" stroke="${c.shade}" stroke-width="1.2"/>`, over: mustache.replace('fill=', 'opacity="0.9" fill=') };
  }
}

function features(look: Look, g: Geo): string {
  const s = SKIN[look.skin];
  const h = HAIR[look.hairColor];
  const { fx, chin } = g;
  const browColor = look.hairColor === 'blond' || look.hairColor === 'white' || look.hairColor === 'gray' ? h.shade : h.base;
  const bw = 2.8 + look.brow * 0.55;
  const focused = look.expression === 'focused';
  let out = '';
  // sobrancelhas
  for (const side of [-1, 1]) {
    const x = fx + side * 13.5;
    const inner = x - side * 8;
    const outer = x + side * 8;
    out += `<path d="M${f(inner)} ${focused ? 76.5 : 75} Q${f(x)} ${focused ? 71.5 : 70.5} ${f(outer)} 73.5" fill="none" stroke="${browColor}" stroke-width="${f(bw)}" stroke-linecap="round"/>`;
  }
  // olhos
  for (const side of [-1, 1]) {
    const x = fx + side * 13;
    const ix = x + look.turn * 0.35;
    out += `<path d="M${f(x - 7)} 86 Q${f(x)} 80.6 ${f(x + 7)} 86 Q${f(x)} 89.6 ${f(x - 7)} 86 Z" fill="#fbf6ee"/>`;
    out += `<circle cx="${f(ix)}" cy="85.4" r="3.5" fill="${EYES[look.eyes]}"/><circle cx="${f(ix)}" cy="85.4" r="1.7" fill="#120a05"/><circle cx="${f(ix + 1.1)}" cy="84.3" r="0.95" fill="#ffffff"/>`;
    out += `<path d="M${f(x - 8)} 86.6 Q${f(x)} 78.8 ${f(x + 7.6)} 85.2" fill="none" stroke="${INK}" stroke-width="2.3" stroke-linecap="round"/>`;
    out += `<path d="M${f(x - 5)} 89.4 Q${f(x)} 90.6 ${f(x + 5)} 89.2" fill="none" stroke="${s.shade}" stroke-width="1.1" stroke-linecap="round"/>`;
    out += `<path d="M${f(x - 5.5)} 80.6 Q${f(x)} 77.4 ${f(x + 5.5)} 80" fill="none" stroke="${s.shade}" stroke-width="1.1" stroke-linecap="round" opacity="0.9"/>`;
  }
  // maçãs do rosto
  out += `<path d="M${f(fx - 24)} 96 Q${f(fx - 20)} 101 ${f(fx - 21)} 106" fill="none" stroke="${s.shade}" stroke-width="1.3" stroke-linecap="round" opacity="0.7"/>`;
  out += `<path d="M${f(fx + 24)} 96 Q${f(fx + 20)} 101 ${f(fx + 21)} 106" fill="none" stroke="${s.shade}" stroke-width="1.3" stroke-linecap="round" opacity="0.7"/>`;
  // nariz
  const nw = 5.5 + look.nose * 1.1;
  out += `<path d="M${f(fx + 2)} 88 Q${f(fx + 5)} 97 ${f(fx + 5.5)} 101.5" fill="none" stroke="${s.shade}" stroke-width="1.8" stroke-linecap="round"/>`;
  out += `<path d="M${f(fx - nw)} 102.5 Q${f(fx - nw - 1.5)} 106 ${f(fx - nw + 2.5)} 106.3 Q${f(fx)} 108.6 ${f(fx + nw - 2.5)} 106.3 Q${f(fx + nw + 1.5)} 106 ${f(fx + nw)} 102.5" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`;
  // boca
  const my = 114.5;
  if (look.expression === 'grin' || look.expression === 'smile') {
    const wide = look.expression === 'grin' ? 12 : 10;
    const drop = look.expression === 'grin' ? 9 : 6.5;
    out += `<path d="M${f(fx - wide)} ${my - 1} Q${f(fx)} ${my + drop} ${f(fx + wide)} ${my - 1} Q${f(fx)} ${my + 1.6} ${f(fx - wide)} ${my - 1} Z" fill="#fffaf2" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`;
    out += `<path d="M${f(fx - wide + 3)} ${f(my + drop - 1.5)} Q${f(fx)} ${f(my + drop + 1.8)} ${f(fx + wide - 3)} ${f(my + drop - 1.5)}" fill="none" stroke="${s.lip}" stroke-width="1.8" stroke-linecap="round"/>`;
    out += `<path d="M${f(fx - wide - 3.5)} ${my - 9} Q${f(fx - wide - 5.5)} ${my - 3} ${f(fx - wide - 1.5)} ${my + 1}" fill="none" stroke="${s.shade}" stroke-width="1.5" stroke-linecap="round"/>`;
    out += `<path d="M${f(fx + wide + 3.5)} ${my - 9} Q${f(fx + wide + 5.5)} ${my - 3} ${f(fx + wide + 1.5)} ${my + 1}" fill="none" stroke="${s.shade}" stroke-width="1.5" stroke-linecap="round"/>`;
  } else {
    const curve = focused ? -1.2 : 1.6;
    out += `<path d="M${f(fx - 9)} ${my} Q${f(fx)} ${f(my + curve)} ${f(fx + 9)} ${my}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;
    out += `<path d="M${f(fx - 5)} ${my + 4.5} Q${f(fx)} ${my + 6.5} ${f(fx + 5)} ${my + 4.5}" fill="none" stroke="${s.lip}" stroke-width="2" stroke-linecap="round"/>`;
  }
  // queixo
  out += `<path d="M${f(fx - 5)} ${chin - 6} Q${f(fx)} ${chin - 3.5} ${f(fx + 5)} ${chin - 6}" fill="none" stroke="${s.shade}" stroke-width="1.3" stroke-linecap="round" opacity="0.8"/>`;
  return out;
}

// ---------------------------------------------------------------- camisa

const BODY = 'M2 206 L7 178 C13 160 36 151 62 145.5 C72 143.5 79 140 84 135.5 Q100 147 116 135.5 C121 140 128 143.5 138 145.5 C164 151 187 160 193 178 L198 206 Z';

function kitPattern(kit: Kit, seedX: number): string {
  const out: string[] = [`<rect x="0" y="120" width="200" height="90" fill="${kit.base}"/>`];
  switch (kit.pattern) {
    case 'stripes':
      for (let k = -4; k <= 4; k++) out.push(`<rect x="${f(100 - 8 + k * 32 + seedX)}" y="120" width="16" height="90" fill="${kit.colors[0]}"/>`);
      break;
    case 'stripes-piped':
      for (let k = -4; k <= 4; k++) {
        const x = 100 - 8 + k * 32 + seedX;
        out.push(`<rect x="${f(x)}" y="120" width="16" height="90" fill="${kit.colors[0]}"/>`);
        out.push(`<rect x="${f(x - 2.2)}" y="120" width="2.2" height="90" fill="${kit.pipe}"/><rect x="${f(x + 16)}" y="120" width="2.2" height="90" fill="${kit.pipe}"/>`);
      }
      break;
    case 'hoops': {
      const seq = kit.colors.length > 1 ? kit.colors : [kit.colors[0]];
      let i = 0;
      for (let y = 141; y < 206; y += 26) {
        out.push(`<rect x="0" y="${y}" width="200" height="13" fill="${seq[i % seq.length]}"/>`);
        i++;
      }
      break;
    }
    case 'sash':
      out.push(`<path d="M44 138 L72 138 L168 210 L140 210 Z" fill="${kit.colors[0]}"/>`);
      break;
    case 'chest-bands': {
      const h = kit.colors.length >= 3 ? 6 : 7.5;
      kit.colors.forEach((c, i) => out.push(`<rect x="0" y="${f(163 + i * h)}" width="200" height="${f(h)}" fill="${c}"/>`));
      break;
    }
    case 'solid':
      break;
  }
  return out.join('');
}

function collar(kit: Kit, decade: Decade, skin: { base: string; shade: string }, g: Geo): string {
  const t = kit.trim;
  const stroke = `stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"`;
  switch (collarOf(decade)) {
    case 'polo-lace':
      return (
        `<path d="M91 137 L100 162 L109 137 Z" fill="${skin.base}"/><path d="M93 140 L100 160 L107 140" fill="none" stroke="${skin.shade}" stroke-width="1.4"/>` +
        `<path d="M95 147 L105 149 M95.6 152 L104.4 154 M96.4 157 L103.6 158.6" stroke="${t}" stroke-width="1.6" stroke-linecap="round"/>` +
        `<path d="M84 135 L72 151 L94 153 L91 137 Z" fill="${kit.base}" ${stroke}/><path d="M116 135 L128 151 L106 153 L109 137 Z" fill="${kit.base}" ${stroke}/>`
      );
    case 'crew':
      return `<path d="M83 134.5 Q100 151 117 134.5 L120 138.5 Q100 158 80 138.5 Z" fill="${t}" ${stroke}/>`;
    case 'crew-rib':
      return `<path d="M82 134 Q100 152 118 134 L122.5 139.5 Q100 161 77.5 139.5 Z" fill="${t}" ${stroke}/><path d="M80 137 Q100 156 120 137" fill="none" stroke="${kit.base}" stroke-width="1.4" opacity="0.7"/>`;
    case 'v-neck':
      return `<path d="M86 136 L100 158 L114 136 Z" fill="${skin.base}"/><path d="M83 134 L100 160 L117 134 L121 137.5 L100 167 L79 137.5 Z" fill="${t}" ${stroke}/>`;
    case 'polo':
      return (
        `<path d="M92 137 L100 156 L108 137 Z" fill="${skin.base}"/>` +
        `<path d="M84 134.5 L69 150 L93 155 L100 148 Z" fill="${t}" ${stroke}/><path d="M116 134.5 L131 150 L107 155 L100 148 Z" fill="${t}" ${stroke}/>` +
        `<path d="M100 156 L100 172" stroke="${INK}" stroke-width="1.3" opacity="0.7"/><circle cx="100" cy="160" r="1.4" fill="${t}" stroke="${INK}" stroke-width="0.8"/><circle cx="100" cy="166" r="1.4" fill="${t}" stroke="${INK}" stroke-width="0.8"/>`
      );
    case 'v-modern':
      return `<path d="M88 136 L100 152 L112 136 Z" fill="${skin.base}"/><path d="M85 134.5 L100 154 L115 134.5 L118 137.5 L100 159 L82 137.5 Z" fill="${t}" ${stroke}/>`;
    case 'crew-modern':
      return `<path d="M84 135 Q100 149 116 135 L118.5 138 Q100 154.5 81.5 138 Z" fill="${t}" ${stroke}/>` + (g.cx ? '' : '');
  }
}

function crestBadge(club: Club, x: number, y: number, w: number): string {
  const s = w / 100;
  const shape = crestShape(club);
  return (
    `<g transform="translate(${f(x)} ${f(y)}) scale(${s})">` +
    `<clipPath id="cr"><path d="${shape}"/></clipPath>` +
    `<g clip-path="url(#cr)">${crestPattern(club).map(crestOps).join('')}<rect x="0" y="48" width="100" height="26" fill="${club.colors.primary}" opacity="0.92"/></g>` +
    `<path d="${shape}" fill="none" stroke="#eef1f5" stroke-width="9"/><path d="${shape}" fill="none" stroke="${INK}" stroke-width="5"/>` +
    `</g>`
  );
}

// ---------------------------------------------------------------- moldura

type TierArt = TierArtColors;

function backdropDefs(t: TierArt): string {
  return (
    `<radialGradient id="bg" cx="0.35" cy="0.3" r="0.85"><stop offset="0" stop-color="${t.light}"/><stop offset="0.55" stop-color="${t.mid}"/><stop offset="1" stop-color="${t.dark}"/></radialGradient>` +
    `<radialGradient id="glow" cx="0.5" cy="0.42" r="0.5"><stop offset="0" stop-color="${t.glow}" stop-opacity="0.55"/><stop offset="1" stop-color="${t.glow}" stop-opacity="0"/></radialGradient>`
  );
}

/** Pinceladas do fundo, na cor da carta. */
function brushStrokes(t: TierArt, r: () => number): string {
  let brush = '';
  for (let i = 0; i < 9; i++) {
    const x = 10 + r() * 180;
    const y = 10 + r() * 150;
    const len = 26 + r() * 40;
    const light = i % 2 === 0;
    brush += `<path d="M${f(x)} ${f(y)} l${f(len * 0.55)} ${f(-len)}" stroke="${light ? t.light : t.dark}" stroke-width="${f(7 + r() * 9)}" stroke-linecap="round" opacity="${light ? 0.3 : 0.22}"/>`;
  }
  return brush;
}

function ring(t: TierArt): string {
  return (
    `<circle cx="100" cy="100" r="93" fill="none" stroke="${t.ring}" stroke-width="5.5"/>` +
    `<circle cx="100" cy="100" r="90.2" fill="none" stroke="${INK}" stroke-width="1.6" opacity="0.85"/>` +
    `<circle cx="100" cy="100" r="96.2" fill="none" stroke="${INK}" stroke-width="1.6" opacity="0.85"/>` +
    `<path d="M30 58 A80 80 0 0 1 70 22" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" opacity="0.5"/>`
  );
}

/** Só o fundo (para ilustrações próprias com fundo transparente). */
export function frameSvg(tier: Tier, seed: number): string {
  const t = TIER_ART[tier];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs>${backdropDefs(t)}<clipPath id="circle"><circle cx="100" cy="100" r="90"/></clipPath></defs><circle cx="100" cy="100" r="96" fill="${t.ringShade}"/><g clip-path="url(#circle)"><rect width="200" height="200" fill="url(#bg)"/>${brushStrokes(t, rng(seed))}<circle cx="100" cy="86" r="76" fill="url(#glow)"/></g></svg>`;
}

/** Só o aro (vai por cima da ilustração própria). */
export function ringSvg(tier: Tier): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${ring(TIER_ART[tier])}</svg>`;
}

// ---------------------------------------------------------------- avatar

export function avatarSvg({ look, kit, club, decade, tier, seed, extras }: AvatarInput): string {
  const r = rng(seed);
  const g = geometry(look);
  const s = SKIN[look.skin];
  const fundador = extras?.frame === 'fundador';
  const t = fundador ? FUNDADOR_ART : TIER_ART[tier];
  const { cx, hw, top, chin } = g;
  const hair = hairLayers(look, g, r);
  const beard = facialHair(look, g);
  const face = facePath(g);

  const brush = fundador ? goldRays() : brushStrokes(t, r);

  const outline = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"`;
  const stripeShift = (look.turn * 0.6) % 32;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">`,
    `<defs>`,
    backdropDefs(t),
    fundador
      ? `<linearGradient id="goldRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1a8"/><stop offset="0.35" stop-color="#ffcf1f"/><stop offset="0.7" stop-color="#b37c00"/><stop offset="1" stop-color="#ffe680"/></linearGradient>`
      : '',
    `<linearGradient id="shirt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/><stop offset="0.45" stop-color="#ffffff" stop-opacity="0"/><stop offset="0.8" stop-color="#000000" stop-opacity="0.18"/><stop offset="1" stop-color="#000000" stop-opacity="0.34"/></linearGradient>`,
    `<clipPath id="circle"><circle cx="100" cy="100" r="90"/></clipPath>`,
    `<clipPath id="face"><path d="${face}"/></clipPath>`,
    `<clipPath id="body"><path d="${BODY}"/></clipPath>`,
    `</defs>`,
    `<circle cx="100" cy="100" r="96" fill="${t.ringShade}"/>`,
    `<g clip-path="url(#circle)">`,
    `<rect width="200" height="200" fill="url(#bg)"/>${brush}<circle cx="100" cy="86" r="76" fill="url(#glow)"/>`,
    `<g transform="translate(100 114) scale(1.13) translate(-100 -110)">`,
    hair.back,
    // pescoço
    `<path d="M${f(cx - 15)} 108 L${f(cx - 16.5)} 150 Q${f(cx)} 158 ${f(cx + 16.5)} 150 L${f(cx + 15)} 108 Z" fill="${s.base}" ${outline}/>`,
    `<path d="M${f(cx - 16)} 116 Q${f(cx)} ${chin + 12} ${f(cx + 16)} 116 L${f(cx + 16.5)} 132 Q${f(cx)} 142 ${f(cx - 16.5)} 132 Z" fill="${s.shade}" opacity="0.75"/>`,
    // camisa
    `<g clip-path="url(#body)">${kitPattern(kit, stripeShift)}<rect x="0" y="120" width="200" height="90" fill="url(#shirt)"/>`,
    `<path d="M36 206 C40 186 46 172 56 160 M164 206 C160 186 154 172 144 160" fill="none" stroke="#000" stroke-width="3" opacity="0.14"/>`,
    `<path d="M20 172 C30 158 48 152 64 148" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.18"/>`,
    `</g>`,
    `<path d="${BODY}" fill="none" ${outline}/>`,
    collar(kit, decade, s, g),
    crestBadge(club, 121, 158, 15),
    extras?.chain ? chain(g) : '',
    // orelhas
    `<ellipse cx="${f(cx - hw - 0.5)}" cy="88" rx="6.5" ry="10" fill="${s.base}" ${outline}/>`,
    `<ellipse cx="${f(cx + hw + 0.5)}" cy="88" rx="6.5" ry="10" fill="${s.base}" ${outline}/>`,
    `<path d="M${f(cx - hw - 2)} 83 Q${f(cx - hw - 4.5)} 88 ${f(cx - hw - 1.5)} 93" fill="none" stroke="${s.shade}" stroke-width="1.6" stroke-linecap="round"/>`,
    `<path d="M${f(cx + hw + 2)} 83 Q${f(cx + hw + 4.5)} 88 ${f(cx + hw + 1.5)} 93" fill="none" stroke="${s.shade}" stroke-width="1.6" stroke-linecap="round"/>`,
    // rosto
    `<path d="${face}" fill="${s.base}"/>`,
    `<g clip-path="url(#face)">`,
    `<path d="M${f(cx + 9)} ${top - 2} C${f(cx + hw * 0.95)} 70 ${f(cx + hw * 0.75)} 112 ${f(cx + 4)} ${chin + 3} L${f(cx + hw + 12)} ${chin + 3} L${f(cx + hw + 12)} ${top - 2} Z" fill="${s.shade}" opacity="0.62"/>`,
    `<ellipse cx="${f(cx - hw * 0.45)}" cy="70" rx="9" ry="6" fill="${s.light}" opacity="0.55"/>`,
    `<ellipse cx="${f(cx - hw * 0.55)}" cy="99" rx="6" ry="4" fill="${s.light}" opacity="0.45"/>`,
    `<path d="M${f(cx - hw)} 50 Q${f(cx)} 62 ${f(cx + hw)} 50 L${f(cx + hw)} 40 L${f(cx - hw)} 40 Z" fill="${s.shade}" opacity="${look.hair === 'bald' || look.hair === 'receding' ? 0 : 0.35}"/>`,
    beard.under,
    `</g>`,
    `<path d="${face}" fill="none" ${outline}/>`,
    features(look, g),
    beard.over,
    extras?.glasses ? glasses(g) : '',
    hair.front,
    look.headband
      ? `<path d="M${f(cx - hw - 3.5)} 63 Q${f(cx)} 51 ${f(cx + hw + 3.5)} 63 L${f(cx + hw + 3)} 72 Q${f(cx)} 60.5 ${f(cx - hw - 3)} 72 Z" fill="#f3eee2" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M${f(cx - hw + 2)} 66 Q${f(cx)} 56.5 ${f(cx + hw - 2)} 66" fill="none" stroke="#cfc6b2" stroke-width="1.4"/>`
      : '',
    `</g>`,
    `</g>`,
    fundador ? fundadorRing() : ring(t),
    `</svg>`,
  ].join('');
}
