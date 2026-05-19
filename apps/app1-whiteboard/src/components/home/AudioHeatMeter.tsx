// FUN-345 — Audio heat meter widget for CapturePanel.
//
// Renders the current RMS volume (0..1) as a horizontal bar plus a 30-second
// sparkline so the teacher's emphasis peaks are visible during demo. Wired
// to useMediaCapture's audioVolume / audioVolumeHistory output.

import {memo, useMemo} from 'react';
import {Mic2} from 'lucide-react';
import type {AudioVolumeSample} from '../../hooks/useMediaCapture';

type Props = {
  active: boolean;        // 是否正在錄音
  volume: number;         // 即時音量 0..1
  history: AudioVolumeSample[];
};

const WIDTH = 140;
const HEIGHT = 36;
const WINDOW_MS = 30_000;

function levelLabel(v: number) {
  if (v < 0.05) return {label: '安靜', tone: 'text-on-surface-variant'};
  if (v < 0.18) return {label: '正常', tone: 'text-primary'};
  if (v < 0.35) return {label: '強調', tone: 'text-amber-500'};
  return {label: '高峰', tone: 'text-red-500'};
}

export const AudioHeatMeter = memo(function AudioHeatMeter({active, volume, history}: Props) {
  const pct = Math.min(100, Math.round(volume * 200));
  const tier = levelLabel(volume);
  const sparkPath = useMemo(() => {
    if (history.length === 0) return '';
    const tNow = history[history.length - 1].t;
    const tMin = tNow - WINDOW_MS;
    const usable = history.filter((s) => s.t >= tMin);
    if (usable.length === 0) return '';
    const points = usable.map((s) => {
      const x = ((s.t - tMin) / WINDOW_MS) * WIDTH;
      const y = HEIGHT - Math.min(1, s.v * 2) * HEIGHT;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${points.join(' L ')}`;
  }, [history]);

  return (
    <div
      className="rounded-md border border-outline-variant/40 bg-surface-container px-3 py-2 flex items-center gap-3"
      data-tour="audio-heat-meter"
      aria-live="polite"
    >
      <Mic2 className={`w-4 h-4 ${active ? 'text-primary' : 'text-on-surface-variant'}`} aria-hidden="true" />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold text-on-surface-variant">聲音熱度</span>
          <span className={`text-[11px] font-bold ${active ? tier.tone : 'text-on-surface-variant'}`}>
            {active ? tier.label : '未錄音'}
          </span>
        </div>
        <div className="relative h-2 rounded-full bg-surface-container-high overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 transition-[width] duration-100 ease-out ${active ? 'bg-primary' : 'bg-on-surface-variant/30'}`}
            style={{width: `${pct}%`}}
          />
        </div>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="mt-1 h-7 w-full"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {sparkPath && (
            <path
              d={sparkPath}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.2}
              className={active ? 'text-primary/70' : 'text-on-surface-variant/40'}
            />
          )}
        </svg>
      </div>
    </div>
  );
});
