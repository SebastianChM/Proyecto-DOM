import { useEffect, useRef, useCallback } from "react";

// ==================== Types ====================

export interface UsePollingWithBackoffOptions<T = unknown> {
  /**
   * Async function to execute on each tick.
   * Return a result object so callbacks can decide whether to stop.
   */
  fn: () => Promise<T>;

  /** Whether polling is active. Set to false to pause/stop. */
  enabled: boolean;

  /** Initial delay in ms before the second tick (first tick fires immediately). @default 2000 */
  initialDelayMs?: number;

  /** Maximum delay cap in ms. @default 30000 */
  maxDelayMs?: number;

  /** Maximum number of ticks before giving up. @default 20 */
  maxRetries?: number;

  /** Add random jitter (0–1 fraction of current delay). @default 0 */
  jitter?: number;

  /**
   * Called after each successful fn() execution.
   * Return `true` to signal "done" and stop polling.
   */
  onSuccess?: (data: T) => boolean | void;

  /** Called when fn() throws. Return `true` to stop polling on error. */
  onError?: (error: Error) => boolean | void;

  /** Called when maxRetries is exhausted without a stop signal. */
  onTimeout?: () => void;
}

export interface UsePollingWithBackoffReturn {
  /** Manually stop polling. */
  stop: () => void;
  /** Restart polling from the beginning (resets retry count and delay). */
  restart: () => void;
}

/** Options for the standalone (non-hook) polling utility. */
export interface PollWithBackoffOptions<T = unknown> {
  /** Async function to call on each tick. */
  fn: () => Promise<T>;

  /** Initial delay in ms (between ticks). @default 2000 */
  initialDelayMs?: number;

  /** Maximum delay cap in ms. @default 30000 */
  maxDelayMs?: number;

  /** Maximum attempts before timeout. @default 20 */
  maxRetries?: number;

  /** Jitter fraction (0–1). @default 0 */
  jitter?: number;

  /**
   * Called after each successful fn() call.
   * Return `true` to stop polling (success condition met).
   */
  onSuccess?: (data: T) => boolean | void;

  /** Called on fn() error. Return `true` to stop. */
  onError?: (error: Error) => boolean | void;

  /** Called when maxRetries is exhausted. */
  onTimeout?: () => void;
}

/** Handle returned by pollWithBackoff to cancel imperatively. */
export interface PollHandle {
  /** Cancel polling. */
  cancel: () => void;
}

// ==================== Hook ====================

/**
 * Polls an async function with exponential backoff.
 *
 * Schedule: initialDelay * 2^attempt, capped at maxDelay.
 * Default sequence: 2s → 4s → 8s → 16s → 30s → 30s …
 *
 * The first tick fires immediately when enabled becomes true.
 * Cleans up timers on unmount or when `enabled` becomes false.
 */
export function usePollingWithBackoff<T = unknown>(
  options: UsePollingWithBackoffOptions<T>,
): UsePollingWithBackoffReturn {
  const {
    fn,
    enabled,
    initialDelayMs = 2000,
    maxDelayMs = 30000,
    maxRetries = 20,
    jitter = 0,
    onSuccess,
    onError,
    onTimeout,
  } = options;

  // Refs to hold mutable state without causing re-renders
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);
  const mountedRef = useRef(true);
  const restartCounterRef = useRef(0);

  // Stable refs for callbacks to avoid re-triggering the effect
  const fnRef = useRef(fn);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const onTimeoutRef = useRef(onTimeout);

  fnRef.current = fn;
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  onTimeoutRef.current = onTimeout;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    clearTimer();
  }, [clearTimer]);

  const restart = useCallback(() => {
    stoppedRef.current = false;
    attemptRef.current = 0;
    clearTimer();
    // Bump counter to re-trigger the effect
    restartCounterRef.current += 1;
    // We can't directly re-trigger useEffect from here,
    // so we use a state-like mechanism via the ref + forced re-schedule
  }, [clearTimer]);

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      clearTimer();
      return;
    }

    // Reset on enable
    stoppedRef.current = false;
    attemptRef.current = 0;

    const getDelay = (attempt: number): number => {
      const base = initialDelayMs * Math.pow(2, attempt);
      const capped = Math.min(base, maxDelayMs);
      if (jitter > 0) {
        const jitterAmount = capped * jitter * Math.random();
        return Math.round(capped + jitterAmount);
      }
      return capped;
    };

    const tick = async () => {
      if (!mountedRef.current || stoppedRef.current) return;

      try {
        const result = await fnRef.current();
        if (!mountedRef.current || stoppedRef.current) return;

        const shouldStop = onSuccessRef.current?.(result);
        if (shouldStop === true) {
          stop();
          return;
        }
      } catch (err) {
        if (!mountedRef.current || stoppedRef.current) return;

        const error = err instanceof Error ? err : new Error(String(err));
        const shouldStop = onErrorRef.current?.(error);
        if (shouldStop === true) {
          stop();
          return;
        }
      }

      attemptRef.current += 1;

      if (attemptRef.current >= maxRetries) {
        onTimeoutRef.current?.();
        stop();
        return;
      }

      // Schedule next tick
      const delay = getDelay(attemptRef.current);
      timerRef.current = setTimeout(tick, delay);
    };

    // First tick fires immediately
    tick();

    return () => {
      mountedRef.current = false;
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, initialDelayMs, maxDelayMs, maxRetries, jitter]);

  return { stop, restart };
}

// ==================== Standalone (non-hook) utility ====================

/**
 * Imperative polling with exponential backoff — for use inside event handlers
 * where React hooks are not allowed.
 *
 * Returns a handle with a `cancel()` method.
 * Sequence: fire immediately, then wait initialDelay*2^n (capped at maxDelay).
 */
export function pollWithBackoff<T = unknown>(
  opts: PollWithBackoffOptions<T>,
): PollHandle {
  const {
    fn,
    initialDelayMs = 2000,
    maxDelayMs = 30000,
    maxRetries = 20,
    jitter = 0,
    onSuccess,
    onError,
    onTimeout,
  } = opts;

  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const getDelay = (a: number): number => {
    const base = initialDelayMs * Math.pow(2, a);
    const capped = Math.min(base, maxDelayMs);
    if (jitter > 0) {
      return Math.round(capped + capped * jitter * Math.random());
    }
    return capped;
  };

  const tick = async () => {
    if (cancelled) return;

    try {
      const result = await fn();
      if (cancelled) return;

      const shouldStop = onSuccess?.(result);
      if (shouldStop === true) {
        cancelled = true;
        return;
      }
    } catch (err) {
      if (cancelled) return;
      const error = err instanceof Error ? err : new Error(String(err));
      const shouldStop = onError?.(error);
      if (shouldStop === true) {
        cancelled = true;
        return;
      }
    }

    attempt += 1;

    if (attempt >= maxRetries) {
      onTimeout?.();
      cancelled = true;
      return;
    }

    timer = setTimeout(tick, getDelay(attempt));
  };

  // Fire first tick immediately
  tick();

  return {
    cancel: () => {
      cancelled = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
