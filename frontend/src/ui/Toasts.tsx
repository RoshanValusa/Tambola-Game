import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useRoomStore } from '../store/roomStore';

export default function Toasts() {
  const toasts = useRoomStore((s) => s.toasts);
  const dismiss = useRoomStore((s) => s.dismissToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => setTimeout(() => dismiss(t.id), 3500));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.2 }}
            className={`px-4 py-2 rounded-lg shadow-lg border text-sm
              ${t.kind === 'success' ? 'bg-emerald-700/80 border-emerald-500' : ''}
              ${t.kind === 'error' ? 'bg-rose-700/80 border-rose-500' : ''}
              ${t.kind === 'info' ? 'bg-bg-700/90 border-bg-600' : ''}`}
            onClick={() => dismiss(t.id)}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
