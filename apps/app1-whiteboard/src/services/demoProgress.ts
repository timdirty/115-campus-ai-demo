export type DemoProgressStep = 'whiteboard' | 'teacher' | 'robot' | 'library' | 'chat' | 'review';

export type DemoProgress = Record<DemoProgressStep, boolean>;

export const DEMO_PROGRESS_EVENT = 'app1:demo-progress';

const STORAGE_KEY = 'app1:demo-progress:v1';

export const defaultDemoProgress: DemoProgress = {
  whiteboard: false,
  teacher: false,
  robot: false,
  library: false,
  chat: false,
  review: false,
};

function emitDemoProgress(progress: DemoProgress): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<DemoProgress>(DEMO_PROGRESS_EVENT, {detail: progress}));
}

export function loadDemoProgress(): DemoProgress {
  if (typeof window === 'undefined') return {...defaultDemoProgress};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {...defaultDemoProgress};
    const parsed = JSON.parse(raw) as Partial<DemoProgress>;
    return {...defaultDemoProgress, ...parsed};
  } catch {
    return {...defaultDemoProgress};
  }
}

export function saveDemoProgress(update: Partial<DemoProgress>): DemoProgress {
  const next = {...loadDemoProgress(), ...update};
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Session storage is best-effort; the app can still run the demo without it.
    }
  }
  emitDemoProgress(next);
  return next;
}

export function resetDemoProgress(): DemoProgress {
  const next = {...defaultDemoProgress};
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures during reset.
    }
  }
  emitDemoProgress(next);
  return next;
}

export function subscribeDemoProgress(onChange: (progress: DemoProgress) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleProgress = (event: Event) => {
    const detail = (event as CustomEvent<DemoProgress>).detail;
    onChange(detail ?? loadDemoProgress());
  };
  const handleStorage = () => onChange(loadDemoProgress());

  window.addEventListener(DEMO_PROGRESS_EVENT, handleProgress as EventListener);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(DEMO_PROGRESS_EVENT, handleProgress as EventListener);
    window.removeEventListener('storage', handleStorage);
  };
}
