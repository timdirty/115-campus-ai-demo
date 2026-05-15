import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

const SCAN_ZONES = [
  { id: 'b4',  label: 'B-4 走廊',  status: '人流偏高',  level: 'warn'  as const, cx: '38%', cy: '48%' },
  { id: 'a2',  label: 'A-2 入口',  status: '正常通行',  level: 'ok'    as const, cx: '63%', cy: '31%' },
  { id: 'ops', label: '操場出口', status: '正常通行', level: 'ok'    as const, cx: '52%', cy: '68%' },
];

const ZONE_MSGS: Record<'warn' | 'ok' | 'error', string[]> = {
  warn:  ['人流密度偏高', '走廊壅塞', '需要疏導'],
  ok:    ['人員正常流動', '場域正常', '無異常狀況'],
  error: ['偵測到異常聚集', '緊急狀況', '需立即處置'],
};

const MATCH_PCT = ['98%', '95%', '91%'];

function levelColor(level: 'ok' | 'warn' | 'error') {
  return level === 'error' ? 'text-error' : level === 'warn' ? 'text-amber-400' : 'text-[#87d46c]';
}

export function ScanMapCard() {
  const [scanZoneIdx, setScanZoneIdx] = useState(0);
  const [scanMessage, setScanMessage] = useState(ZONE_MSGS[SCAN_ZONES[0].level][0]);
  const scanZoneIdxRef = useRef(0);

  useEffect(() => {
    const intv = setInterval(() => {
      const nextIdx = (scanZoneIdxRef.current + 1) % SCAN_ZONES.length;
      scanZoneIdxRef.current = nextIdx;
      setScanZoneIdx(nextIdx);
      const zone = SCAN_ZONES[nextIdx];
      const msgs = ZONE_MSGS[zone.level];
      const msg = msgs[Math.floor(Math.random() * msgs.length)];
      setScanMessage(msg);
    }, 3000);
    return () => clearInterval(intv);
  }, []);

  const currentZone = SCAN_ZONES[scanZoneIdx];

  return (
    <motion.div
      className="relative h-80 bg-[#0c121d] rounded-2xl overflow-hidden border-2 border-primary/20 cursor-pointer shadow-2xl"
      whileHover={{ borderColor: 'rgba(var(--color-primary),0.5)' }}
      whileTap={{ scale: 0.99 }}
    >
      {/* Campus floor plan (mini) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style={{ opacity: 0.18 }}>
        <rect x="4" y="20" width="32" height="34" rx="2" fill="rgba(74,128,219,0.1)" stroke="#4a80db" strokeWidth="0.7"/>
        <text x="20" y="38" fill="#4a80db" fontSize="4" textAnchor="middle" fontFamily="monospace">B棟</text>
        <rect x="46" y="8" width="46" height="38" rx="2" fill="rgba(74,128,219,0.1)" stroke="#4a80db" strokeWidth="0.7"/>
        <text x="69" y="27" fill="#4a80db" fontSize="4" textAnchor="middle" fontFamily="monospace">A棟</text>
        <rect x="26" y="41" width="46" height="11" rx="1.5" fill="rgba(74,128,219,0.15)" stroke="#4a80db" strokeWidth="0.4" strokeDasharray="2,1.5"/>
        <text x="49" y="48" fill="#4a80db" fontSize="2.5" textAnchor="middle" fontFamily="monospace">走廊</text>
        <rect x="12" y="57" width="70" height="30" rx="3" fill="rgba(74,128,219,0.06)" stroke="#4a80db" strokeWidth="0.5" strokeDasharray="3,2"/>
        <text x="47" y="73" fill="#4a80db" fontSize="4" textAnchor="middle" fontFamily="monospace">操場</text>
      </svg>

      {/* Zone dots */}
      {SCAN_ZONES.map((zone, i) => (
        <div key={zone.id} className="absolute" style={{ left: zone.cx, top: zone.cy, transform: 'translate(-50%,-50%)' }}>
          {i === scanZoneIdx && (
            <div className={`absolute w-4 h-4 rounded-full animate-ping ${zone.level === 'warn' ? 'bg-amber-400/60' : 'bg-[#87d46c]/60'}`} style={{ transform: 'scale(2.5)' }} />
          )}
          <div className={`w-3.5 h-3.5 rounded-full border-2 border-white/80 shadow-lg relative z-10 ${zone.level === 'warn' ? 'bg-amber-400' : 'bg-[#87d46c]'}`} />
          <div className={`absolute top-5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold whitespace-nowrap border z-10 transition-all ${i === scanZoneIdx ? 'bg-primary/90 text-white border-white/20 opacity-100' : 'opacity-0'}`}>
            {zone.label}
          </div>
        </div>
      ))}

      {/* Scan box */}
      <AnimatePresence mode="wait">
        <motion.div
          key={scanZoneIdx}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: [1, 1.05, 1] }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.4, scale: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }}
          className="absolute w-36 h-36 border-2 border-primary/60 pointer-events-none z-20"
          style={{ left: SCAN_ZONES[scanZoneIdx].cx, top: SCAN_ZONES[scanZoneIdx].cy, transform: 'translate(-50%,-50%)' }}
        >
          {/* Corners */}
          <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
          <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
          <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
          <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
          {/* Label */}
          <div className="absolute -top-8 left-0 bg-primary text-white text-[9px] font-mono font-bold px-2.5 py-1 rounded-full whitespace-nowrap border border-white/20 shadow-lg">
            場景判斷：可信度 {MATCH_PCT[scanZoneIdx]}
          </div>
          {/* Scan line */}
          <motion.div
            animate={{ y: ['-100%', '100%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-x-0 h-0.5 bg-primary/60"
            style={{ filter: 'blur(1px)' }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Bottom overlay */}
      <div className="absolute bottom-0 inset-x-0 p-4 pt-14" style={{ background: 'linear-gradient(to top, #0c121d 60%, transparent)' }}>
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              <span className="text-[9px] text-primary font-extrabold tracking-[0.2em] font-mono uppercase">智慧影像監控</span>
            </div>
            <p className="text-white font-bold text-lg leading-tight">{currentZone.label}</p>
            <p className={`text-xs font-bold mt-0.5 ${levelColor(currentZone.level)}`}>{currentZone.status}</p>
            <p className="text-[9px] font-bold font-mono mt-1 text-primary">
              ▸ {scanMessage}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
