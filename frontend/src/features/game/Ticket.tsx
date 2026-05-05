import { motion } from 'framer-motion';
import type { Ticket as TicketT } from '@tambola/shared';

interface Props {
  ticket: TicketT;
  called: ReadonlySet<number>;
  marked: ReadonlySet<number>;
  onToggle: (n: number) => void;
  disabled?: boolean;
}

export default function Ticket({ ticket, called, marked, onToggle, disabled }: Props) {
  return (
    <div className="grid grid-rows-3 gap-1 select-none">
      {ticket.grid.map((row, ri) => (
        <div key={ri} className="grid grid-cols-9 gap-1">
          {row.map((cell, ci) => {
            if (cell == null) {
              return <div key={ci} className="aspect-square rounded-md bg-bg-700/40" />;
            }
            const isCalled = called.has(cell);
            const isMarked = marked.has(cell);
            return (
              <motion.button
                key={ci}
                whileTap={{ scale: 0.92 }}
                onClick={() => !disabled && isCalled && onToggle(cell)}
                disabled={disabled || !isCalled}
                className={`aspect-square rounded-md font-display font-bold text-sm md:text-base
                  flex items-center justify-center transition-colors
                  ${
                    isMarked
                      ? 'bg-neon-cyan text-bg-900 shadow-glow'
                      : isCalled
                        ? 'bg-bg-600 text-neon-amber border border-neon-amber/50'
                        : 'bg-bg-700 text-white border border-bg-600 hover:bg-bg-600'
                  }`}
                aria-label={`Number ${cell}${isCalled ? ' called' : ''}`}
              >
                {cell}
              </motion.button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
