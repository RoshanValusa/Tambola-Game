import type { ClaimType, WinnersByPrize } from '@tambola/shared';

const LABELS: Record<ClaimType, string> = {
  early5: 'Early 5',
  topLine: 'Top Line',
  middleLine: 'Middle Line',
  bottomLine: 'Bottom Line',
  fullHouse: 'Full House',
};

const ORDER: ClaimType[] = ['early5', 'topLine', 'middleLine', 'bottomLine', 'fullHouse'];

export default function WinnersPanel({ winners }: { winners: WinnersByPrize }) {
  return (
    <div className="card">
      <h2 className="text-sm text-white/60 mb-3">Winners</h2>
      <ul className="space-y-2">
        {ORDER.map((c) => {
          const list = winners[c];
          return (
            <li key={c} className="flex items-center justify-between">
              <span className="text-sm text-white/70">{LABELS[c]}</span>
              <span className="text-sm">
                {list.length === 0 ? (
                  <span className="text-white/40">—</span>
                ) : (
                  <span className="text-neon-amber font-medium">
                    {list.map((w) => w.displayName).join(', ')}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
