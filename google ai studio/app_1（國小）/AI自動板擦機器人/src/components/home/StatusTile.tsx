import type {LucideIcon} from 'lucide-react';

type StatusTileProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  ok: boolean;
};

export function StatusTile({icon: Icon, label, value, ok}: StatusTileProps) {
  return (
    <div className="bg-surface-container-low rounded-lg p-4 border border-outline-variant/20 flex items-center gap-3 min-w-0">
      <div className={`w-11 h-11 rounded-md flex items-center justify-center shrink-0 ${ok ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'}`}>
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-on-surface-variant">{label}</p>
        <p className="font-extrabold text-sm truncate">{value}</p>
      </div>
    </div>
  );
}
