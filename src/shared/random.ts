/**
 * Cryptographically strong, unbiased random integer and shuffle utilities.
 * Uses `crypto.getRandomValues` with rejection sampling when available so
 * every deck permutation is uniform and free of modulo bias.
 */

export function secureRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;

  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    while (true) {
      cryptoObj.getRandomValues(buf);
      const value = buf[0];
      if (value < limit) {
        return value % maxExclusive;
      }
    }
  }

  return Math.floor(Math.random() * maxExclusive);
}

/**
 * Pure Fisher-Yates shuffle returning a new array.
 * - When `rng` is explicitly passed (e.g. deterministic tests), runs a single Fisher-Yates pass with `rng`.
 * - Otherwise uses 2 independent CSPRNG Fisher-Yates passes plus a random cut.
 */
export function secureShuffle<T>(items: readonly T[], rng?: () => number): T[] {
  const copy = [...items];
  if (copy.length <= 1) return copy;

  if (rng) {
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  for (let pass = 0; pass < 2; pass++) {
    for (let i = copy.length - 1; i > 0; i--) {
      const j = secureRandomInt(i + 1);
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
  }

  const cut = secureRandomInt(copy.length);
  if (cut === 0) return copy;
  return [...copy.slice(cut), ...copy.slice(0, cut)];
}
