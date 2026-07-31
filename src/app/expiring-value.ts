/**
 * A value that retires itself after a delay.
 *
 * Two places in the practice shell show something that announces what just
 * happened rather than describing a lasting condition: the commonness unlock
 * notice and the previous round's result. Both were hand-rolled from a nullable
 * value plus a nullable timer handle, and both had to remember to cancel the
 * pending timer before setting a new value -- otherwise the earlier timer fires
 * later and clears a value it never set.
 *
 * The scheduler is a parameter so that behavior is assertable. Nothing here
 * touches the DOM; the owner passes a callback that re-renders whatever surface
 * displays the value.
 */

export interface TimerScheduler {
  setTimeout(handler: () => void, ms: number): number;
  clearTimeout(handle: number): void;
}

export interface ExpiringValue<T> {
  /** The current value, or `null` once it has been cleared or has expired. */
  readonly value: T | null;
  /**
   * Replace the value and restart the delay. Any pending expiry is cancelled
   * first, so the surviving timer always belongs to the value on display.
   * Notifies once, before the new timer is scheduled.
   */
  set(next: T, ms: number): void;
  /**
   * Drop the value and cancel any pending expiry. Does not notify: the callers
   * that need a redraw already do one, and the callers that are mid-teardown
   * must not trigger another.
   */
  clear(): void;
}

export function createExpiringValue<T>(
  scheduler: TimerScheduler,
  onChange: () => void,
): ExpiringValue<T> {
  let current: T | null = null;
  let timer: number | null = null;

  const cancel = (): void => {
    if (timer !== null) scheduler.clearTimeout(timer);
    timer = null;
  };

  return {
    get value(): T | null {
      return current;
    },
    set(next: T, ms: number): void {
      cancel();
      current = next;
      onChange();
      timer = scheduler.setTimeout(() => {
        current = null;
        timer = null;
        onChange();
      }, ms);
    },
    clear(): void {
      current = null;
      cancel();
    },
  };
}
