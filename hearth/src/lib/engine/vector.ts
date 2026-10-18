export type Vec = number[];

export function dot(a: Vec, b: Vec): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function norm(a: Vec): number {
  return Math.sqrt(dot(a, a));
}

export function normalise(a: Vec): Vec {
  const n = norm(a);
  return n === 0 ? a.slice() : a.map((x) => x / n);
}

export function cosine(a: Vec, b: Vec): number {
  const na = norm(a);
  const nb = norm(b);
  return na === 0 || nb === 0 ? 0 : dot(a, b) / (na * nb);
}

export function zeros(n: number): Vec {
  return new Array<number>(n).fill(0);
}

export function addScaled(target: Vec, v: Vec, scale: number): void {
  for (let i = 0; i < target.length; i++) target[i] += v[i] * scale;
}

/** Weighted mean of vectors; returns null for an empty set. */
export function weightedMean(vectors: { v: Vec; w: number }[]): Vec | null {
  if (vectors.length === 0) return null;
  const out = zeros(vectors[0].v.length);
  let total = 0;
  for (const { v, w } of vectors) {
    addScaled(out, v, w);
    total += w;
  }
  return total === 0 ? null : out.map((x) => x / total);
}

export function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}
