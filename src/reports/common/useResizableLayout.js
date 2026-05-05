// src/reports/common/useResizableLayout.js

import { useState, useCallback, useRef, useEffect } from 'react';

const STORAGE_KEY = 'reportLayoutRatio';

export default function useResizableLayout(defaultRatio = 0.55) {
  const saved = parseFloat(localStorage.getItem(STORAGE_KEY));
  const initial = !isNaN(saved) ? saved : defaultRatio;

  const [ratio, setRatioState] = useState(initial);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startRatio = useRef(initial);
  const containerRef = useRef(null);

  const setRatio = useCallback((val) => {
    const clamped = Math.max(0.1, Math.min(0.9, val));
    setRatioState(clamped);
    localStorage.setItem(STORAGE_KEY, clamped);
  }, []);

  const onDividerMouseDown = useCallback(
    (e) => {
      dragging.current = true;
      startY.current = e.clientY;
      startRatio.current = ratio;
      e.preventDefault();
    },
    [ratio],
  );

  const onDividerTouchStart = useCallback(
    (e) => {
      dragging.current = true;
      startY.current = e.touches[0].clientY;
      startRatio.current = ratio;
    },
    [ratio],
  );

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current || !containerRef.current) return;
      const totalH = containerRef.current.getBoundingClientRect().height;
      if (totalH === 0) return;
      const dy = e.clientY - startY.current;
      setRatio(startRatio.current + dy / totalH);
    };

    const onTouchMove = (e) => {
      if (!dragging.current || !containerRef.current) return;
      const totalH = containerRef.current.getBoundingClientRect().height;
      if (totalH === 0) return;
      const dy = e.touches[0].clientY - startY.current;
      setRatio(startRatio.current + dy / totalH);
    };

    const onEnd = () => {
      dragging.current = false;
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onEnd);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onEnd);
    };
  }, [setRatio]);

  return {
    ratio,
    setRatio,
    containerRef,
    dividerProps: {
      onMouseDown: onDividerMouseDown,
      onTouchStart: onDividerTouchStart,
    },
  };
}
