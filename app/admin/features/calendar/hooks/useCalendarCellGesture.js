import { useCallback, useEffect, useRef } from "react";

/**
 * Single source of truth for calendar-cell press gestures.
 * Owns:
 * - long-press timer lifecycle (300ms is passed from caller)
 * - document-level mouseup cancellation
 * - exactly-once finalization per press sequence (prevents races)
 *
 * IMPORTANT: This hook is intentionally UI-agnostic and does not know about orders.
 * Callers provide callbacks for click / long-press and for final cleanup.
 */
export function useCalendarCellGesture({ onFinalize }) {
  const onFinalizeRef = useRef(onFinalize);
  useEffect(() => {
    onFinalizeRef.current = onFinalize;
  }, [onFinalize]);

  const timerRef = useRef(null);
  const didLongPressRef = useRef(false);
  const finalizedRef = useRef(false);
  const activeRef = useRef(false);
  const longPressEnabledRef = useRef(false);

  const clearTimer = useCallback(() => {
    const t = timerRef.current;
    if (t) {
      clearTimeout(t);
      timerRef.current = null;
    }
  }, []);

  const finalize = useCallback(
    ({ skipResetFinalized = false } = {}) => {
      activeRef.current = false;
      longPressEnabledRef.current = false;
      if (onFinalizeRef.current) {
        onFinalizeRef.current();
      }
      didLongPressRef.current = false;
      if (!skipResetFinalized) {
        finalizedRef.current = false;
      }
    },
    []
  );

  const cancelFromDocument = useCallback(() => {
    if (!activeRef.current) return;
    if (finalizedRef.current) return;

    finalizedRef.current = true;
    clearTimer();
    // Never dispatch click from document-level cancellation.
    finalize({ skipResetFinalized: true });
  }, [clearTimer, finalize]);

  useEffect(() => {
    document.addEventListener("mouseup", cancelFromDocument);
    return () => {
      document.removeEventListener("mouseup", cancelFromDocument);
    };
  }, [cancelFromDocument]);

  const beginPress = useCallback(
    ({ enableLongPress, delayMs, onLongPress }) => {
      // Start a new press sequence; cancel any prior one.
      clearTimer();

      activeRef.current = true;
      finalizedRef.current = false;
      didLongPressRef.current = false;
      longPressEnabledRef.current = Boolean(enableLongPress);

      if (!enableLongPress) return;

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        didLongPressRef.current = true;
        // Do not finalize here; finalize happens on mouseup to mirror existing behavior.
        if (onLongPress) onLongPress();
      }, delayMs);
    },
    [clearTimer]
  );

  const endPress = useCallback(
    ({ onClick }) => {
      if (!activeRef.current) return;
      if (finalizedRef.current) return;

      finalizedRef.current = true;

      // If long-press already fired, never dispatch click.
      if (didLongPressRef.current) {
        finalize({ skipResetFinalized: true });
        return;
      }

      // If long-press was enabled and timer is still pending -> treat as click (short press).
      if (longPressEnabledRef.current) {
        const timerPending = Boolean(timerRef.current);
        clearTimer();
        if (timerPending && onClick) {
          onClick();
        }
        finalize({ skipResetFinalized: true });
        return;
      }

      // If long-press is not enabled (no timer), treat mouseup as click.
      if (onClick) onClick();
      finalize({ skipResetFinalized: true });
    },
    [clearTimer, finalize]
  );

  return {
    beginPress,
    endPress,
  };
}

