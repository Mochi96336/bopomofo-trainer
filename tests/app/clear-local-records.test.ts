import { describe, expect, it } from "vitest";
import { clearLocalRecords } from "../../src/app/clear-local-records.js";
import {
  LOCAL_PERSISTENCE_JOURNAL_KEY,
  LOCAL_PILOT_HISTORY_KEY,
  LOCAL_PROGRESS_HISTORY_KEY,
  LOCAL_PROGRESS_KEY,
  type StorageLike,
} from "../../src/app/persistence-transaction.js";

class MemoryStorage implements StorageLike {
  protected readonly values = new Map<string, string>();
  constructor(entries: Readonly<Record<string, string>> = {}) {
    for (const [key, value] of Object.entries(entries)) this.values.set(key, value);
  }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
  get keys(): readonly string[] { return [...this.values.keys()]; }
}

/** Storage that is present but refuses every write, as a blocked browser does. */
class BlockedStorage implements StorageLike {
  getItem(): string | null { throw new Error("blocked"); }
  setItem(): void { throw new Error("blocked"); }
  removeItem(): void { throw new Error("blocked"); }
}

/** Storage that accepts everything until one key is removed. */
class FailsOnRemoval extends MemoryStorage {
  constructor(private readonly failingKey: string, entries: Readonly<Record<string, string>>) {
    super(entries);
  }
  override removeItem(key: string): void {
    if (key === this.failingKey) throw new Error("blocked");
    super.removeItem(key);
  }
}

const STORED = {
  [LOCAL_PROGRESS_KEY]: "progress",
  [LOCAL_PILOT_HISTORY_KEY]: "pilot",
  [LOCAL_PROGRESS_HISTORY_KEY]: "trend",
} as const;

describe("clearing local records", () => {
  it("removes progress, Pilot history and trend history together", () => {
    const storage = new MemoryStorage(STORED);

    expect(clearLocalRecords(storage)).toEqual({ cleared: true, storageWarning: "" });
    expect(storage.keys).toEqual([]);
  });

  it("leaves no journal behind when the batch completes", () => {
    const storage = new MemoryStorage(STORED);
    clearLocalRecords(storage);
    expect(storage.getItem(LOCAL_PERSISTENCE_JOURNAL_KEY)).toBeNull();
  });

  it("reports a refusal without claiming the page failed to restart", () => {
    const result = clearLocalRecords(new BlockedStorage());

    expect(result.cleared).toBe(false);
    expect(result.storageWarning).not.toBe("");
    expect(result.storageWarning).toContain("本頁已重新開始");
  });

  // The three removals are one journalled batch, and the ordering is what makes
  // a partial failure recoverable: progress opens the journal, the trend history
  // commits it. A removal that fails in the middle therefore leaves the journal
  // in place, and the next boot rolls the whole batch back rather than starting
  // from a store that lost its progress but kept a history belonging to it.
  it("leaves the journal in place when a removal fails partway", () => {
    const storage = new FailsOnRemoval(LOCAL_PILOT_HISTORY_KEY, STORED);

    expect(clearLocalRecords(storage).cleared).toBe(false);
    expect(storage.getItem(LOCAL_PROGRESS_KEY)).toBeNull();
    expect(storage.getItem(LOCAL_PILOT_HISTORY_KEY)).toBe("pilot");
    expect(storage.getItem(LOCAL_PERSISTENCE_JOURNAL_KEY)).not.toBeNull();
  });

  it("clears a store that already held nothing", () => {
    const storage = new MemoryStorage();

    expect(clearLocalRecords(storage)).toEqual({ cleared: true, storageWarning: "" });
    expect(storage.keys).toEqual([]);
  });
});
