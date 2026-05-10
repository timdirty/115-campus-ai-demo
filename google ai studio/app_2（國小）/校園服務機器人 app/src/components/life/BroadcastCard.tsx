import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Megaphone, Radio } from 'lucide-react';
import { sendHardwareCommand } from '../../services/hardwareBridge';

interface BroadcastCardProps {
  showToast: (msg: string) => void;
  onDispatch: (zones: string) => void;
}

const BROADCAST_ZONES = ['全校', 'A棟', 'B棟', '操場'];

export function BroadcastCard({ showToast, onDispatch }: BroadcastCardProps) {
  const [broadcastZones, setBroadcastZones] = useState<Set<string>>(new Set(['全校']));
  const [broadcastPressing, setBroadcastPressing] = useState(false);
  const [broadcastSent, setBroadcastSent] = useState(false);
  const broadcastPressingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const broadcastSentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (broadcastPressingTimerRef.current) clearTimeout(broadcastPressingTimerRef.current);
      if (broadcastSentTimerRef.current) clearTimeout(broadcastSentTimerRef.current);
    };
  }, []);

  const toggleBroadcastZone = (zone: string) => {
    if (zone === '全校') { setBroadcastZones(new Set(['全校'])); return; }
    const next = new Set(broadcastZones);
    next.delete('全校');
    if (next.has(zone)) next.delete(zone); else next.add(zone);
    if (next.size === 0) next.add('全校');
    setBroadcastZones(next);
  };

  const handleEmergencyBroadcast = useCallback(() => {
    if (!broadcastPressing) {
      setBroadcastPressing(true);
      if (broadcastPressingTimerRef.current) clearTimeout(broadcastPressingTimerRef.current);
      broadcastPressingTimerRef.current = setTimeout(() => {
        broadcastPressingTimerRef.current = null;
        setBroadcastPressing(false);
      }, 2500);
      return;
    }
    const zones = Array.from(broadcastZones).join('、');
    onDispatch(zones);
    // Fire hardware command (non-blocking, best-effort)
    sendHardwareCommand('BROADCAST_EMERGENCY', 'life').catch(() => {});
    setBroadcastSent(true);
    showToast('緊急廣播已發送至：' + zones);
    if (broadcastSentTimerRef.current) clearTimeout(broadcastSentTimerRef.current);
    broadcastSentTimerRef.current = setTimeout(() => {
      broadcastSentTimerRef.current = null;
      setBroadcastSent(false);
    }, 3000);
    setBroadcastPressing(false);
  }, [broadcastPressing, broadcastZones, onDispatch, showToast]);

  return (
    <div className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant/30 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Radio size={15} className="text-primary" />
        <h3 className="font-headline text-sm font-bold">廣播控制</h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {BROADCAST_ZONES.map(zone => (
          <button
            key={zone}
            onClick={() => toggleBroadcastZone(zone)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${broadcastZones.has(zone) ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-surface-container-lowest border-outline-variant/20 text-on-surface-variant hover:border-primary/20'}`}
          >
            {zone}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {broadcastSent ? (
          <motion.div
            key="sent"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 py-4 bg-[#87d46c]/15 border-2 border-[#87d46c]/40 rounded-2xl text-center text-[#87d46c] font-bold text-sm"
          >
            ✓ 廣播已發送
          </motion.div>
        ) : (
          <motion.button
            key="btn"
            onClick={handleEmergencyBroadcast}
            whileTap={{ scale: 0.96 }}
            className={`flex-1 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all border-2 ${broadcastPressing ? 'bg-error text-white border-error shadow-lg shadow-error/40' : 'bg-error/10 border-error/30 text-error hover:bg-error/20'}`}
          >
            <Megaphone size={17} className={broadcastPressing ? 'animate-bounce' : ''} />
            {broadcastPressing ? '再按一次確認發送' : '緊急廣播'}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
