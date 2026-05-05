import { describe, it, expect } from 'vitest';
import type { ClaimType, Ticket, WinnersByPrize } from '@tambola/shared';
import { validateClaim } from './claim.validator';

function emptyWinners(): WinnersByPrize {
  return { early5: [], topLine: [], middleLine: [], bottomLine: [], fullHouse: [] };
}

function ticketFromRows(rows: [number[], number[], number[]]): Ticket {
  const grid: (number | null)[][] = [
    new Array(9).fill(null),
    new Array(9).fill(null),
    new Array(9).fill(null),
  ];
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < rows[r].length; i++) {
      // place by column index based on number range
      const n = rows[r][i];
      const col = n === 90 ? 8 : Math.floor(n / 10);
      grid[r][col] = n;
    }
  }
  return {
    ticketId: 't',
    grid,
    numbers: rows.flat(),
    rows,
  };
}

const ticket = ticketFromRows([
  [3, 14, 28, 41, 67],
  [5, 22, 39, 55, 73],
  [9, 31, 48, 62, 88],
]);

function ctx(called: number[], winners?: WinnersByPrize, dq: ClaimType[] = []) {
  return {
    ticket,
    calledNumbers: new Set(called),
    winners: winners ?? emptyWinners(),
    disqualifiedFrom: new Set(dq),
  };
}

describe('claim.validator', () => {
  it('early5 valid when 5+ numbers called', () => {
    expect(validateClaim('early5', ctx([3, 14, 28, 41, 67])).ok).toBe(true);
    expect(validateClaim('early5', ctx([3, 14, 28, 41])).ok).toBe(false);
  });

  it('topLine requires all 5 row-0 numbers', () => {
    expect(validateClaim('topLine', ctx([3, 14, 28, 41, 67])).ok).toBe(true);
    expect(validateClaim('topLine', ctx([3, 14, 28, 41])).ok).toBe(false);
  });

  it('middleLine and bottomLine work independently', () => {
    expect(validateClaim('middleLine', ctx([5, 22, 39, 55, 73])).ok).toBe(true);
    expect(validateClaim('bottomLine', ctx([9, 31, 48, 62, 88])).ok).toBe(true);
    expect(validateClaim('middleLine', ctx([5, 22, 39, 55])).ok).toBe(false);
  });

  it('fullHouse requires all 15 numbers', () => {
    const all = [3, 14, 28, 41, 67, 5, 22, 39, 55, 73, 9, 31, 48, 62, 88];
    expect(validateClaim('fullHouse', ctx(all)).ok).toBe(true);
    expect(validateClaim('fullHouse', ctx(all.slice(1))).ok).toBe(false);
  });

  it('rejects when prize already awarded', () => {
    const winners = emptyWinners();
    winners.topLine.push({ userId: 'x', displayName: 'X', callIndex: 0, claimedAt: 0 });
    const r = validateClaim('topLine', ctx([3, 14, 28, 41, 67], winners));
    expect(r.ok).toBe(false);
  });

  it('rejects when player disqualified', () => {
    const r = validateClaim('topLine', ctx([3, 14, 28, 41, 67], undefined, ['topLine']));
    expect(r.ok).toBe(false);
  });
});
