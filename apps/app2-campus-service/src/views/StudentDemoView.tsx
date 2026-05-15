import {useState} from 'react';
import {BookOpenCheck, Camera, PackageCheck, RotateCcw, Route, Sparkles} from 'lucide-react';
import {BottomSheet} from '../components/ui';
import {VisionCameraCard} from '../components/life/VisionCameraCard';
import {useAppActions} from '../state/AppStateProvider';
import {VISION_DEMO_SCRIPTS, type CampusVisionResult} from '../services/localVision';
import type {DispatchTaskType, RobotStatus} from '../state/appState';

type StageKey = 'vision' | 'teach' | 'delivery' | 'life';

const STUDENT_STAGE_STORAGE_KEY = 'app2:student-demo-stages:v1';
const defaultCompletedStages: Record<StageKey, boolean> = {
  vision: false,
  teach: false,
  delivery: false,
  life: false,
};

function loadCompletedStages(): Record<StageKey, boolean> {
  if (typeof window === 'undefined') return {...defaultCompletedStages};
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STUDENT_STAGE_STORAGE_KEY) || '{}') as Partial<Record<StageKey, boolean>>;
    return {...defaultCompletedStages, ...parsed};
  } catch {
    return {...defaultCompletedStages};
  }
}

function saveCompletedStages(next: Record<StageKey, boolean>): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STUDENT_STAGE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Student progress is helpful, but the demo can continue if storage is blocked.
  }
}

type VisionDispatchPayload = {
  zone: string;
  taskType: DispatchTaskType;
  title: string;
  detail: string;
  command: string;
  robotId: string;
  robotStatus: RobotStatus;
  phase: string;
};

function dispatchPayloadForVision(result: CampusVisionResult): VisionDispatchPayload {
  const payloadByScene: Record<Exclude<CampusVisionResult['scene'], 'other'>, Omit<VisionDispatchPayload, 'zone'>> = {
    crowd: {
      taskType: 'broadcast',
      title: '人流疏導',
      detail: '廣播提醒同學慢行，協助下課人流通過。',
      command: result.command,
      robotId: '3號',
      robotStatus: '疏導',
      phase: '廣播中',
    },
    safety: {
      taskType: 'patrol',
      title: '安全巡查',
      detail: '前往現場巡查，回報通道與安全狀態。',
      command: result.command,
      robotId: '1號',
      robotStatus: '巡邏',
      phase: '巡查中',
    },
    cleaning: {
      taskType: 'patrol',
      title: '清掃巡邏',
      detail: '加入清掃路線，巡查地面並回報整理狀態。',
      command: result.command,
      robotId: '4號',
      robotStatus: '清掃',
      phase: '清掃中',
    },
    delivery: {
      taskType: 'patrol',
      title: '配送服務',
      detail: '前往教室或服務點協助物品配送。',
      command: result.command,
      robotId: '4號',
      robotStatus: '配送',
      phase: '配送中',
    },
    patrol: {
      taskType: 'patrol',
      title: '一般巡邏',
      detail: '進行日常巡邏並記錄校園環境。',
      command: result.command,
      robotId: '1號',
      robotStatus: '巡邏',
      phase: '巡邏中',
    },
  };

  const scene = result.scene === 'other' ? 'patrol' : result.scene;
  return {zone: result.zone, ...payloadByScene[scene]};
}

