import { useEffect, useRef, useState } from "react";

/**
 * Returns whether the user is considered "active" (not idle).
 * Polling should only run while this returns true.
 *
 * - Starts a countdown on mount.
 * - Any mouse movement, key press, or click resets the countdown.
 * - After `idleAfterMs` of inactivity the hook returns false (idle).
 * - Becomes active again as soon as the user moves/types/clicks.
 */
export function useIdlePolling(idleAfterMs = 5 * 60 * 1000): boolean {
  const [isActive, setIsActive] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const resetTimer = () => {
      setIsActive(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setIsActive(false), idleAfterMs);
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));

    // Start the initial countdown
    resetTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [idleAfterMs]);

  return isActive;
}
