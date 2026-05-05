import type { ClaimType, Ticket, WinnersByPrize } from '@tambola/shared';
import { GAME_CONSTANTS } from '../../config/constants';

export interface ClaimContext {
  ticket: Ticket;
  calledNumbers: ReadonlySet<number>;
  winners: WinnersByPrize;
  /** Set of prizes this player has been disqualified from. */
  disqualifiedFrom: ReadonlySet<ClaimType>;
}

export type ClaimValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

/** Pure prize validation. No side effects. */
export function validateClaim(
  type: ClaimType,
  ctx: ClaimContext,
): ClaimValidationResult {
  if (ctx.disqualifiedFrom.has(type)) {
    return { ok: false, reason: 'Player disqualified from this prize' };
  }
  if (ctx.winners[type].length > 0) {
    return { ok: false, reason: 'Prize already awarded' };
  }

  switch (type) {
    case 'early5':
      return validateEarly5(ctx);
    case 'topLine':
      return validateRow(ctx, 0);
    case 'middleLine':
      return validateRow(ctx, 1);
    case 'bottomLine':
      return validateRow(ctx, 2);
    case 'fullHouse':
      return validateFullHouse(ctx);
  }
}

function validateEarly5(ctx: ClaimContext): ClaimValidationResult {
  let count = 0;
  for (const n of ctx.ticket.numbers) {
    if (ctx.calledNumbers.has(n)) count++;
    if (count >= GAME_CONSTANTS.EARLY5_COUNT) return { ok: true };
  }
  return { ok: false, reason: `Only ${count}/${GAME_CONSTANTS.EARLY5_COUNT} numbers marked` };
}

function validateRow(ctx: ClaimContext, rowIdx: 0 | 1 | 2): ClaimValidationResult {
  const row = ctx.ticket.rows[rowIdx];
  for (const n of row) {
    if (!ctx.calledNumbers.has(n)) {
      return { ok: false, reason: `Row not complete (missing ${n})` };
    }
  }
  return { ok: true };
}

function validateFullHouse(ctx: ClaimContext): ClaimValidationResult {
  for (const n of ctx.ticket.numbers) {
    if (!ctx.calledNumbers.has(n)) {
      return { ok: false, reason: `Ticket not complete (missing ${n})` };
    }
  }
  return { ok: true };
}
