// Geometria dos emblemas originais (forma, padrão, faixa, sigla e estrelas),
// usada tanto pelo componente SVG quanto pela arte de compartilhamento (canvas).
// Sistema de coordenadas: 100 × 120.
import type { Club } from '../data/types';

export const CREST_SHAPES: Record<string, string> = {
  shield: 'M50 4 L92 15 V56 C92 84 73 103 50 116 C27 103 8 84 8 56 V15 Z',
  classic: 'M9 8 H91 V58 C91 88 71 105 50 116 C29 105 9 88 9 58 Z',
  pointed: 'M50 3 L94 20 L87 80 L50 117 L13 80 L6 20 Z',
  badge: 'M50 4 L92 27 V91 L50 116 L8 91 V27 Z',
  round: 'M50 12 A48 48 0 1 1 49.99 12 Z',
};

export const STAR_PATH = 'M0 -6 L1.76 -1.85 L5.7 -1.85 L2.5 0.7 L3.53 4.85 L0 2.4 L-3.53 4.85 L-2.5 0.7 L-5.7 -1.85 L-1.76 -1.85 Z';

export type CrestOp =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; fill: string; opacity?: number }
  | { kind: 'path'; d: string; fill: string; opacity?: number }
  | { kind: 'ring'; cx: number; cy: number; r: number; stroke: string; width: number };

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Cor de texto legível sobre o fundo dado. */
export function contrastOn(hex: string): string {
  return luminance(hex) > 0.6 ? '#0b1530' : '#ffffff';
}

export function crestShape(club: Club): string {
  return CREST_SHAPES[club.crest.shape] ?? CREST_SHAPES.shield;
}

/** Camadas do padrão do emblema (recortadas pela forma). */
export function crestPattern(club: Club): CrestOp[] {
  const { primary: p, secondary: s, accent } = club.colors;
  const full = (fill: string): CrestOp => ({ kind: 'rect', x: 0, y: 0, w: 100, h: 120, fill });
  switch (club.crest.pattern) {
    case 'stripes':
      return [full(p), ...[0, 2, 4, 6].map((i): CrestOp => ({ kind: 'rect', x: 7 + i * 13, y: 0, w: 13, h: 120, fill: s }))];
    case 'hoops':
      return [full(p), ...[0, 2, 4, 6, 8].map((i): CrestOp => ({ kind: 'rect', x: 0, y: i * 13, w: 100, h: 13, fill: s }))];
    case 'half':
      return [
        { kind: 'rect', x: 0, y: 0, w: 50, h: 120, fill: p },
        { kind: 'rect', x: 50, y: 0, w: 50, h: 120, fill: s },
        { kind: 'rect', x: 0, y: 0, w: 100, h: 36, fill: accent },
      ];
    case 'diagonal':
      return [full(p), { kind: 'path', d: 'M-10 22 L22 -10 L110 78 L78 110 Z', fill: s, opacity: 0.95 }];
    case 'cross':
      return [
        full(p),
        { kind: 'rect', x: 44, y: 0, w: 12, h: 120, fill: s, opacity: 0.18 },
        { kind: 'rect', x: 0, y: 54, w: 100, h: 12, fill: s, opacity: 0.18 },
      ];
    case 'chevron':
      return [full(p), { kind: 'path', d: 'M0 40 L50 70 L100 40 L100 62 L50 92 L0 62 Z', fill: s }];
    case 'ring':
      return [full(s), { kind: 'ring', cx: 50, cy: 60, r: 38, stroke: p, width: 14 }];
    default:
      return [full(p)];
  }
}

/** Faixa central com a sigla. */
export function crestBand(club: Club): { color: string; textColor: string; label: string; fontSize: number } {
  const color = club.colors.primary;
  const label = club.crest.initials;
  return { color, textColor: contrastOn(color), label, fontSize: label.length >= 5 ? 15 : label.length === 4 ? 18 : 22 };
}

/** Estrelas acima da faixa (centro e escala de cada uma). */
export function crestStars(club: Club): { x: number; y: number; scale: number }[] {
  const stars = club.crest.stars ?? 0;
  const y = club.crest.shape === 'round' ? 26 : 30;
  return Array.from({ length: stars }, (_, i) => ({ x: 50 + (i - (stars - 1) / 2) * 13, y, scale: stars > 2 ? 0.9 : 1.2 }));
}
