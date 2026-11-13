// Cores de cada raridade (interface e artes).
import type { AchievementTier } from './types';

export const TIER_COLORS: Record<AchievementTier, { light: string; mid: string; dark: string; ribbon: [string, string]; glow: string; label: string }> = {
  bronze: { light: '#f6c08f', mid: '#c27a3a', dark: '#6e3d14', ribbon: ['#7a3e12', '#d08a4a'], glow: 'rgba(208,138,74,0.45)', label: '#e3a26a' },
  prata: { light: '#ffffff', mid: '#c3cad3', dark: '#5f6875', ribbon: ['#1d4ed8', '#93c5fd'], glow: 'rgba(195,202,211,0.45)', label: '#dfe4ea' },
  ouro: { light: '#fff6c4', mid: '#ffcf1f', dark: '#9a6a00', ribbon: ['#0a1d47', '#2563d6'], glow: 'rgba(255,207,31,0.55)', label: '#ffcf1f' },
  lendaria: { light: '#e6fbff', mid: '#38bdf8', dark: '#1e3a8a', ribbon: ['#15803d', '#ffcf1f'], glow: 'rgba(56,189,248,0.6)', label: '#7dd3fc' },
};
