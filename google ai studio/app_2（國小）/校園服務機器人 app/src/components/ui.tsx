import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  fullScreen?: boolean;
}

export function BottomSheet({ isOpen, onClose, title, children, fullScreen = false }: BottomSheetProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={fullScreen ? { opacity: 0, scale: 0.95 } : { y: '100%' }}
            animate={fullScreen ? { opacity: 1, scale: 1 } : { y: 0 }}
            exit={fullScreen ? { opacity: 0, scale: 0.95 } : { y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-label={title ?? '彈出面板'}
            className={`fixed ${fullScreen ? 'inset-3 rounded-[1.5rem] sm:inset-4 sm:rounded-[2rem]' : 'bottom-0 left-0 right-0 max-h-[92vh] rounded-t-[1.75rem] pb-safe sm:rounded-t-[2.5rem]'} bg-surface-container-lowest z-[101] overflow-hidden flex flex-col w-full max-w-[min(42rem,calc(100vw-1rem))] mx-auto shadow-2xl`}
          >
            {title && (
              <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/20 shrink-0 bg-surface-container-lowest relative">
                {/* Drag Handle Indicator */}
                {!fullScreen && <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-outline-variant/30"></div>}

                <h3 className="font-headline font-bold text-2xl tracking-wide">{title}</h3>
                <button
                  onClick={onClose}
                  aria-label="關閉面板"
                  className="p-2 w-10 h-10 rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-colors flex items-center justify-center text-on-surface active:scale-90"
                >
                  <X size={22} />
                </button>
              </div>
            )}
            <div className="overflow-y-auto flex-1 relative">
              {!title && fullScreen && (
                <button
                  onClick={onClose}
                  aria-label="關閉全螢幕面板"
                  className="absolute top-4 right-4 z-10 p-2 w-9 h-9 rounded-full bg-black/50 text-white backdrop-blur-md transition-colors flex items-center justify-center active:scale-90"
                >
                  <X size={20} />
                </button>
              )}
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
