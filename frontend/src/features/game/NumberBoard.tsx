import { motion } from 'framer-motion';

interface Props {
  called: ReadonlySet<number>;
  lastCalled: number | null;
}

export default function NumberBoard({ called, lastCalled }: Props) {
  return (
    <div className="grid grid-cols-10 gap-1">
      {Array.from({ length: 90 }, (_, i) => i + 1).map((n) => {
        const hit = called.has(n);
        const isLast = n === lastCalled;
        return (
          <motion.div
            key={n}
            initial={false}
            animate={{
              backgroundColor: hit ? 'rgba(34,211,238,0.18)' : 'rgba(31,31,54,0.5)',
              borderColor: isLast ? 'rgb(244,114,182)' : hit ? 'rgba(34,211,238,0.7)' : 'rgba(31,31,54,1)',
            }}
            transition={{ duration: 0.3 }}
            className={`text-xs md:text-sm aspect-square rounded-md flex items-center justify-center font-mono border
              ${hit ? 'text-neon-cyan' : 'text-white/40'}
              ${isLast ? 'shadow-glow-pink' : ''}`}
          >
            {n}
          </motion.div>
        );
      })}
    </div>
  );
}
