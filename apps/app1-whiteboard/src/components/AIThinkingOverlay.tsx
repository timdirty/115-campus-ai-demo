import {useEffect, type JSX} from 'react';
import {AnimatePresence, motion} from 'motion/react';

export interface ThinkingRegion {
  id: string;
  label: string;
  status: 'analyzing' | 'keep' | 'erase' | 'done';
}

export interface AIThinkingOverlayProps {
  open: boolean;
  label: string;
  progress?: number;
  regions?: ThinkingRegion[];
  onClose?: () => void;
}

const STATUS_STYLES: Record<ThinkingRegion['status'], {icon: string; text: string; className: string}> = {
  analyzing: {
    icon: '⏳',
    text: '分析中',
    className: 'bg-yellow-100 text-yellow-800 ring-yellow-300 dark:bg-yellow-400/20 dark:text-yellow-100 dark:ring-yellow-300/40',
  },
  keep: {
    icon: '✅',
    text: '保留',
    className: 'bg-green-100 text-green-800 ring-green-300 dark:bg-green-400/20 dark:text-green-100 dark:ring-green-300/40',
  },
  erase: {
    icon: '🧽',
    text: '擦除',
    className: 'bg-orange-100 text-orange-800 ring-orange-300 dark:bg-orange-400/20 dark:text-orange-100 dark:ring-orange-300/40',
  },
  done: {
    icon: '✓',
    text: '完成',
    className: 'bg-gray-100 text-gray-700 ring-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:ring-gray-500',
  },
};

function clampProgress(progress: number): number {
  return Math.min(100, Math.max(0, progress));
}

export function AIThinkingOverlay({
  open,
  label,
  progress,
  regions,
  onClose,
}: AIThinkingOverlayProps): JSX.Element {
  const progressValue = progress === undefined ? undefined : clampProgress(progress);

  useEffect(() => {
    if (!open || !onClose) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="ai-thinking-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          exit={{opacity: 0, transition: {duration: 0.2}}}
          transition={{duration: 0.3}}
          role="dialog"
          aria-modal="true"
          aria-label={label}
        >
          <motion.div
            className="mx-4 w-full max-w-sm rounded-3xl bg-white p-5 text-slate-950 shadow-2xl ring-1 ring-white/70 dark:bg-slate-900 dark:text-white dark:ring-white/10 sm:max-w-2xl sm:p-8"
            initial={{opacity: 0, scale: 0.9}}
            animate={{opacity: 1, scale: 1}}
            exit={{opacity: 0, scale: 0.95, transition: {duration: 0.2}}}
            transition={{duration: 0.3}}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="text-2xl font-bold sm:text-3xl">{label}</h2>
              <div className="flex min-w-16 items-center justify-end gap-2 pt-2" aria-hidden="true">
                {[0, 1, 2].map((dot) => (
                  <motion.span
                    key={dot}
                    className="h-3 w-3 rounded-full bg-gradient-to-br from-blue-400 via-fuchsia-500 to-purple-600 shadow-lg shadow-purple-500/30"
                    animate={{scale: [1, 1.4, 1]}}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: dot * 0.16,
                    }}
                  />
                ))}
              </div>
            </div>

            {progressValue !== undefined ? (
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <span>AI 分析進度</span>
                  <span>{Math.round(progressValue)}%</span>
                </div>
                <div className="h-4 overflow-hidden rounded-full bg-slate-200 shadow-inner dark:bg-slate-700">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600"
                    initial={{width: 0}}
                    animate={{width: `${progressValue}%`}}
                    transition={{type: 'spring', stiffness: 120, damping: 20}}
                  />
                </div>
              </div>
            ) : null}

            {regions && regions.length > 0 ? (
              <motion.div className="grid gap-3 sm:grid-cols-2" layout>
                {regions.map((region) => {
                  const style = STATUS_STYLES[region.status];
                  return (
                    <motion.div
                      key={region.id}
                      layout
                      transition={{type: 'spring', stiffness: 320, damping: 28}}
                      className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 font-semibold ring-1 ${style.className}`}
                    >
                      <span className="text-lg">{region.label}</span>
                      <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm">
                        <span aria-hidden="true">{style.icon}</span>
                        {style.text}
                      </span>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default AIThinkingOverlay;
