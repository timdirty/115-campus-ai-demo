import {Loader2, Plus} from 'lucide-react';

type QuickNotePanelProps = {
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
};

export function QuickNotePanel({value, busy, onChange, onSave}: QuickNotePanelProps) {
  return (
    <section className="bg-surface-container-low rounded-lg p-5 border border-outline-variant/20">
      <h2 className="text-xl font-extrabold mb-4">快速課堂紀錄</h2>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        placeholder="輸入板書重點、孩子的提問、分組活動或老師提醒。"
        className="w-full rounded-md bg-surface p-4 outline-none border border-outline-variant/20 resize-none text-sm"
      />
      <button
        type="button"
        onClick={onSave}
        disabled={!value.trim() || busy}
        className="mt-3 w-full min-h-11 rounded-md bg-primary text-on-primary disabled:opacity-50 flex items-center justify-center gap-2 font-bold"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Plus className="w-4 h-4" aria-hidden="true" />}
        新增到紀錄本
      </button>
    </section>
  );
}
