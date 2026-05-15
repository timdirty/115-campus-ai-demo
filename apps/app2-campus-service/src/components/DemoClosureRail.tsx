import {CheckCircle2, GraduationCap, Home, Route, Truck} from 'lucide-react';
import type {AppState} from '../state/appState';

const STEPS = [
  {id: 'student', label: '開始', detail: '學生照三步驟上台', icon: Home},
  {id: 'teach', label: '教學', detail: '點名與互動有紀錄', icon: GraduationCap},
  {id: 'delivery', label: '配送', detail: '下單到送達可追蹤', icon: Truck},
  {id: 'life', label: '生活', detail: '影像派遣進任務', icon: Route},
] as const;

export function DemoClosureRail({
  activeTab,
  state,
  onTabChange,
}: {
  activeTab: string;
  state: AppState;
  onTabChange: (tab: string) => void;
}) {
  const doneById: Record<string, boolean> = {
    student: state.tasks.length > 0 || state.orders.length > 0 || state.attendance.scanned,
    teach: state.attendance.scanned || Object.values(state.studentReports).some((report) => report.events.length > 1),
    delivery: state.orders.length > 0,
    life: state.tasks.some((task) => task.source === 'dispatch') || state.campusStatus.isEmergency,
  };
  const completed = STEPS.filter((step) => doneById[step.id]).length;
  const next = STEPS.find((step) => !doneById[step.id]) ?? STEPS[STEPS.length - 1];
  const allDone = completed === STEPS.length;

  return (
    <section className="mb-4 rounded-3xl border border-primary/15 bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black tracking-[0.22em] text-primary">展示閉環</p>
          <h2 className="mt-1 text-lg font-black text-on-surface">
            {allDone ? '4/4 完成 · 可以收尾報告' : `${completed}/4 完成 · 下一步：${next.label}`}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[34rem]">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const done = doneById[step.id];
            const active = activeTab === step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => onTabChange(step.id)}
                className={`min-h-16 rounded-2xl border px-2 py-2 text-center transition active:scale-[0.98] ${
                  active
                    ? 'border-primary bg-primary text-white shadow-lg shadow-primary/20'
                    : done
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-outline-variant/20 bg-surface-container-low text-on-surface-variant'
                }`}
              >
                <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-lg bg-white/20">
                  {done ? <CheckCircle2 size={17} /> : <Icon size={17} />}
                </div>
                <p className="text-xs font-black">{index + 1}. {step.label}</p>
                <p className="mt-0.5 hidden text-[9px] font-bold opacity-75 md:block">{step.detail}</p>
              </button>
            );
          })}
        </div>
        {!allDone && (
          <button
            type="button"
            onClick={() => onTabChange(next.id)}
            className="min-h-11 rounded-2xl bg-primary px-5 text-sm font-black text-white shadow-lg shadow-primary/20 active:scale-[0.98] lg:hidden"
          >
            前往下一步：{next.label}
          </button>
        )}
      </div>
    </section>
  );
}
