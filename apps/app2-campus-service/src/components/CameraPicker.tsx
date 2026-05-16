import {ChevronDown, Camera, RefreshCw} from 'lucide-react';
import type {CameraOption} from '../hooks/useCameraSelection';

interface CameraPickerProps {
  devices: CameraOption[];
  selectedDeviceId: string | null;
  onSelect: (deviceId: string) => void;
  onRefresh?: () => void;
  /** Inline (緊湊單行) 或 stacked (錯誤頁面用大方塊) */
  variant?: 'inline' | 'stacked';
  /** 額外提示文字（例如錯誤訊息） */
  hint?: string;
}

/**
 * Camera selection dropdown.
 * - "inline": small selector pinned in a corner / above video
 * - "stacked": large block for error states
 */
export function CameraPicker({
  devices,
  selectedDeviceId,
  onSelect,
  onRefresh,
  variant = 'inline',
  hint,
}: CameraPickerProps) {
  const hasDevices = devices.length > 0;
  const currentLabel = devices.find(d => d.deviceId === selectedDeviceId)?.label;

  if (variant === 'stacked') {
    return (
      <div className="w-full rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-on-surface-variant" />
          <p className="text-[11px] font-black tracking-widest uppercase text-on-surface-variant">選擇攝影機</p>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="ml-auto text-[10px] font-bold text-primary flex items-center gap-1 hover:opacity-70"
            >
              <RefreshCw className="h-2.5 w-2.5" /> 重新偵測
            </button>
          )}
        </div>
        {hasDevices ? (
          <div className="space-y-1.5">
            {devices.map(d => (
              <button
                key={d.deviceId}
                type="button"
                onClick={() => onSelect(d.deviceId)}
                className={`w-full text-left rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                  d.deviceId === selectedDeviceId
                    ? 'bg-primary text-white shadow-[0_2px_8px_rgba(var(--color-primary),0.25)]'
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                }`}
              >
                {d.label}
                {d.deviceId === selectedDeviceId && <span className="ml-2 text-[10px] opacity-70">使用中</span>}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-on-surface-variant py-2">
            尚未偵測到攝影機。請允許瀏覽器使用相機，再點「重新偵測」。
          </p>
        )}
        {hint && (
          <p className="text-[11px] text-on-surface-variant leading-relaxed">{hint}</p>
        )}
      </div>
    );
  }

  // inline variant
  return (
    <div className="relative inline-flex items-center gap-1.5 rounded-full bg-black/65 backdrop-blur-md px-2.5 py-1.5 text-white text-[11px] font-bold border border-white/15">
      <Camera className="h-3 w-3 opacity-80" />
      <select
        value={selectedDeviceId ?? ''}
        onChange={e => onSelect(e.target.value)}
        className="bg-transparent text-white text-[11px] font-bold outline-none cursor-pointer pr-4 max-w-[140px] truncate appearance-none"
        aria-label="選擇攝影機"
      >
        {!hasDevices && <option value="">未偵測到相機</option>}
        {hasDevices && !selectedDeviceId && <option value="">選擇相機…</option>}
        {devices.map(d => (
          <option key={d.deviceId} value={d.deviceId} className="text-black">
            {d.label}
          </option>
        ))}
      </select>
      <ChevronDown className="h-3 w-3 opacity-60 absolute right-2 pointer-events-none" />
      {!currentLabel && hasDevices && (
        <span className="sr-only">尚未選擇相機</span>
      )}
    </div>
  );
}
