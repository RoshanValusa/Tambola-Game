import type { AuthUser } from '@tambola/shared';
import { http } from './http';

export async function authGuest(displayName: string): Promise<{ token: string; user: AuthUser }> {
  const { data } = await http.post('/auth/guest', { displayName });
  return data.data;
}

export async function createRoom(): Promise<{ roomId: string; code: string; hostId: string }> {
  const { data } = await http.post('/rooms');
  return data.data;
}

export async function checkRoom(code: string) {
  const { data } = await http.get(`/rooms/${code}/exists`);
  return data.data as { code: string; state: string; playerCount: number; maxPlayers: number };
}
