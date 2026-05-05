import { GAME_CONSTANTS } from '../config/constants';
import { cryptoRandomInt } from './random';

// Excludes look-alike chars (0/O, 1/I).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(
  length = GAME_CONSTANTS.ROOM_CODE_LENGTH,
  exists?: (code: string) => boolean,
  maxAttempts = 25,
): string {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += ALPHABET[cryptoRandomInt(0, ALPHABET.length)];
    }
    if (!exists || !exists(code)) return code;
  }
  throw new Error('Could not generate unique room code');
}
