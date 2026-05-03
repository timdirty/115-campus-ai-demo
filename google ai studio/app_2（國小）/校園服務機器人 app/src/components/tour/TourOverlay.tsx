import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useLayoutEffect, useState } from 'react';
import { TOUR_STEPS } from './tourSteps';
import { useTour } from './useTour';

// ─── Styles ──────────────────────────────────────────────────────────────────

const BACKDROP_COLOR = 'rgba(0,0,0,0.55)';
const FULLSCREEN_BACKDROP_COLOR = 'rgba(0,0,0,0.7)';
const TOOLTIP_Z = 9999;
const OVERLAY_Z = 9998;
const SKIP_Z = 10000;

const primaryBtn: React.CSSProperties = {
  backgroundColor: '#6366f1',
  color: 'white',
  border: 'none',
  borderRadius: 8,
  padding: '8px 18px',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 600,
};

const secondaryBtn: React.CSSProperties = {
  backgroundColor: '#f3f4f6',
  color: '#374151',
  border: 'none',
  borderRadius: 8,
  padding: '8px 18px',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 600,
};

const demoTipBox: React.CSSProperties = {
  backgroundColor: '#fff7ed',
  border: '1px solid #fed7aa',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 13,
  color: '#c2410c',
  marginTop: 10,
  lineHeight: 1.5,
};

const skipBtnStyle: React.CSSProperties = {
  position: 'fixed',
  top: 16,
  right: 16,
  zIndex: SKIP_Z,
  color: '#9ca3af',
  cursor: 'pointer',
  fontSize: 13,
  background: 'none',
  border: 'none',
  padding: '4px 8px',
};

// ─── TargetRect ───────────────────────────────────────────────────────────────

type Rect = { top: number; left: number; bottom: number; right: number; width: number; height: number };

function emptyRect(): Rect {
  return { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 };
}

// ─── FullscreenCard ───────────────────────────────────────────────────────────

function FullscreenCard({
  stepIndex,
  title,
  body,
  demoTip,
  isFirst,
  isLast,
  onNext,
  onSkip,
}: {
  stepIndex: number;
  title: string;
  body: string;
  demoTip: string;
  isFirst: boolean;
  isLast: boolean;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: FULLSCREEN_BACKDROP_COLOR,
        zIndex: OVERLAY_Z,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Skip link — top-right */}
      <button style={skipBtnStyle} onClick={onSkip}>
        跳過導覽
      </button>

      <AnimatePresence mode="wait">
        <motion.div
          key={stepIndex}
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            background: 'white',
            borderRadius: 16,
            padding: 28,
            maxWidth: 400,
            width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          }}
        >
          <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700, color: '#1f2937' }}>
            {title}
          </h2>
          <p style={{ margin: '0 0 4px', fontSize: 15, color: '#374151', lineHeight: 1.6 }}>
            {body}
          </p>
          <div style={demoTipBox}>🎙 {demoTip}</div>
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            {isFirst && (
              <button style={primaryBtn} onClick={onNext}>
                開始導覽 →
              </button>
            )}
            {isLast && (
              <button style={primaryBtn} onClick={onNext}>
                開始使用 ✓
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── SpotlightOverlay ─────────────────────────────────────────────────────────

function SpotlightOverlay({
  rect,
  stepIndex,
  title,
  body,
  demoTip,
  tooltipSide,
  isFirstSpotlight,
  totalSpotlightSteps,
  spotlightIndex,
  onNext,
  onPrev,
  onSkip,
}: {
  rect: Rect;
  stepIndex: number;
  title: string;
  body: string;
  demoTip: string;
  tooltipSide: 'top' | 'bottom' | 'left' | 'right';
  isFirstSpotlight: boolean;
  totalSpotlightSteps: number;
  spotlightIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  const [visible, setVisible] = useState(false);

  // Fade-in on step change
  useLayoutEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, [stepIndex]);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const TOOLTIP_W = 320;
  const GAP = 12;

  // Compute tooltip position
  let tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: TOOLTIP_Z,
    width: TOOLTIP_W,
    maxWidth: TOOLTIP_W,
    background: 'white',
    borderRadius: 12,
    boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
    padding: 16,
    opacity: visible ? 1 : 0,
    transition: 'opacity 0.1s ease',
  };

  // Horizontal center of target, clamped
  const targetCenterX = rect.left + rect.width / 2;
  const clampedLeft = Math.min(Math.max(8, targetCenterX - TOOLTIP_W / 2), vw - TOOLTIP_W - 8);

  if (tooltipSide === 'bottom') {
    tooltipStyle = {
      ...tooltipStyle,
      top: Math.min(rect.bottom + GAP, vh - 200),
      left: clampedLeft,
    };
  } else if (tooltipSide === 'top') {
    const tooltipHeight = 220; // estimated
    tooltipStyle = {
      ...tooltipStyle,
      top: Math.max(8, rect.top - tooltipHeight - GAP),
      left: clampedLeft,
    };
  } else if (tooltipSide === 'left') {
    const tooltipHeight = 220;
    tooltipStyle = {
      ...tooltipStyle,
      top: Math.max(8, Math.min(rect.top + rect.height / 2 - tooltipHeight / 2, vh - tooltipHeight - 8)),
      left: Math.max(8, rect.left - TOOLTIP_W - GAP),
    };
  } else {
    // right
    const tooltipHeight = 220;
    tooltipStyle = {
      ...tooltipStyle,
      top: Math.max(8, Math.min(rect.top + rect.height / 2 - tooltipHeight / 2, vh - tooltipHeight - 8)),
      left: Math.min(rect.right + GAP, vw - TOOLTIP_W - 8),
    };
  }

  const divTransition = 'top 150ms ease, left 150ms ease, width 150ms ease, height 150ms ease';

  return (
    <>
      {/* Top */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: vw,
          height: Math.max(0, rect.top),
          backgroundColor: BACKDROP_COLOR,
          zIndex: OVERLAY_Z,
          transition: divTransition,
          pointerEvents: 'none',
        }}
      />
      {/* Bottom */}
      <div
        style={{
          position: 'fixed',
          top: rect.bottom,
          left: 0,
          width: vw,
          height: Math.max(0, vh - rect.bottom),
          backgroundColor: BACKDROP_COLOR,
          zIndex: OVERLAY_Z,
          transition: divTransition,
          pointerEvents: 'none',
        }}
      />
      {/* Left */}
      <div
        style={{
          position: 'fixed',
          top: rect.top,
          left: 0,
          width: Math.max(0, rect.left),
          height: Math.max(0, rect.height),
          backgroundColor: BACKDROP_COLOR,
          zIndex: OVERLAY_Z,
          transition: divTransition,
          pointerEvents: 'none',
        }}
      />
      {/* Right */}
      <div
        style={{
          position: 'fixed',
          top: rect.top,
          left: rect.right,
          width: Math.max(0, vw - rect.right),
          height: Math.max(0, rect.height),
          backgroundColor: BACKDROP_COLOR,
          zIndex: OVERLAY_Z,
          transition: divTransition,
          pointerEvents: 'none',
        }}
      />

      {/* Tooltip */}
      <div style={tooltipStyle}>
        <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 15, color: '#1f2937' }}>{title}</p>
        <p style={{ margin: '0', fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{body}</p>
        <div style={demoTipBox}>🎙 {demoTip}</div>
        <div
          style={{
            marginTop: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 12, color: '#9ca3af' }}>
            步驟 {spotlightIndex} / {totalSpotlightSteps}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {!isFirstSpotlight && (
              <button style={secondaryBtn} onClick={onPrev}>
                ← 上一步
              </button>
            )}
            <button style={primaryBtn} onClick={onNext}>
              下一步 →
            </button>
          </div>
        </div>
      </div>

      {/* Skip link */}
      <button style={skipBtnStyle} onClick={onSkip}>
        跳過導覽
      </button>
    </>
  );
}

