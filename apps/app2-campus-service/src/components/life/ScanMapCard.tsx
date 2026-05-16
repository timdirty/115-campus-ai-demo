import {Camera, Sparkles} from 'lucide-react';
import {useAppState} from '../../state/AppStateProvider';

/**
 * 影像辨識 CTA — 點此開啟真實 Gemini Vision 鏡頭。
 * 不再顯示假掃描動畫；改成乾淨的卡片 + 上次真實辨識結果（如果有）。
 */
export function ScanMapCard() {
  const state = useAppState();
  const lastDispatchTask = [...state.tasks].reverse().find(t => t.source === 'dispatch');

  return (
    <div className="relative rounded-2xl overflow-hidden border border-primary/15 bg-white shadow-sm cursor-pointer transition-colors hover:border-primary/35">
      <div className="flex items-stretch">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center bg-primary/8 border-r border-primary/15">
          <Camera className="h-10 w-10 text-primary" strokeWidth={1.5} />
        </div>
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-black tracking-[0.2em] uppercase text-primary">AI 影像派遣</span>
            <Sparkles className="h-3 w-3 text-primary opacity-70" />
          </div>
          <h3 className="text-base font-black text-on-surface leading-tight">點此開啟鏡頭辨識</h3>
          {lastDispatchTask ? (
            <p className="mt-1 text-xs font-bold text-on-surface-variant truncate">
              上次：{lastDispatchTask.area || '校園場景'}・{lastDispatchTask.detail?.slice(0, 24) || lastDispatchTask.title}
            </p>
          ) : (
            <p className="mt-1 text-xs font-medium text-on-surface-variant/70 leading-snug">
              Gemini 2.5 Flash 分析校園情境，自動建議派遣動作。
            </p>
          )}
        </div>
        <div className="flex items-center pr-4 shrink-0">
          <span className="rounded-full bg-primary text-white text-[10px] font-black tracking-widest px-3 py-1.5 shadow-sm">
            開啟 →
          </span>
        </div>
      </div>
    </div>
  );
}
