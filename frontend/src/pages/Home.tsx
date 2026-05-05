import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authGuest, checkRoom, createRoom } from '../api';
import { useSessionStore } from '../store/sessionStore';

export default function Home() {
  const nav = useNavigate();
  const session = useSessionStore();
  const [name, setName] = useState(session.user?.displayName ?? '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ensureSession(): Promise<void> {
    if (session.token && session.user && session.user.displayName === name.trim()) return;
    const { token, user } = await authGuest(name.trim());
    session.setSession(token, user);
  }

  async function handleCreate() {
    setError(null);
    if (name.trim().length < 2) return setError('Enter a display name');
    setBusy(true);
    try {
      await ensureSession();
      const room = await createRoom();
      nav(`/room/${room.code}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    setError(null);
    if (name.trim().length < 2) return setError('Enter a display name');
    if (code.trim().length !== 6) return setError('Room code must be 6 characters');
    setBusy(true);
    try {
      await ensureSession();
      const c = code.trim().toUpperCase();
      await checkRoom(c);
      nav(`/room/${c}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md card space-y-6"
      >
        <div className="text-center space-y-1">
          <h1 className="neon-text text-4xl text-neon-cyan">TAMBOLA</h1>
          <p className="text-sm text-white/60">Live multiplayer Housie · up to 50 players</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-white/70">Display name</label>
          <input
            className="input w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. NeonKnight"
            maxLength={20}
          />
        </div>

        <div className="grid gap-3">
          <button className="btn-primary py-3 text-base" disabled={busy} onClick={handleCreate}>
            Create Room
          </button>

          <div className="relative">
            <div className="flex items-center gap-2 mb-2 text-xs text-white/50">
              <div className="flex-1 h-px bg-bg-700" />
              <span>OR</span>
              <div className="flex-1 h-px bg-bg-700" />
            </div>
            <div className="flex gap-2">
              <input
                className="input flex-1 uppercase tracking-widest text-center font-mono"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ROOM CODE"
              />
              <button className="btn-secondary" disabled={busy} onClick={handleJoin}>
                Join
              </button>
            </div>
          </div>
        </div>

        {error && <div className="text-sm text-rose-400">{error}</div>}
      </motion.div>
    </div>
  );
}
