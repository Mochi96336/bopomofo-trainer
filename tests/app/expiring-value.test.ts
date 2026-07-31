import { describe, expect, it } from "vitest";
import {
  createExpiringValue,
  type TimerScheduler,
} from "../../src/app/expiring-value.js";

interface FakeClock extends TimerScheduler {
  /** Run the expiry scheduled at or before `ms` from now. */
  advance(ms: number): void;
  readonly pending: number;
  readonly cancelled: readonly number[];
}

function fakeClock(): FakeClock {
  let nextHandle = 1;
  const timers = new Map<number, { readonly at: number; readonly run: () => void }>();
  const cancelled: number[] = [];
  let now = 0;

  return {
    setTimeout(handler, ms) {
      const handle = nextHandle++;
      timers.set(handle, { at: now + ms, run: handler });
      return handle;
    },
    clearTimeout(handle) {
      cancelled.push(handle);
      timers.delete(handle);
    },
    advance(ms) {
      now += ms;
      for (const [handle, timer] of [...timers]) {
        if (timer.at <= now) {
          timers.delete(handle);
          timer.run();
        }
      }
    },
    get pending() {
      return timers.size;
    },
    get cancelled() {
      return cancelled;
    },
  };
}

describe("expiring value", () => {
  it("starts empty and schedules nothing", () => {
    const clock = fakeClock();
    const value = createExpiringValue<string>(clock, () => undefined);
    expect(value.value).toBeNull();
    expect(clock.pending).toBe(0);
  });

  it("holds the value and notifies once when set", () => {
    const clock = fakeClock();
    let changes = 0;
    const value = createExpiringValue<string>(clock, () => { changes += 1; });
    value.set("解鎖", 6000);
    expect(value.value).toBe("解鎖");
    expect(changes).toBe(1);
  });

  it("keeps the value until the delay elapses", () => {
    const clock = fakeClock();
    const value = createExpiringValue<string>(clock, () => undefined);
    value.set("解鎖", 6000);
    clock.advance(5999);
    expect(value.value).toBe("解鎖");
    clock.advance(1);
    expect(value.value).toBeNull();
  });

  it("notifies again when it expires", () => {
    const clock = fakeClock();
    let changes = 0;
    const value = createExpiringValue<string>(clock, () => { changes += 1; });
    value.set("解鎖", 6000);
    clock.advance(6000);
    expect(changes).toBe(2);
  });

  // The bug the hand-rolled version had to remember to avoid: without
  // cancelling, the first timer still fires and clears the second value.
  it("cancels the pending expiry when set again", () => {
    const clock = fakeClock();
    const value = createExpiringValue<string>(clock, () => undefined);
    value.set("第一", 6000);
    clock.advance(3000);
    value.set("第二", 6000);

    clock.advance(3000);
    expect(value.value).toBe("第二");

    clock.advance(3000);
    expect(value.value).toBeNull();
    expect(clock.cancelled).toHaveLength(1);
  });

  it("leaves at most one timer pending however often it is set", () => {
    const clock = fakeClock();
    const value = createExpiringValue<string>(clock, () => undefined);
    for (const message of ["a", "b", "c", "d"]) value.set(message, 6000);
    expect(clock.pending).toBe(1);
  });

  it("drops the value and cancels the expiry on clear", () => {
    const clock = fakeClock();
    const value = createExpiringValue<string>(clock, () => undefined);
    value.set("解鎖", 6000);
    value.clear();
    expect(value.value).toBeNull();
    expect(clock.pending).toBe(0);
  });

  // clear() must not notify: the callers that need a redraw already do one, and
  // a second would either double-render or fire during teardown.
  it("does not notify on clear", () => {
    const clock = fakeClock();
    let changes = 0;
    const value = createExpiringValue<string>(clock, () => { changes += 1; });
    value.set("解鎖", 6000);
    changes = 0;
    value.clear();
    expect(changes).toBe(0);
  });

  it("stays cleared after the original delay would have elapsed", () => {
    const clock = fakeClock();
    let changes = 0;
    const value = createExpiringValue<string>(clock, () => { changes += 1; });
    value.set("解鎖", 6000);
    value.clear();
    changes = 0;
    clock.advance(60_000);
    expect(value.value).toBeNull();
    expect(changes).toBe(0);
  });

  it("tolerates clearing when nothing is set", () => {
    const clock = fakeClock();
    const value = createExpiringValue<string>(clock, () => undefined);
    expect(() => { value.clear(); value.clear(); }).not.toThrow();
    expect(clock.pending).toBe(0);
  });

  // The unlock notice and the previous result run on different delays and must
  // not share a timer.
  it("keeps separate instances independent", () => {
    const clock = fakeClock();
    const notice = createExpiringValue<string>(clock, () => undefined);
    const result = createExpiringValue<number>(clock, () => undefined);
    notice.set("解鎖", 6000);
    result.set(42, 1400);

    clock.advance(1400);
    expect(result.value).toBeNull();
    expect(notice.value).toBe("解鎖");

    clock.advance(4600);
    expect(notice.value).toBeNull();
  });

  it("carries a non-string payload unchanged", () => {
    const clock = fakeClock();
    const record = { attempts: 10, errors: 1 };
    const value = createExpiringValue<typeof record>(clock, () => undefined);
    value.set(record, 1400);
    expect(value.value).toBe(record);
  });
});
