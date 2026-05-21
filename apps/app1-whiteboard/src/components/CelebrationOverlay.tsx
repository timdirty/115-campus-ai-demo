import {memo, useEffect, useMemo} from 'react';
import {motion, AnimatePresence} from 'motion/react';

export interface CelebrationOverlayProps {
  open: boolean;
  message?: string;
  durationMs?: number;
  onDone?: () => void;
}

const EMOJIS = ['🎉', '🎊', '⭐', '✨', '🌟', '💫', '🎈', '🏆'];

interface Particle {
  id: number;
  emoji: string;
  leftPct: number;
  delay: number;
  duration: number;
  rotateStart: number;
  rotateEnd: number;
  size: number;
}

function buildParticles(seed: number): Particle[] {
  const rand = (n: number) => {
    seed = (seed * 9301 + 49297) % 233280;
    return (seed / 233280) * n;
  };
  return Array.from({length: 36}, (_, i) => ({
    id: i,
    emoji: EMOJIS[Math.floor(rand(EMOJIS.length))],
    leftPct: rand(100),
    delay: rand(0.8),
    duration: 1.8 + rand(1.4),
    rotateStart: rand(360),
    rotateEnd: rand(720) - 360,
    size: 32 + Math.floor(rand(36)),
  }));
}

function CelebrationOverlayInner({
  open,
  message = '擦好了！',
  durationMs = 2600,
  onDone,
}: CelebrationOverlayProps) {
  const particles = useMemo(() => buildParticles(open ? Date.now() : 1), [open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => onDone?.(), durationMs);
    return () => window.clearTimeout(t);
  }, [open, durationMs, onDone]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="celebrate"
          className="fixed inset-0 z-[60] pointer-events-none overflow-hidden"
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          exit={{opacity: 0}}
          transition={{duration: 0.25}}
          role="status"
          aria-live="polite"
          aria-label={message}
        >
          {particles.map((p) => (
            <motion.span
              key={p.id}
              className="absolute select-none"
              style={{
                left: `${p.leftPct}%`,
                top: '-10%',
                fontSize: `${p.size}px`,
                filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.25))',
              }}
              initial={{y: 0, rotate: p.rotateStart, opacity: 0}}
              animate={{
                y: '120vh',
                rotate: p.rotateEnd,
                opacity: [0, 1, 1, 0.6, 0],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                ease: 'easeIn',
                times: [0, 0.1, 0.7, 0.9, 1],
              }}
            >
              {p.emoji}
            </motion.span>
          ))}

          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{scale: 0.6, opacity: 0}}
            animate={{scale: 1, opacity: 1}}
            exit={{scale: 0.9, opacity: 0}}
            transition={{type: 'spring', bounce: 0.55, duration: 0.6}}
          >
            <div className="px-8 py-5 rounded-3xl bg-white/95 dark:bg-slate-900/95 shadow-2xl border-4 border-emerald-400 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <span className="text-5xl">🤖</span>
                <span className="text-4xl font-extrabold bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">
                  {message}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export const CelebrationOverlay = memo(CelebrationOverlayInner);
export default CelebrationOverlay;
