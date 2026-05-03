import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
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
}: {
  children: React.ReactNode;
  onTabChange: (tab: string) => void;
}) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const onTabChangeRef = useRef(onTabChange);
  onTabChangeRef.current = onTabChange;

  const completeTour = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(TOUR_STORAGE_KEY, 'done');
  }, []);

  const startTour = useCallback(() => {
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStepIndex((prev) => {
      const next = prev + 1;
      if (next >= TOUR_STEPS.length) {
        completeTour();
        return prev;
      }
      const nextStep = TOUR_STEPS[next];
      if (nextStep?.tab) {
        onTabChangeRef.current(nextStep.tab);
      }
      return next;
    });
  }, [completeTour]);

  const prevStep = useCallback(() => {
    setCurrentStepIndex((prev) => {
      const next = Math.max(0, prev - 1);
      const prevStepData = TOUR_STEPS[next];
      if (prevStepData?.tab) {
        onTabChangeRef.current(prevStepData.tab);
      }
      return next;
    });
  }, []);

  const skipTour = useCallback(() => {
    completeTour();
  }, [completeTour]);

  const restartTour = useCallback(() => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    onTabChangeRef.current('dashboard');
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  // Auto-start on first visit, with 300ms delay to let UI render
  useEffect(() => {
    const seen = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!seen) {
      const timer = setTimeout(() => startTour(), 300);
      return () => clearTimeout(timer);
    }
  }, [startTour]);

  return (
    <TourContext.Provider
      value={{ isActive, currentStepIndex, totalSteps: TOUR_STEPS.length, startTour, nextStep, prevStep, skipTour, restartTour }}
    >
      {children}
    </TourContext.Provider>
  );
}
