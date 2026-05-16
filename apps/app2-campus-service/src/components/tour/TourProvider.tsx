import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { TOUR_STEPS, TOUR_STORAGE_KEY } from './tourSteps';

export type TourContextValue = {
  isActive: boolean;
  currentStepIndex: number;
  totalSteps: number;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  restartTour: () => void;
};

export const TourContext = createContext<TourContextValue>({
  isActive: false,
  currentStepIndex: 0,
  totalSteps: TOUR_STEPS.length,
  startTour: () => {},
  nextStep: () => {},
  prevStep: () => {},
  skipTour: () => {},
  restartTour: () => {},
});

export function TourProvider({
  children,
  onTabChange,
  disabled = false,
}: {
  children: React.ReactNode;
  onTabChange: (tab: string) => void;
  disabled?: boolean;
}) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const onTabChangeRef = useRef(onTabChange);
  onTabChangeRef.current = onTabChange;
  const currentStepIndexRef = useRef(0);

  const completeTour = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(TOUR_STORAGE_KEY, 'done');
  }, []);

  const startTour = useCallback(() => {
    if (disabled) return;
    currentStepIndexRef.current = 0;
    setCurrentStepIndex(0);
    setIsActive(true);
  }, [disabled]);

  const nextStep = useCallback(() => {
    const next = currentStepIndexRef.current + 1;
    if (next >= TOUR_STEPS.length) {
      completeTour();
      return;
    }
    const nextStepData = TOUR_STEPS[next];
    if (nextStepData?.tab) {
      onTabChangeRef.current(nextStepData.tab);
    }
    currentStepIndexRef.current = next;
    setCurrentStepIndex(next);
  }, [completeTour]);

  const prevStep = useCallback(() => {
    const next = Math.max(0, currentStepIndexRef.current - 1);
    const prevStepData = TOUR_STEPS[next];
    if (prevStepData?.tab) {
      onTabChangeRef.current(prevStepData.tab);
    }
    currentStepIndexRef.current = next;
    setCurrentStepIndex(next);
  }, []);

  const skipTour = useCallback(() => {
    completeTour();
  }, [completeTour]);

  const restartTour = useCallback(() => {
    if (disabled) return;
    localStorage.removeItem(TOUR_STORAGE_KEY);
    onTabChangeRef.current('delivery');
    currentStepIndexRef.current = 0;
    setCurrentStepIndex(0);
    setIsActive(true);
  }, [disabled]);

  useEffect(() => {
    if (!disabled) return;
    setIsActive(false);
  }, [disabled]);

  // 導覽改為「手動觸發」— 不再自動 pop（會擋住小孩按 demo 按鈕）
  // 學生需要看導覽時，從右上角設定面板按「重新導覽」即可。
  // 同時把第一次造訪的 storage flag 直接寫為 done，避免任何殘餘 auto-trigger。
  useEffect(() => {
    if (disabled) return;
    if (!localStorage.getItem(TOUR_STORAGE_KEY)) {
      localStorage.setItem(TOUR_STORAGE_KEY, 'done');
    }
  }, [disabled]);

  return (
    <TourContext.Provider
      value={{ isActive, currentStepIndex, totalSteps: TOUR_STEPS.length, startTour, nextStep, prevStep, skipTour, restartTour }}
    >
      {children}
    </TourContext.Provider>
  );
}
