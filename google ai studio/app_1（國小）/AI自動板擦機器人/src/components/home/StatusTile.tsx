import type {LucideIcon} from 'lucide-react';

type StatusTileProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  ok: boolean;
};

export function StatusTile({icon: Icon, label, value, ok}: StatusTileProps) {
  return (
    <div className={`rounded-2xl p-4 border flex items-center gap-3 min-w-0 transition-colors ${ok ? 'bg-primary/8 border-primary/15' : 'bg-surface-container-low border-outline-variant/20'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ok ? 'bg-primary text-on-primary shadow-sm shadow-primary/30' : 'bg-surface-container-highest text-on-surface-variant/60'}`}>
        <Icon className="w-4.5 h-4.5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold tracking-wide text-on-surface-variant/70 uppercase">{label}</p>
        <p className={`font-extrabold text-sm truncate mt-0.5 ${ok ? 'text-primary' : 'text-on-surface-variant'}`} title={value}>{value}</p>
      </div>
      <div className={`ml-auto h-2 w-2 shrink-0 rounded-full ${ok ? 'bg-primary animate-pulse' : 'bg-outline-variant/40'}`} />
    </div>
  );
}
