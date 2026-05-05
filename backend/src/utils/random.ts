import { randomBytes, randomInt } from 'node:crypto';

/** Crypto-strong random integer in [min, max). */
export function cryptoRandomInt(min: number, max: number): number {
  return randomInt(min, max);
}

/** In-place Fisher–Yates shuffle using cryptographically strong RNG. */
export function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function randomHex(bytes = 8): string {
  return randomBytes(bytes).toString('hex');
}
