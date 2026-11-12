// Gerador pseudoaleatório com semente (sfc32).
// - Partidas normais: a semente vem de crypto.getRandomValues (aleatoriedade real).
// - Desafios diário/semanal: a semente vem da data, então todos recebem o mesmo sorteio.
// O estado é serializável, o que permite salvar e continuar o progresso.

export type RngState = [number, number, number, number];

export class Rng {
  private s: RngState;

  constructor(seed: number | string | RngState) {
    if (Array.isArray(seed)) {
      this.s = [...seed] as RngState;
    } else {
      const h = typeof seed === 'number' ? seed >>> 0 : hashString(seed);
      this.s = [h ^ 0x9e3779b9, h ^ 0x243f6a88, h ^ 0xb7e15162, h ^ 0xdeadbeef].map((x) => x >>> 0) as RngState;
      for (let i = 0; i < 16; i++) this.next();
    }
  }

  /** Número em [0, 1). */
  next(): number {
    let [a, b, c, d] = this.s;
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    this.s = [a, b, c, d];
    return (t >>> 0) / 4294967296;
  }

  state(): RngState {
    return [...this.s] as RngState;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('pick: lista vazia');
    return arr[Math.floor(this.next() * arr.length)];
  }

  weighted<T>(items: readonly T[], weight: (t: T) => number): T {
    let total = 0;
    for (const it of items) total += Math.max(0, weight(it));
    if (total <= 0) return this.pick(items);
    let r = this.next() * total;
    for (const it of items) {
      r -= Math.max(0, weight(it));
      if (r < 0) return it;
    }
    return items[items.length - 1];
  }

  shuffle<T>(arr: readonly T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Aproximação de normal padrão (Box–Muller). */
  normal(): number {
    const u = Math.max(1e-9, this.next());
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Amostra de Poisson (Knuth) — usada em ritmos de jogo. */
  poisson(lambda: number): number {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.next();
    } while (p > L);
    return k - 1;
  }
}

/** Hash FNV-1a de 32 bits. */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Semente realmente aleatória (Web Crypto), com alternativa segura. */
export function randomSeed(): number {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.getRandomValues) {
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    return buf[0];
  }
  return (Math.random() * 4294967296) >>> 0;
}

/** Deriva uma subsemente estável a partir de uma semente e um rótulo. */
export function subSeed(seed: number, label: string): number {
  return hashString(`${seed}:${label}`);
}