export function StudentDemoView({
  showToast,
  onGoTab,
}: {
  showToast: (msg: string) => void;
  onGoTab: (tab: string) => void;
}) {
  const actions = useAppActions();
  const [visionOpen, setVisionOpen] = useState(false);
  const [scriptIndex, setScriptIndex] = useState(0);
  const [lastResult, setLastResult] = useState<CampusVisionResult | null>(null);
  const [completedStages, setCompletedStages] = useState<Record<StageKey, boolean>>(() => loadCompletedStages());
  const currentScript = VISION_DEMO_SCRIPTS[scriptIndex % VISION_DEMO_SCRIPTS.length];
  const completedCount = lastResult ? scriptIndex + 1 : scriptIndex;
  const loopDoneCount = Object.values(completedStages).filter(Boolean).length;

  const markStageDone = (stage: StageKey) => {
    setCompletedStages(prev => {
      const next = {...prev, [stage]: true};
      saveCompletedStages(next);
      return next;
    });
  };

  const makeDeliveryDemo = () => {
    actions.createDeliveryOrder({productId: 1, quantity: 1, destination: '五年級教室'});
    showToast('配送任務完成建立');
  };

  const resetDemo = () => {
    actions.resetDemo();
    setScriptIndex(0);
    setLastResult(null);
    setCompletedStages({...defaultCompletedStages});
    saveCompletedStages({...defaultCompletedStages});
    showToast('展示已重新開始');
  };

  const nextVisionDemo = () => {
    setLastResult(null);
    setScriptIndex(prev => (prev + 1) % VISION_DEMO_SCRIPTS.length);
  };

  const startTeachingDemo = () => {
    actions.scanAttendance();
    markStageDone('teach');
    showToast('教學閉環已啟動：點名完成，接著處理互動訊號');
    onGoTab('teach');
  };

  const startDeliveryDemo = () => {
    makeDeliveryDemo();
    markStageDone('delivery');
    onGoTab('delivery');
  };

  const startLifeDemo = () => {
    actions.addDispatchTask({
      zone: 'B 棟走廊',
      taskType: 'broadcast',
      title: '生活服務示範',
      detail: '把校園事件轉成廣播疏導任務，讓評審看到派遣紀錄。',
      command: 'VISION_CROWD_BROADCAST',
      robotId: '3號',
      robotStatus: '疏導',
      phase: '廣播中',
    });
    markStageDone('life');
    showToast('生活閉環已完成：事件轉成派遣紀錄');
    onGoTab('life');
  };

  const stageActions = [
    {
      label: '開始',
      key: 'vision' as const,
      text: '影像任務',
      line: '我讓機器人先看校園畫面。',
      icon: Camera,
      action: () => setVisionOpen(true),
    },
    {
      label: '教學',
      key: 'teach' as const,
      text: '點名互動',
      line: '它可以幫老師點名，也能提醒課堂狀態。',
      icon: BookOpenCheck,
      action: startTeachingDemo,
    },
    {
      label: '配送',
      key: 'delivery' as const,
      text: '下單追蹤',
      line: '它會建立配送任務，並留下追蹤紀錄。',
      icon: PackageCheck,
      action: startDeliveryDemo,
    },
    {
      label: '生活',
      key: 'life' as const,
      text: '事件派遣',
      line: '它把校園事件變成廣播或巡邏任務。',
      icon: Route,
      action: startLifeDemo,
    },
  ];

  const routeCards = [
    {
      id: 'store-delivery-loop',
      badge: '主線',
      title: '福利社配送',
      line: '下單、檢查庫存、派機器人、確認送達。',
      next: '開始配送任務',
      icon: PackageCheck,
      done: completedStages.delivery,
      action: startDeliveryDemo,
    },
    {
      id: 'teaching-helper-loop',
      badge: '加分',
      title: '老師點名',
      line: '老師按一次，系統整理班級狀態並留下任務。',
      next: '開始教學助手',
      icon: BookOpenCheck,
      done: completedStages.teach,
      action: startTeachingDemo,
    },
    {
      id: 'campus-life-vision-loop',
      badge: '加分',
      title: '生活服務',
      line: '看校園照片，轉成清潔、廣播或巡邏任務。',
      next: '開始看畫面',
      icon: Camera,
      done: completedStages.vision || completedStages.life,
      action: () => setVisionOpen(true),
    },
  ];

  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-5xl flex-col gap-4 pb-6">
      <section className="rounded-3xl border border-primary/15 bg-white px-5 py-5 shadow-sm sm:px-8 sm:py-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-black text-primary">
              <Sparkles className="h-4 w-4" />
              學生展示模式
            </div>
            <h1 className="font-headline text-3xl font-black tracking-tight text-on-surface sm:text-5xl">
              校園服務機器人
            </h1>
            <p className="mt-3 max-w-2xl text-base font-bold leading-7 text-on-surface-variant sm:text-lg">
              照順序按四個大按鈕：看見問題、派出任務、留下紀錄。
            </p>
            <p className="mt-2 text-sm font-black text-primary">
              上台閉環完成度：{loopDoneCount} / 4
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center lg:w-72">
            {['看見', '派遣', '紀錄'].map((step, index) => (
              <div key={step} className="rounded-2xl bg-surface-container-low px-3 py-4">
                <p className="text-2xl font-black text-primary">{index + 1}</p>
                <p className="mt-1 text-xs font-black text-on-surface-variant">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-primary/10 bg-white p-4 shadow-sm" data-demo-routes="app2">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black tracking-[0.22em] text-primary">展示路線卡</p>
            <h2 className="text-lg font-black text-on-surface">先跑主線，追問再開支線</h2>
          </div>
          <p className="text-xs font-bold text-on-surface-variant">每條路線都會留下任務紀錄</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {routeCards.map((route) => {
            const Icon = route.icon;
            return (
              <button
                key={route.id}
                type="button"
                onClick={route.action}
                className={`min-h-36 rounded-2xl border p-4 text-left shadow-sm transition-all hover:border-primary/30 active:scale-[0.99] ${
                  route.done
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : route.badge === '主線'
                    ? 'border-primary bg-primary text-white shadow-lg shadow-primary/20'
                    : 'border-outline-variant/20 bg-surface-container-lowest'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
                    route.done ? 'bg-emerald-600 text-white' : route.badge === '主線' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                  }`}>
                    {route.done ? <Sparkles className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
                  </span>
                  <span>
                    <span className={`block text-[10px] font-black tracking-[0.18em] ${route.done ? 'text-emerald-700' : route.badge === '主線' ? 'text-white/70' : 'text-primary'}`}>{route.done ? '完成' : route.badge}</span>
                    <span className={`block text-base font-black ${route.done ? 'text-emerald-950' : route.badge === '主線' ? 'text-white' : 'text-on-surface'}`}>{route.title}</span>
                  </span>
                </div>
                <p className={`mt-3 text-sm font-bold leading-6 ${route.done ? 'text-emerald-800' : route.badge === '主線' ? 'text-white/75' : 'text-on-surface-variant'}`}>{route.line}</p>
                <p className={`mt-3 text-xs font-black ${route.done ? 'text-emerald-700' : route.badge === '主線' ? 'text-white' : 'text-primary'}`}>{route.next} →</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-primary/10 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black tracking-[0.22em] text-primary">四段展示</p>
            <h2 className="text-base font-black text-on-surface">開始、教學、配送、生活一次走完</h2>
          </div>
          <p className="hidden text-xs font-bold text-on-surface-variant sm:block">照順序點就不會迷路</p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stageActions.map((item, index) => {
            const Icon = item.icon;
            const isFirst = index === 0;
            const done = completedStages[item.key];
            return (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className={`min-h-32 rounded-2xl border p-4 text-left shadow-sm transition-all hover:border-primary/30 active:scale-[0.99] ${
                  done
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : isFirst
                    ? 'border-primary bg-primary text-white shadow-lg shadow-primary/20'
                    : 'border-outline-variant/20 bg-surface-container-lowest'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${done ? 'bg-emerald-600 text-white' : isFirst ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                    {done ? <Sparkles className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
                  </div>
                  <div>
                    <p className={`text-[10px] font-black tracking-[0.18em] ${done ? 'text-emerald-700' : isFirst ? 'text-white/70' : 'text-primary'}`}>{done ? '完成' : index + 1}</p>
                    <p className={`text-sm font-black ${done ? 'text-emerald-950' : isFirst ? 'text-white' : 'text-on-surface'}`}>{item.label} · {item.text}</p>
                  </div>
                </div>
                <p className={`mt-3 text-xs font-bold leading-5 ${done ? 'text-emerald-800' : isFirst ? 'text-white/75' : 'text-on-surface-variant'}`}>
                  {done ? '已留下紀錄，可以接下一步。' : item.line}
                </p>
                {isFirst && (
                  <p className="mt-2 text-[10px] font-black text-white/65">
                    第 {scriptIndex + 1} 關：{currentScript.title}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl bg-surface-container-low px-5 py-4 text-sm font-black text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
        <p>
          影像展示進度：{Math.min(completedCount, VISION_DEMO_SCRIPTS.length)} / {VISION_DEMO_SCRIPTS.length}
          {lastResult ? ` · 剛完成 ${lastResult.label}` : ' · 準備開始'}
        </p>
        <button
          type="button"
          onClick={resetDemo}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-primary shadow-sm active:scale-[0.98]"
        >
          <RotateCcw className="h-4 w-4" />
          重新開始
        </button>
      </section>

      <BottomSheet isOpen={visionOpen} onClose={() => setVisionOpen(false)} fullScreen>
        <VisionCameraCard
          isOpen={visionOpen}
          showToast={showToast}
          onDispatch={result => {
            actions.addDispatchTask(dispatchPayloadForVision(result));
            setLastResult(result);
            markStageDone('vision');
          }}
          studentMode
          script={currentScript}
          scriptIndex={scriptIndex}
          scriptTotal={VISION_DEMO_SCRIPTS.length}
          onNextScript={nextVisionDemo}
        />
      </BottomSheet>
    </div>
  );
}
