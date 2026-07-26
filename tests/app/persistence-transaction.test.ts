import { describe, expect, it } from "vitest";
import {
  beginLocalPersistenceTransaction,
  commitLocalPersistenceTransaction,
  LOCAL_PERSISTENCE_JOURNAL_KEY,
  LOCAL_PILOT_HISTORY_KEY,
  LOCAL_PROGRESS_HISTORY_KEY,
  LOCAL_PROGRESS_KEY,
  recoverLocalPersistenceTransaction,
  type StorageLike,
} from "../../src/app/persistence-transaction.js";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function seedCommittedState(storage: StorageLike, prefix: string): void {
  storage.setItem(LOCAL_PROGRESS_KEY, `${prefix}-progress`);
  storage.setItem(LOCAL_PILOT_HISTORY_KEY, `${prefix}-pilot`);
  storage.setItem(LOCAL_PROGRESS_HISTORY_KEY, `${prefix}-trends`);
}

function expectState(storage: StorageLike, prefix: string): void {
  expect(storage.getItem(LOCAL_PROGRESS_KEY)).toBe(`${prefix}-progress`);
  expect(storage.getItem(LOCAL_PILOT_HISTORY_KEY)).toBe(`${prefix}-pilot`);
  expect(storage.getItem(LOCAL_PROGRESS_HISTORY_KEY)).toBe(`${prefix}-trends`);
}

describe("local persistence transaction journal", () => {
  it("keeps a fully committed three-key write", () => {
    const storage = new MemoryStorage();
    seedCommittedState(storage, "old");

    beginLocalPersistenceTransaction(storage);
    seedCommittedState(storage, "new");
    commitLocalPersistenceTransaction(storage);

    expect(recoverLocalPersistenceTransaction(storage)).toBe(false);
    expectState(storage, "new");
    expect(storage.getItem(LOCAL_PERSISTENCE_JOURNAL_KEY)).toBeNull();
  });

  it("rolls an interrupted write back to the previous complete generation", () => {
    const storage = new MemoryStorage();
    seedCommittedState(storage, "old");

    beginLocalPersistenceTransaction(storage);
    storage.setItem(LOCAL_PROGRESS_KEY, "new-progress");
    storage.setItem(LOCAL_PILOT_HISTORY_KEY, "new-pilot");

    expect(recoverLocalPersistenceTransaction(storage)).toBe(true);
    expectState(storage, "old");
    expect(storage.getItem(LOCAL_PERSISTENCE_JOURNAL_KEY)).toBeNull();
  });

  it("rolls an interrupted clear back instead of leaving mixed records", () => {
    const storage = new MemoryStorage();
    seedCommittedState(storage, "old");

    beginLocalPersistenceTransaction(storage);
    storage.removeItem(LOCAL_PROGRESS_KEY);
    storage.removeItem(LOCAL_PILOT_HISTORY_KEY);

    expect(recoverLocalPersistenceTransaction(storage)).toBe(true);
    expectState(storage, "old");
  });

  it("preserves the first snapshot across retries until a batch commits", () => {
    const storage = new MemoryStorage();
    seedCommittedState(storage, "old");

    beginLocalPersistenceTransaction(storage);
    storage.setItem(LOCAL_PROGRESS_KEY, "partial-progress");
    beginLocalPersistenceTransaction(storage);
    seedCommittedState(storage, "new");

    expect(recoverLocalPersistenceTransaction(storage)).toBe(true);
    expectState(storage, "old");
  });

  it("drops a malformed journal without rewriting otherwise readable data", () => {
    const storage = new MemoryStorage();
    seedCommittedState(storage, "current");
    storage.setItem(LOCAL_PERSISTENCE_JOURNAL_KEY, "not-json");

    expect(recoverLocalPersistenceTransaction(storage)).toBe(false);
    expectState(storage, "current");
    expect(storage.getItem(LOCAL_PERSISTENCE_JOURNAL_KEY)).toBeNull();
  });
});
