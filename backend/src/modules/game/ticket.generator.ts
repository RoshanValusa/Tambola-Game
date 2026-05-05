import { v4 as uuidv4 } from 'uuid';
import type { Ticket } from '@tambola/shared';
import { GAME_CONSTANTS } from '../../config/constants';
import { cryptoRandomInt, shuffleInPlace } from '../../utils/random';

/**
 * Tambola ticket generator.
 *
 * Invariants:
 *  - 3 rows × 9 columns
 *  - 15 numbers total, exactly 5 per row
 *  - Each column has 1–3 numbers, sorted ascending top→bottom
 *  - Column ranges: col 0 = 1–9, col k (1..7) = k*10..k*10+9, col 8 = 80–90
 */

const ROWS = GAME_CONSTANTS.ROWS_PER_TICKET;
const COLS = GAME_CONSTANTS.COLS_PER_TICKET;
const NUMS = GAME_CONSTANTS.NUMBERS_PER_TICKET;
const PER_ROW = GAME_CONSTANTS.NUMBERS_PER_ROW;

/** Column count distributions (a 3s, b 2s, c 1s) that sum to 15 across 9 cols. */
const COUNT_DISTRIBUTIONS: Array<[number, number, number]> = [
  [0, 6, 3],
  [1, 4, 4],
  [2, 2, 5],
  [3, 0, 6],
];

function columnRange(col: number): [number, number] {
  if (col === 0) return [1, 9];
  if (col === 8) return [80, 90];
  return [col * 10, col * 10 + 9];
}

function pickColumnCounts(): number[] {
  const [a, b, c] = COUNT_DISTRIBUTIONS[cryptoRandomInt(0, COUNT_DISTRIBUTIONS.length)];
  const counts: number[] = [
    ...Array(a).fill(3),
    ...Array(b).fill(2),
    ...Array(c).fill(1),
  ];
  return shuffleInPlace(counts);
}

/** Pick `k` distinct integers from inclusive range [lo, hi], sorted asc. */
function sampleSortedFromRange(lo: number, hi: number, k: number): number[] {
  const pool: number[] = [];
  for (let n = lo; n <= hi; n++) pool.push(n);
  shuffleInPlace(pool);
  return pool.slice(0, k).sort((x, y) => x - y);
}

/** Choose which rows host the numbers for each column so that every row totals 5.
 *  Returns rowMask[col] as an array of row indices in ascending order. */
function assignRows(counts: number[]): number[][] {
  const rowMasks: number[][] = new Array(COLS);
  const rowFilled = [0, 0, 0];

  function backtrack(col: number): boolean {
    if (col === COLS) return rowFilled.every((r) => r === PER_ROW);
    const k = counts[col];
    const remainingCols = COLS - col;
    // upper bound on numbers we can still place
    let remainingNumbers = 0;
    for (let i = col; i < COLS; i++) remainingNumbers += counts[i];

    // Generate row combinations of size k from {0,1,2}
    const combos = combosOf3(k);
    shuffleInPlace(combos.slice());
    // shuffleInPlace returns same array; make a fresh shuffled copy each call
    const ordered = [...combos];
    shuffleInPlace(ordered);

    for (const combo of ordered) {
      // try
      let ok = true;
      for (const r of combo) {
        if (rowFilled[r] + 1 > PER_ROW) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      // pruning: each row must still be reachable
      for (const r of combo) rowFilled[r]++;
      // remaining numbers to place after this column
      const placed = remainingNumbers - k;
      const need = rowFilled.map((f) => PER_ROW - f);
      const totalNeed = need[0] + need[1] + need[2];
      if (totalNeed === placed && need.every((n) => n >= 0 && n <= remainingCols - 1 + 0 + 3)) {
        rowMasks[col] = combo;
        if (backtrack(col + 1)) return true;
      }
      for (const r of combo) rowFilled[r]--;
    }
    return false;
  }

  if (!backtrack(0)) {
    throw new Error('Row assignment backtracking failed (should be unreachable)');
  }
  return rowMasks;
}

/** All combinations of size k from {0,1,2}. */
function combosOf3(k: number): number[][] {
  if (k === 1) return [[0], [1], [2]];
  if (k === 2) return [[0, 1], [0, 2], [1, 2]];
  if (k === 3) return [[0, 1, 2]];
  throw new Error(`Invalid k=${k}`);
}

export function generateTicket(): Ticket {
  // Retry loop in case backtracking prunes too aggressively (rare).
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const counts = pickColumnCounts();
      const rowMasks = assignRows(counts);

      // Build grid
      const grid: (number | null)[][] = [
        new Array(COLS).fill(null),
        new Array(COLS).fill(null),
        new Array(COLS).fill(null),
      ];

      for (let col = 0; col < COLS; col++) {
        const [lo, hi] = columnRange(col);
        const numbers = sampleSortedFromRange(lo, hi, counts[col]);
        const rows = rowMasks[col]; // already ascending
        for (let i = 0; i < rows.length; i++) {
          grid[rows[i]][col] = numbers[i];
        }
      }

      // Collect / validate
      const flat: number[] = [];
      const rows: [number[], number[], number[]] = [[], [], []];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const v = grid[r][c];
          if (v != null) {
            flat.push(v);
            rows[r as 0 | 1 | 2].push(v);
          }
        }
      }

      validateTicket(grid, flat, rows);

      return {
        ticketId: uuidv4(),
        grid,
        numbers: flat.slice().sort((a, b) => a - b),
        rows,
      };
    } catch {
      // try again
    }
  }
  throw new Error('Failed to generate a valid ticket after multiple attempts');
}

/** Throws if invariants broken. Exported for tests. */
export function validateTicket(
  grid: (number | null)[][],
  flat: number[],
  rows: [number[], number[], number[]],
): void {
  if (flat.length !== NUMS) throw new Error(`Ticket has ${flat.length} numbers, expected ${NUMS}`);
  for (const r of rows) {
    if (r.length !== PER_ROW) {
      throw new Error(`Row has ${r.length} numbers, expected ${PER_ROW}`);
    }
  }
  // Unique numbers
  const set = new Set(flat);
  if (set.size !== NUMS) throw new Error('Ticket has duplicate numbers');

  // Per-column checks
  for (let c = 0; c < COLS; c++) {
    const colVals: number[] = [];
    for (let r = 0; r < ROWS; r++) {
      const v = grid[r][c];
      if (v != null) colVals.push(v);
    }
    if (colVals.length < 1 || colVals.length > 3) {
      throw new Error(`Column ${c} has ${colVals.length} numbers, expected 1–3`);
    }
    // Sorted ascending top→bottom
    for (let i = 1; i < colVals.length; i++) {
      if (colVals[i] <= colVals[i - 1]) {
        throw new Error(`Column ${c} not strictly ascending`);
      }
    }
    // Range
    const [lo, hi] = columnRange(c);
    for (const v of colVals) {
      if (v < lo || v > hi) {
        throw new Error(`Column ${c} value ${v} out of range [${lo},${hi}]`);
      }
    }
  }
}
