import { io, type Socket } from 'socket.io-client';
import { config } from '../config';
import {
  SocketEvents,
  type ClaimResultEvent,
  type GameEndedEvent,
  type GameStartedEvent,
  type HostChangedEvent,
  type LobbyUpdateEvent,
  type NumberCalledEvent,
  type PlayerJoinedEvent,
  type PlayerLeftEvent,
  type RoomSnapshotEvent,
  type ServerAck,
  type SocketErrorEvent,
} from '@tambola/shared';
import { useSessionStore } from '../store/sessionStore';
import { useRoomStore } from '../store/roomStore';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket && socket.connected) return socket;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  const token = useSessionStore.getState().token;
  socket = io(config.socketUrl, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
  });
  registerHandlers(socket);
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function emitWithAck<TPayload, TData = unknown>(
  event: string,
  payload: TPayload,
): Promise<TData> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit(event, payload, (ack: ServerAck<TData>) => {
      if (ack?.ok) resolve(ack.data as TData);
      else reject(new Error(ack?.error?.message ?? 'Unknown error'));
    });
  });
}

function registerHandlers(s: Socket): void {
  const room = useRoomStore.getState;

  s.on('connect_error', (err) => {
    room().pushToast({ kind: 'error', text: `Connection error: ${err.message}` });
  });

  s.on(SocketEvents.ROOM_SNAPSHOT, (snap: RoomSnapshotEvent) => {
    room().applySnapshot(snap);
  });

  s.on(SocketEvents.PLAYER_JOINED, (e: PlayerJoinedEvent) => {
    room().upsertPlayer(e.player);
  });

  s.on(SocketEvents.PLAYER_LEFT, (e: PlayerLeftEvent) => {
    room().removePlayer(e.userId);
  });

  s.on(SocketEvents.LOBBY_UPDATE, (e: LobbyUpdateEvent) => {
    room().setPlayers(e.players, e.hostId, e.config);
  });

  s.on(SocketEvents.HOST_CHANGED, (e: HostChangedEvent) => {
    room().setHost(e.hostId);
  });

  s.on(SocketEvents.GAME_STARTED, (_e: GameStartedEvent) => {
    room().setState('playing');
    room().pushToast({ kind: 'info', text: 'Game started!' });
  });

  s.on(SocketEvents.NUMBER_CALLED, (e: NumberCalledEvent) => {
    room().pushNumber(e.number);
  });

  s.on(SocketEvents.CLAIM_RESULT, (e: ClaimResultEvent) => {
    room().setWinners(e.winners);
    const me = useSessionStore.getState().user?.userId;
    if (e.userId === me) {
      if (e.valid) {
        room().pushToast({ kind: 'success', text: `Bingo! ${prizeLabel(e.claim)} accepted.` });
      } else {
        room().addDisqualified(e.claim);
        room().pushToast({
          kind: 'error',
          text: `Invalid claim (${prizeLabel(e.claim)}): ${e.reason ?? 'rejected'}`,
        });
      }
    } else if (e.valid) {
      room().pushToast({
        kind: 'info',
        text: `${e.displayName} won ${prizeLabel(e.claim)}!`,
      });
    }
  });

  s.on(SocketEvents.GAME_ENDED, (e: GameEndedEvent) => {
    room().setState('ended');
    room().setWinners(e.winners);
  });

  s.on(SocketEvents.ERROR, (e: SocketErrorEvent) => {
    room().pushToast({ kind: 'error', text: `${e.event ?? ''}: ${e.message}` });
  });
}

function prizeLabel(c: string): string {
  switch (c) {
    case 'early5':
      return 'Early 5';
    case 'topLine':
      return 'Top Line';
    case 'middleLine':
      return 'Middle Line';
    case 'bottomLine':
      return 'Bottom Line';
    case 'fullHouse':
      return 'Full House';
    default:
      return c;
  }
}
