import {CheckCircle2, Eraser, Loader2, Save, ShieldCheck} from 'lucide-react';
import type {BoardAnalysisResponse, BoardRegion, ClassroomSession} from '../../services/classroomApi';

type RegionTaskPanelProps = {
  analysis: BoardAnalysisResponse | null;
  classroom: ClassroomSession | null;
  boardRegions: BoardRegion[];
  busy: string;
  onSaveAnalysis: () => void;
  onRunRegionTask: (status: string, regionId: string) => void;
  onKeepAll: () => void;
};

function getRegionStyle(status: BoardRegion['status']) {
  if (status === 'erasable') {
    return 'bg-tertiary-container/90 border-tertiary text-tertiary';
  }
  if (status === 'erased') {
    return 'bg-surface-container-highest border-outline-variant text-on-surface-variant';
  }
  return 'bg-primary-container/90 border-primary text-primary';
}

export function RegionTaskPanel({analysis, classroom, boardRegions, busy, onSaveAnalysis, onRunRegionTask, onKeepAll}: RegionTaskPanelProps) {
  return (
    <section className="xl:col-span-5 bg-surface-container-high rounded-lg p-4 sm:p-5 border border-outline-variant/20">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-extrabold">白板保留建議</h2>
          <p className="text-sm text-on-surface-variant mt-1">{classroom?.currentRecommendation ?? '等待白板分析。'}</p>
        </div>
        <button
          type="button"
          onClick={onSaveAnalysis}
          disabled={!analysis || busy === 'save'}
          className="min-h-10 px-3 rounded-md bg-primary text-on-primary disabled:opacity-50 flex items-center gap-2 text-sm font-bold shrink-0"
        >
          {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
          保存
        </button>
      </div>

      <div className="relative aspect-[16/9] rounded-lg bg-surface overflow-hidden border border-outline-variant/30 shadow-inner mb-4">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(105,117,112,.22)_1px,transparent_1px),linear-gradient(rgba(105,117,112,.22)_1px,transparent_1px)] bg-[size:24px_24px]" />
        {boardRegions.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-on-surface-variant px-4 text-center">
            尚未取得白板區塊，整理後可保存「保留」或「可清空」決策。
          </div>
        )}
        {boardRegions.map((region) => (
          <button
            key={region.id}
            type="button"
            onClick={() => onRunRegionTask(region.status, region.id)}
            disabled={Boolean(busy)}
            aria-label={`區塊 ${region.id} ${region.status === 'erasable' ? '標記可清空' : '標記保留'}`}
            className={`absolute rounded-md border-2 p-2 text-left transition-all active:scale-95 disabled:opacity-60 overflow-hidden ${getRegionStyle(region.status)}`}
            style={{left: `${region.x}%`, top: `${region.y}%`, width: `${region.width}%`, height: `${region.height}%`}}
          >
            <span className="text-[10px] font-black uppercase">區塊 {region.id}</span>
            <span className="block text-xs sm:text-sm font-extrabold mt-1 leading-tight">{region.label}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {boardRegions.map((region) => (
          <div key={region.id} className="bg-surface rounded-lg p-4 border border-outline-variant/20 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-extrabold">
                區塊 {region.id} · {region.status === 'erasable' ? '可清空' : region.status === 'erased' ? '已清空' : '建議保留'}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">{region.reason}</p>
            </div>
            <button
              type="button"
              onClick={() => onRunRegionTask(region.status, region.id)}
              disabled={busy === `task-${region.id}`}
              className="min-h-10 px-3 rounded-md bg-surface-container-high hover:bg-primary hover:text-on-primary disabled:opacity-50 flex items-center gap-2 text-sm font-bold shrink-0"
            >
              {busy === `task-${region.id}` ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : region.status === 'erasable' ? <Eraser className="w-4 h-4" aria-hidden="true" /> : <CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
              {region.status === 'erasable' ? '標記清空' : '保留'}
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onKeepAll}
        disabled={busy === 'keep-all' || boardRegions.length === 0}
        className="mt-4 w-full min-h-12 rounded-md bg-surface hover:bg-tertiary hover:text-on-tertiary disabled:opacity-50 flex items-center justify-center gap-2 font-bold border border-outline-variant/20"
      >
        {busy === 'keep-all' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="w-4 h-4" aria-hidden="true" />}
        全部標記保留
      </button>
    </section>
  );
}
