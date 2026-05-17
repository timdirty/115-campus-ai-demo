import {memo} from 'react';
import {Info} from 'lucide-react';

export const NoticeBar = memo(function NoticeBar({notice}: {notice: string}) {
  return (
    <section className="mb-5 rounded-lg border border-outline-variant/20 bg-surface-container-low p-4 flex items-start gap-3" role="status" aria-live="polite">
      <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
      <div>
        <p className="font-bold text-sm">{notice}</p>
        <p className="text-xs text-on-surface-variant mt-1">課堂紀錄與統計自動保存；原始影像僅用於當下分析，不留存。</p>
      </div>
    </section>
  );
});
