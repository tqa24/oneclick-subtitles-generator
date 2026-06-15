import { useState, useRef, useCallback, useEffect } from 'react';

// Default draggable UI positions (percentages within videoRect)
const defaultUiPos = {
  aspect: { xPct: 50, yPct: 2 },
  toggle: { xPct: 96, yPct: 2 },
  actions: { xPct: 50, yPct: 96 },
};

/**
 * Owns the floating-UI positioning for the crop overlay's draggable controls
 * (aspect buttons, toggle, action buttons) and the drag interaction that moves them.
 *
 * @param {Object} params
 * @param {boolean} params.isEnabled - whether crop mode is active.
 * @param {Object|null} params.videoRect - rect of the tracked video, used to seed positions.
 * @param {Object} params.cropAreaRef - ref to the crop overlay element (shared with parent).
 *
 * Returns { uiPos, uiDrag, resetUiPositions, onUiMouseDown, suppressClickIfDragged, didDragRef }.
 */
export default function useUIPositioning({ isEnabled, videoRect, cropAreaRef }) {
  const [uiPos, setUiPos] = useState(defaultUiPos);
  const uiInitializedRef = useRef(false);
  const didDragRef = useRef(false);
  const [uiDrag, setUiDrag] = useState(null);

  const resetUiPositions = useCallback(() => {
    setUiPos(defaultUiPos);
    uiInitializedRef.current = false;
  }, []);

  // Dragging for floating UI during crop mode
  const onUiMouseDown = (e, kind) => {
    if (!isEnabled) return;
    if (!cropAreaRef.current) return;
    // Do not start group-dragging when interacting with elements marked as no-ui-drag (e.g., blur slider)
    const tgt = e.target;
    if (tgt && typeof tgt.closest === 'function' && tgt.closest('.no-ui-drag')) {
      return;
    }
    didDragRef.current = false;
    setUiDrag({
      kind,
      startX: e.clientX,
      startY: e.clientY,
      startPos: { ...(uiPos[kind] || { xPct: 50, yPct: 50 }) }
    });
  };

  useEffect(() => {
    if (!uiDrag) return;
    const onMove = (e) => {
      if (!cropAreaRef.current) return;
      const rect = cropAreaRef.current.getBoundingClientRect();
      const dxPx = (e.clientX - uiDrag.startX);
      const dyPx = (e.clientY - uiDrag.startY);
      const moved = Math.abs(dxPx) > 3 || Math.abs(dyPx) > 3;
      if (moved) didDragRef.current = true;
      const dxPct = rect.width ? (dxPx / rect.width) * 100 : 0;
      const dyPct = rect.height ? (dyPx / rect.height) * 100 : 0;
      setUiPos((prev) => {
        const start = uiDrag.startPos || prev[uiDrag.kind] || { xPct: 50, yPct: 50 };
        const next = {
          ...prev,
          [uiDrag.kind]: {
            xPct: Math.max(0, Math.min(100, start.xPct + dxPct)),
            yPct: Math.max(0, Math.min(100, start.yPct + dyPct)),
          }
        };
        return next;
      });
    };
    const onUp = () => setUiDrag(null);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp, { once: true });
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [uiDrag, cropAreaRef]);

  const suppressClickIfDragged = (e) => {
    if (didDragRef.current) {
      e.preventDefault();
      e.stopPropagation();
      didDragRef.current = false;
    }
  };

  // Initialize default draggable positions to match old fixed positions when overlay opens
  useEffect(() => {
    if (isEnabled && videoRect && !uiInitializedRef.current) {
      const vw = videoRect.width || 1;
      const vh = videoRect.height || 1;
      setUiPos({
        aspect: { xPct: 50, yPct: (14 / vh) * 100 }, // top:14px, centered
        toggle: { xPct: ((vw - 10) / vw) * 100, yPct: (10 / vh) * 100 }, // right:10px, top:10px
        actions: { xPct: 50, yPct: ((vh - 20) / vh) * 100 } // bottom:20px, centered
      });
      uiInitializedRef.current = true;
    }
  }, [isEnabled, videoRect]);

  return {
    uiPos,
    uiDrag,
    resetUiPositions,
    onUiMouseDown,
    suppressClickIfDragged,
    didDragRef,
  };
}
