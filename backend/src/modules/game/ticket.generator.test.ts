import { describe, it, expect } from 'vitest';
import { generateTicket, validateTicket } from './ticket.generator';

describe('ticket.generator', () => {
  it('produces a valid Tambola ticket invariant set across many iterations', () => {
    for (let i = 0; i < 10_000; i++) {
      const t = generateTicket();
      // Re-validate (throws on failure)
      const flat: number[] = [];
      const rows: [number[], number[], number[]] = [[], [], []];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 9; c++) {
          const v = t.grid[r][c];
          if (v != null) {
            flat.push(v);
            rows[r as 0 | 1 | 2].push(v);
          }
        }
      }
      expect(flat).toHaveLength(15);
      expect(rows[0]).toHaveLength(5);
      expect(rows[1]).toHaveLength(5);
      expect(rows[2]).toHaveLength(5);
      expect(new Set(flat).size).toBe(15);
      expect(() => validateTicket(t.grid, flat, rows)).not.toThrow();
    }
  });

  it('places numbers within column ranges and sorted ascending', () => {
    for (let i = 0; i < 1_000; i++) {
      const t = generateTicket();
      for (let c = 0; c < 9; c++) {
        const lo = c === 0 ? 1 : c * 10;
        const hi = c === 8 ? 90 : c * 10 + 9;
        let prev = -Infinity;
        let count = 0;
        for (let r = 0; r < 3; r++) {
          const v = t.grid[r][c];
          if (v == null) continue;
          count++;
          expect(v).toBeGreaterThanOrEqual(lo);
          expect(v).toBeLessThanOrEqual(hi);
          expect(v).toBeGreaterThan(prev);
          prev = v;
        }
        expect(count).toBeGreaterThanOrEqual(1);
        expect(count).toBeLessThanOrEqual(3);
      }
    }
  });
});
