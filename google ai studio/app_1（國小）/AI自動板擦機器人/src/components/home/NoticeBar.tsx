import {AlertTriangle} from 'lucide-react';

export function NoticeBar({notice}: {notice: string}) {
  return (
    <section className="mb-5 rounded-lg border border-outline-variant/20 bg-surface-container-low p-4 flex items-start gap-3" aria-live="polite">
      <AlertTriangle className="w-5 h-5 text-tertiary shrink-0 mt-0.5" aria-hidden="true" />
      <div>
        <p className="font-bold text-sm">{notice}</p>
        <p className="text-xs text-on-surface-variant mt-1">預設只保存生成後的課堂紀錄與統計，不保存原始錄音檔。</p>
      </div>
    </section>
  );
}
