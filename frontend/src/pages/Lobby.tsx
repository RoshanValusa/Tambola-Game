import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SocketEvents } from '@tambola/shared';
import { emitWithAck, getSocket } from '../socket/socketClient';
import { useRoomStore } from '../store/roomStore';
import { useSessionStore } from '../store/sessionStore';
import Ticket from '../features/game/Ticket';

export default function Lobby() {
  const { code } = useParams();
  const nav = useNavigate();
  const me = useSessionStore((s) => s.user);
  const { players, hostId, ticket, config, state } = useRoomStore();
  const [intervalDraft, setIntervalDraft] = useState<number | null>(null);

  useEffect(() => {
    if (!code || !me) {
      nav('/');
      return;
    }
    getSocket();
    emitWithAck(SocketEvents.JOIN_ROOM, { code }).catch((e) => {
      // Server already broadcasts a snapshot; surface failure too.
      useRoomStore.getState().pushToast({ kind: 'error', text: e.message });
    });
  }, [code, me, nav]);

  useEffect(() => {
    if (state === 'playing' || state === 'ended') {
      nav(`/play/${code}`);
    }
  }, [state, code, nav]);

  const isHost = me?.userId === hostId;
  const canStart = isHost && players.length >= 1;

  async function start() {
    try {
      await emitWithAck(SocketEvents.START_GAME, {});
    } catch (e) {
      useRoomStore.getState().pushToast({ kind: 'error', text: (e as Error).message });
    }
  }

  async function leave() {
    try {
      await emitWithAck(SocketEvents.LEAVE_ROOM, {});
    } catch {
      // ignore
    } finally {
      useRoomStore.getState().reset();
      nav('/');
    }
  }

  async function configure(callIntervalMs: number) {
    try {
      await emitWithAck(SocketEvents.CONFIGURE_ROOM, { callIntervalMs });
    } catch (e) {
      useRoomStore.getState().pushToast({ kind: 'error', text: (e as Error).message });
    }
  }

  return (
    <div className="min-h-screen px-4 py-6 max-w-6xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="neon-text text-2xl text-neon-cyan">LOBBY</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="pill">Code</span>
            <code className="font-mono text-lg tracking-widest text-neon-amber">{code}</code>
            <button
              className="text-xs text-white/60 hover:text-white"
              onClick={() => navigator.clipboard?.writeText(code ?? '')}
            >
              copy
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isHost && (
            <button className="btn-primary" onClick={start} disabled={!canStart}>
              Start Game
            </button>
          )}
          <button className="btn-secondary" onClick={leave}>
            Leave
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        <motion.div layout className="card">
          <h2 className="text-sm text-white/60 mb-3">Your ticket (preview)</h2>
          {ticket ? (
            <Ticket ticket={ticket} called={new Set()} marked={new Set()} onToggle={() => {}} disabled />
          ) : (
            <p className="text-white/50">Waiting for ticket assignment…</p>
          )}
        </motion.div>

        <div className="card">
          <h2 className="text-sm text-white/60 mb-3">
            Players · {players.length}/{config?.maxPlayers ?? 50}
          </h2>
          <ul className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
            {players.map((p) => (
              <li
                key={p.userId}
                className={`flex items-center justify-between px-3 py-2 rounded-lg
                  ${p.userId === me?.userId ? 'bg-bg-700' : 'bg-bg-800/50'}`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${p.isConnected ? 'bg-emerald-400' : 'bg-rose-400'}`}
                  />
                  <span className="font-medium">{p.displayName}</span>
                  {p.userId === me?.userId && <span className="text-xs text-white/50">(you)</span>}
                </span>
                {p.isHost && <span className="pill text-neon-amber border-neon-amber/40">Host</span>}
              </li>
            ))}
          </ul>

          {isHost && config && (
            <div className="mt-4 space-y-2">
              <label className="text-xs text-white/60">
                Number-call interval: {((intervalDraft ?? config.callIntervalMs) / 1000).toFixed(1)}s
              </label>
              <input
                type="range"
                min={2000}
                max={15000}
                step={500}
                value={intervalDraft ?? config.callIntervalMs}
                onChange={(e) => setIntervalDraft(Number(e.target.value))}
                onMouseUp={(e) => {
                  const v = Number((e.target as HTMLInputElement).value);
                  setIntervalDraft(null);
                  if (v !== config.callIntervalMs) configure(v);
                }}
                onTouchEnd={(e) => {
                  const v = Number((e.target as HTMLInputElement).value);
                  setIntervalDraft(null);
                  if (v !== config.callIntervalMs) configure(v);
                }}
                onKeyUp={(e) => {
                  const v = Number((e.target as HTMLInputElement).value);
                  setIntervalDraft(null);
                  if (v !== config.callIntervalMs) configure(v);
                }}
                className="w-full"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
