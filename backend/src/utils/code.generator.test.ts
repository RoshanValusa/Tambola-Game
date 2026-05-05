import { describe, it, expect } from 'vitest';
import { generateRoomCode } from './code.generator';

describe('code.generator', () => {
  it('respects length and alphabet', () => {
    for (let i = 0; i < 1000; i++) {
      const code = generateRoomCode(6);
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[A-Z2-9]+$/);
      expect(code).not.toMatch(/[01OI]/);
    }
  });

  it('avoids collisions when a predicate is provided', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const code = generateRoomCode(6, (c) => seen.has(c));
      expect(seen.has(code)).toBe(false);
      seen.add(code);
    }
  });
});
