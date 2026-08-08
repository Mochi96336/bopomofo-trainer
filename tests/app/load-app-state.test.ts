import { describe, expect, it } from "vitest";
import { loadAppState } from "../../src/app/load-app-state.js";
import type { StorageLike } from "../../src/app/local-progress.js";
import { LOCAL_PROGRESS_KEY } from "../../src/app/persistence-transaction.js";
import { saveLocalProductProgress } from "../../src/app/local-progress.js";
import {
  createFreshProgressForEnvironment,
  createProductEnvironment,
} from "../../src/product/session.js";
import { PRODUCT_PROGRESS_SCHEMA_VERSION } from "../../src/product/types.js";
import { PRODUCT_CATALOGS } from "../product/fixtures.js";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

/** Storage that is present but refuses every read, as a blocked browser does. */
class BlockedStorage implements StorageLike {
  getItem(): string | null { throw new Error("blocked"); }
  setItem(): void { throw new Error("blocked"); }
  removeItem(): void { throw new Error("blocked"); }
}

const environment = createProductEnvironment(PRODUCT_CATALOGS);

function load(storage: StorageLike, seed = "seed") {
  return loadAppState({
    storage,
    environment,
    mode: "guided",
    layoutId: "standard",
    newSeed: () => seed,
  });
}

describe("app boot state", () => {
  it("starts a fresh generation when nothing is stored", () => {
    const boot = load(new MemoryStorage());
    expect(boot.loadedExistingProgress).toBe(false);
    expect(boot.progressLoadStatus).toBe("empty");
    expect(boot.storageWarning).toBe("");
    expect(boot.progress.practiceRoundsCompleted).toBe(0);
  });

  it("seeds the fresh generation so the session is reproducible", () => {
    expect(load(new MemoryStorage(), "seed-a").progress.seed).toBe("seed-a");
    expect(load(new MemoryStorage(), "seed-b").progress.seed).toBe("seed-b");
  });

  it("reads progress back and reports a normal load", () => {
    const storage = new MemoryStorage();
    saveLocalProductProgress(
      storage,
      createFreshProgressForEnvironment(environment, "stored", "guided", "standard"),
    );

    const boot = load(storage);
    expect(boot.loadedExistingProgress).toBe(true);
    expect(boot.progressLoadStatus).toBe("loaded");
    expect(boot.progress.seed).toBe("stored");
    expect(boot.storageWarning).toBe("");
  });

  it("reports a successful legacy measurement-epoch migration without calling it invalid recovery", () => {
    const storage = new MemoryStorage();
    const stored = JSON.parse(JSON.stringify(
      createFreshProgressForEnvironment(environment, "legacy", "guided", "standard"),
    )) as Record<string, unknown>;
    stored.schemaVersion = PRODUCT_PROGRESS_SCHEMA_VERSION - 1;
    delete stored.measurementEpoch;
    storage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(stored));

    const boot = load(storage);
    expect(boot.progressLoadStatus).toBe("migrated");
    expect(boot.loadedExistingProgress).toBe(true);
    expect(boot.progress.seed).toBe("legacy");
    expect(boot.progress.practiceRoundsCompleted).toBe(0);
    expect(boot.storageWarning).toBe("");
  });

  // Storage that can be read but holds something invalid is a different failure
  // from storage that cannot be read at all: this one is recoverable, so it
  // restarts from a fresh generation without pretending a migration succeeded.
  it("labels unreadable content invalid without raising a storage warning", () => {
    const storage = new MemoryStorage();
    storage.setItem(LOCAL_PROGRESS_KEY, "{ not json");

    const boot = load(storage);
    expect(boot.progressLoadStatus).toBe("invalid");
    expect(boot.loadedExistingProgress).toBe(false);
    expect(boot.storageWarning).toBe("");
    expect(boot.progress.practiceRoundsCompleted).toBe(0);
  });

  // Fails closed: progress whose counters disagree with the rest of the record
  // is discarded rather than trusted, so a hand-edited store cannot inflate
  // completed rounds.
  it("rejects progress that is internally inconsistent", () => {
    const storage = new MemoryStorage();
    const forged = {
      ...createFreshProgressForEnvironment(environment, "stored", "guided", "standard"),
      practiceRoundsCompleted: 7,
    };
    storage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(forged));

    const boot = load(storage);
    expect(boot.progressLoadStatus).toBe("invalid");
    expect(boot.progress.practiceRoundsCompleted).toBe(0);
  });

  // Practice has to start even when nothing can be read: an unusable session is
  // a worse outcome than a lost one.
  it("still produces a usable session when storage is blocked outright", () => {
    const boot = load(new BlockedStorage());
    expect(boot.progress.practiceRoundsCompleted).toBe(0);
    expect(boot.loadedExistingProgress).toBe(false);
    expect(boot.progressLoadStatus).toBe("unavailable");
    expect(boot.pilotHistory).toBeDefined();
    expect(boot.progressHistory).toBeDefined();
  });

  it("warns when storage is blocked", () => {
    expect(load(new BlockedStorage()).storageWarning).not.toBe("");
  });

  it("derives Pilot history from progress rather than leaving it empty", () => {
    const storage = new MemoryStorage();
    saveLocalProductProgress(
      storage,
      createFreshProgressForEnvironment(environment, "stored", "guided", "standard"),
    );
    expect(load(storage).pilotHistory).toBeDefined();
  });

  it("matches the stored progress mode and layout in the empty history", () => {
    const boot = load(new MemoryStorage());
    expect(boot.progressHistory.mode).toBe("guided");
    expect(boot.progressHistory.layoutId).toBe("standard");
  });

  it("does not report a recovery when nothing needed recovering", () => {
    const boot = load(new MemoryStorage());
    expect(boot.progressLoadStatus).toBe("empty");
    expect(boot.recoveredPilotHistory).toBe(false);
  });

  it("is deterministic for the same storage and seed", () => {
    const storage = new MemoryStorage();
    saveLocalProductProgress(
      storage,
      createFreshProgressForEnvironment(environment, "stored", "guided", "standard"),
    );
    expect(JSON.stringify(load(storage).progress)).toBe(JSON.stringify(load(storage).progress));
  });
});
