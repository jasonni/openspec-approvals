const DIM = 128;

function hashToken(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    h ^= token.charCodeAt(i);
    h *= 16777619;
  }
  return Math.abs(h >>> 0);
}

export function embed(text: string): number[] {
  const vec = new Array<number>(DIM).fill(0);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff\s]/g, ' ');
  const tokens = normalized.split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    const idx = hashToken(token) % DIM;
    vec[idx] += 1;
  }

  const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0));
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
  }
  return dot;
}
