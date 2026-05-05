import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useRoomStore } from '../store/roomStore';
import NumberBoard from '../features/game/NumberBoard';
import Ticket from '../features/game/Ticket';
import ClaimBar from '../features/game/ClaimBar';
import WinnersPanel from '../features/game/WinnersPanel';
import { useSessionStore } from '../store/sessionStore';
import { emitWithAck, getSocket } from '../socket/socketClient';
import { SocketEvents } from '@tambola/shared';

export default function Game() {
  const { code } = useParams();
  const nav = useNavigate();
  const me = useSessionStore((s) => s.user);
  const {
    ticket,
    calledNumbers,
    lastCalled,
    marked,
    toggleMark,
    state,
    winners,
    myDisqualified,
    hostId,
    players,
  } = useRoomStore();

  useEffect(() => {
    if (!code || !me) {
      nav('/');
      return;
    }
    // Ensure socket exists and join is attempted (idempotent on server).
    getSocket();
    emitWithAck(SocketEvents.JOIN_ROOM, { code }).catch(() => undefined);
  }, [code, me, nav]);

  const calledSet = useMemo(() => new Set(calledNumbers), [calledNumbers]);
  const isHost = me?.userId === hostId;

  return (
    <div className="min-h-screen px-3 py-4 max-w-7xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <h1 className="neon-text text-xl text-neon-cyan">TAMBOLA</h1>
          <span className="pill font-mono">{code}</span>
          <span className="pill">
            {state === 'playing' ? 'Live' : state === 'ended' ? 'Ended' : 'Waiting'}
          </span>
          <span className="pill">{players.length} players</span>
        </div>
        <div className="flex items-center gap-2">
          {state === 'ended' && (
            <button className="btn-primary" onClick={() => nav('/')}>
              Back to Home
            </button>
          )}
          {isHost && state === 'playing' && (
            <button
              className="btn-danger"
              onClick={() => emitWithAck(SocketEvents.END_GAME, {}).catch(() => undefined)}
            >
              End Game
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(260px,360px)] gap-4">
        <div className="space-y-4">
          {lastCalled && (
            <motion.div
              key={lastCalled}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 16 }}
              className="card flex items-center justify-center"
            >
              <div className="text-center">
                <div className="text-xs text-white/50 uppercase tracking-widest">Now Calling</div>
                <div className="text-7xl font-display font-bold text-neon-cyan drop-shadow-[0_0_24px_rgba(34,211,238,0.6)]">
                  {lastCalled}
                </div>
                <div className="text-xs text-white/50">{calledNumbers.length} called</div>
              </div>
            </motion.div>
          )}

          <div className="card">
            <h2 className="text-sm text-white/60 mb-2">Your Ticket</h2>
            {ticket ? (
              <Ticket
                ticket={ticket}
                called={calledSet}
                marked={marked}
                onToggle={(n) => {
                  if (calledSet.has(n)) toggleMark(n);
                }}
                disabled={state !== 'playing'}
              />
            ) : (
              <p className="text-white/50">No ticket assigned.</p>
            )}
          </div>

          <ClaimBar disabled={state !== 'playing'} disqualified={myDisqualified} winners={winners} />
        </div>

        <div className="space-y-4">
          <div className="card">
            <h2 className="text-sm text-white/60 mb-3">Called Numbers</h2>
            <NumberBoard called={calledSet} lastCalled={lastCalled} />
          </div>
          <WinnersPanel winners={winners} />
        </div>
      </div>
    </div>
  );
}