// ─── TourOverlay ──────────────────────────────────────────────────────────────

export function TourOverlay() {
  const { isActive, currentStepIndex, nextStep, prevStep, skipTour } = useTour();
  const [rect, setRect] = useState<Rect>(emptyRect());

  const step = TOUR_STEPS[currentStepIndex];

  const updateRect = useCallback(() => {
    if (!step || step.isFullscreen || !step.targetDataTour) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.targetDataTour}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({
      top: r.top,
      left: r.left,
      bottom: r.bottom,
      right: r.right,
      width: r.width,
      height: r.height,
    });
  }, [step]);

  // Read DOM positions synchronously before paint
  useLayoutEffect(() => {
    if (!isActive || !step || step.isFullscreen) return;

    updateRect();

    // ResizeObserver for target element
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.targetDataTour}"]`);
    let ro: ResizeObserver | null = null;
    if (el) {
      ro = new ResizeObserver(() => updateRect());
      ro.observe(el);
    }

    // Also update on scroll/resize
    window.addEventListener('scroll', updateRect, { passive: true });
    window.addEventListener('resize', updateRect, { passive: true });

    return () => {
      ro?.disconnect();
      window.removeEventListener('scroll', updateRect);
      window.removeEventListener('resize', updateRect);
    };
  }, [isActive, step, updateRect]);

  if (!isActive || !step) return null;

  // Compute spotlight index (1-based, excluding the 2 fullscreen steps)
  // Fullscreen steps are index 0 and last index (9)
  const spotlightSteps = TOUR_STEPS.filter((s) => !s.isFullscreen);
  const totalSpotlightSteps = spotlightSteps.length;
  // spotlightIndex: 1 for currentStepIndex=1, up to 8 for currentStepIndex=8
  const spotlightIndex = currentStepIndex; // step 1..8 maps directly

  if (step.isFullscreen) {
    const isFirst = currentStepIndex === 0;
    const isLast = currentStepIndex === TOUR_STEPS.length - 1;
    return (
      <FullscreenCard
        stepIndex={currentStepIndex}
        title={step.title}
        body={step.body}
        demoTip={step.demoTip}
        isFirst={isFirst}
        isLast={isLast}
        onNext={nextStep}
        onSkip={skipTour}
      />
    );
  }

  // Spotlight step
  const targetEl = document.querySelector<HTMLElement>(`[data-tour="${step.targetDataTour}"]`);
  if (!targetEl) {
    // Target not yet in DOM — show minimal centered loading state
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: FULLSCREEN_BACKDROP_COLOR,
          zIndex: OVERLAY_Z,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ color: 'white', fontSize: 16 }}>載入中…</div>
        <button style={skipBtnStyle} onClick={skipTour}>
          跳過導覽
        </button>
      </div>
    );
  }

  const isFirstSpotlight = currentStepIndex === 1; // first spotlight step

  return (
    <SpotlightOverlay
      rect={rect}
      stepIndex={currentStepIndex}
      title={step.title}
      body={step.body}
      demoTip={step.demoTip}
      tooltipSide={step.tooltipSide ?? 'bottom'}
      isFirstSpotlight={isFirstSpotlight}
      totalSpotlightSteps={totalSpotlightSteps}
      spotlightIndex={spotlightIndex}
      onNext={nextStep}
      onPrev={prevStep}
      onSkip={skipTour}
    />
  );
}
