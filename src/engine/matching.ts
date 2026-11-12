// Emparelhamentos entre posições do campo e cartas de jogadores.

import type { Card } from '../data/types';
import type { Slot } from '../data/formations';
import { canPlay } from './database';

/**
 * Verifica se todas as posições podem ser preenchidas por cartas distintas
 * (pessoas distintas). Algoritmo de caminhos aumentantes (Kuhn).
 */
export function canFillAll(slots: Slot[], cards: Card[]): boolean {
  return maxMatching(slots, cards) === slots.length;
}

export function maxMatching(slots: Slot[], cards: Card[]): number {
  // Agrupa cartas por pessoa: uma pessoa só pode ocupar uma posição.
  const persons = new Map<string, Card[]>();
  for (const c of cards) {
    const arr = persons.get(c.id) ?? [];
    arr.push(c);
    persons.set(c.id, arr);
  }
  const personIds = [...persons.keys()];
  const adj: number[][] = slots.map((s) =>
    personIds.map((pid, i) => (persons.get(pid)!.some((c) => canPlay(c, s.pos)) ? i : -1)).filter((i) => i >= 0),
  );
  const matchPerson = new Array<number>(personIds.length).fill(-1);
  let result = 0;
  for (let s = 0; s < slots.length; s++) {
    const seen = new Array<boolean>(personIds.length).fill(false);
    if (augment(s, adj, matchPerson, seen)) result++;
  }
  return result;
}

function augment(s: number, adj: number[][], matchPerson: number[], seen: boolean[]): boolean {
  for (const p of adj[s]) {
    if (seen[p]) continue;
    seen[p] = true;
    if (matchPerson[p] === -1 || augment(matchPerson[p], adj, matchPerson, seen)) {
      matchPerson[p] = s;
      return true;
    }
  }
  return false;
}

/**
 * Melhor escalação possível (soma de overall máxima) — algoritmo húngaro.
 * Retorna mapa slotId -> carta. Posições sem candidato ficam de fora.
 */
export function bestLineup(slots: Slot[], cards: Card[]): Record<string, Card> {
  // Uma carta por pessoa (a de maior overall) para cada posição possível.
  const n = slots.length;
  const m = cards.length;
  if (n === 0 || m === 0) return {};
  const BIG = 1e6;
  const size = Math.max(n, m);
  // matriz de custo quadrada (minimização)
  const cost: number[][] = [];
  for (let i = 0; i < size; i++) {
    const row: number[] = [];
    for (let j = 0; j < size; j++) {
      if (i < n && j < m) row.push(canPlay(cards[j], slots[i].pos) ? 100 - cards[j].overall : BIG);
      else row.push(i < n ? BIG / 10 : 0);
    }
    cost.push(row);
  }
  const assign = hungarian(cost);
  const out: Record<string, Card> = {};
  const usedPersons = new Set<string>();
  // ordena por custo para resolver eventuais pessoas repetidas (mesma pessoa em décadas diferentes)
  const pairs = slots
    .map((s, i) => ({ s, j: assign[i] }))
    .filter(({ j }) => j >= 0 && j < m)
    .sort((a, b) => (cards[b.j]?.overall ?? 0) - (cards[a.j]?.overall ?? 0));
  for (const { s, j } of pairs) {
    const c = cards[j];
    if (!c || !canPlay(c, s.pos) || usedPersons.has(c.id)) continue;
    out[s.id] = c;
    usedPersons.add(c.id);
  }
  // completa posições que ficaram vazias por conflito de pessoa, de forma gulosa
  for (const s of slots) {
    if (out[s.id]) continue;
    const alt = cards
      .filter((c) => canPlay(c, s.pos) && !usedPersons.has(c.id))
      .sort((a, b) => b.overall - a.overall)[0];
    if (alt) {
      out[s.id] = alt;
      usedPersons.add(alt.id);
    }
  }
  return out;
}

/** Algoritmo húngaro O(n^3) para matriz quadrada. Retorna coluna atribuída a cada linha. */
function hungarian(a: number[][]): number[] {
  const n = a.length;
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(n + 1).fill(0);
  const p = new Array<number>(n + 1).fill(0);
  const way = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(n + 1).fill(Infinity);
    const used = new Array<boolean>(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = a[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const ans = new Array<number>(n).fill(-1);
  for (let j = 1; j <= n; j++) if (p[j] > 0) ans[p[j] - 1] = j - 1;
  return ans;
}
