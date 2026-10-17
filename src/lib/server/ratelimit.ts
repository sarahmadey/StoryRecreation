// A tiny in-memory limiter for sign-in attempts. Enough for a family server;
// put a real one in front if the library is ever shared widely.

const globalForLimits = globalThis as unknown as { __lanternLimits?: Map<string, number[]> };
const hits = (globalForLimits.__lanternLimits ??= new Map<string, number[]>());

export function tooManyAttempts(key: string, max = 10, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t: number) => now - t < windowMs);
  hits.set(key, recent);
  return recent.length >= max;
}

export function recordAttempt(key: string) {
  hits.set(key, [...(hits.get(key) ?? []), Date.now()]);
}

export function clearAttempts(key: string) {
  hits.delete(key);
}
