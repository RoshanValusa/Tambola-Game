import {
  ALL_CLAIMS,
  SocketEvents,
  type ClaimType,
  type WinnersByPrize,
} from '@tambola/shared';
import { emitWithAck } from '../../socket/socketClient';
import { useRoomStore } from '../../store/roomStore';

interface Props {
  disabled?: boolean;
  disqualified: ReadonlySet<ClaimType>;
  winners: WinnersByPrize;
}

const LABELS: Record<ClaimType, string> = {
  early5: 'Early 5',
  topLine: 'Top Line',
  middleLine: 'Middle Line',
  bottomLine: 'Bottom Line',
  fullHouse: 'Full House',
};

export default function ClaimBar({ disabled, disqualified, winners }: Props) {
  async function claim(c: ClaimType) {
    try {
      await emitWithAck(SocketEvents.CLAIM_WIN, { claim: c });
    } catch (e) {
      useRoomStore.getState().pushToast({ kind: 'error', text: (e as Error).message });
    }
  }

  return (
    <div className="card">
      <h2 className="text-sm text-white/60 mb-3">Claim a prize</h2>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {ALL_CLAIMS.map((c) => {
          const taken = winners[c].length > 0;
          const dq = disqualified.has(c);
          const isDisabled = disabled || taken || dq;
          return (
            <button
              key={c}
              onClick={() => claim(c)}
              disabled={isDisabled}
              className={`btn ${
                taken ? 'bg-emerald-700/40 border border-emerald-500/50 text-white/70' :
                dq ? 'bg-rose-700/40 border border-rose-500/40 text-white/50' :
                'bg-gradient-to-br from-neon-violet/80 to-neon-pink/80 text-white shadow-glow-violet'
              }`}
              title={dq ? 'Disqualified' : taken ? 'Already awarded' : 'Claim now'}
            >
              {LABELS[c]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
