import { describe, expect, it } from "vitest";
import {
  clearLocalProgressHistory,
  loadLocalProgressHistory,
  LOCAL_PROGRESS_HISTORY_KEY,
  saveLocalProgressHistory,
} from "../../src/app/local-progress-history.js";
import type { StorageLike } from "../../src/app/local-progress.js";
import {
  createFreshProgressForEnvironment,
  createProductEnvironment,
} from "../../src/product/session.js";
import type { ProductProgress } from "../../src/product/types.js";
import { createEmptyProgressHistory } from "../../src/progress-history/update.js";
import { PROGRESS_HISTORY_SCHEMA_VERSION } from "../../src/progress-history/types.js";
import { PRODUCT_CATALOGS } from "../product/fixtures.js";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

const environment = createProductEnvironment(PRODUCT_CATALOGS);

function freshProgress(practiceRoundsCompleted = 0): ProductProgress {
  return {
    ...createFreshProgressForEnvironment(environment, "seed", "guided", "standard"),
    practiceRoundsCompleted,
  };
}

const storedToken = Object.keys(environment.practiceSupport.byToken)[0]!;

function storedHistory(lastCompletedRound: number): string {
  return JSON.stringify({
    schemaVersion: PROGRESS_HISTORY_SCHEMA_VERSION,
    mode: "guided",
    layoutId: "standard",
    lastCompletedRound,
    keys: {
      [storedToken]: {
        tokenId: storedToken,
        correctness: [
          { endingObservation: 8, completedRound: 1, attempts: 8, errors: 1, errorRatio: 0.125 },
        ],
        timing: [],
        partialCorrectness: { attempts: 2, errors: 0 },
        partialTiming: { samples: [] },
        totalObservations: 10,
        totalTimingSamples: 0,
      },
    },
    motor: {
      coordination: {},
      immediateTokens: {},
      immediateHands: {},
      sameHandRevisits: {},
      toneCommits: {},
    },
  });
}

describe("local progress history adapter", () => {
  it("saves, restores, and clears history", () => {
    const storage = new MemoryStorage();
    const progress = freshProgress();
    const history = createEmptyProgressHistory("guided", "standard");

    saveLocalProgressHistory(storage, history);
    expect(loadLocalProgressHistory(storage, progress, environment)).toEqual({
      history,
      recoveredFromInvalidState: false,
    });

    clearLocalProgressHistory(storage);
    expect(storage.getItem(LOCAL_PROGRESS_HISTORY_KEY)).toBeNull();
  });

  it("starts empty rather than failing when nothing is stored yet", () => {
    const storage = new MemoryStorage();
    const result = loadLocalProgressHistory(storage, freshProgress(), environment);

    expect(result.recoveredFromInvalidState).toBe(false);
    expect(result.history.lastCompletedRound).toBe(0);
    expect(result.history.keys).toEqual({});
  });

  it("restores a history that fits the progress it belongs to", () => {
    const storage = new MemoryStorage();
    storage.setItem(LOCAL_PROGRESS_HISTORY_KEY, storedHistory(3));
    const result = loadLocalProgressHistory(storage, freshProgress(4), environment);

    expect(result.recoveredFromInvalidState).toBe(false);
    expect(result.history.lastCompletedRound).toBe(3);
    expect(result.history.keys[storedToken]?.correctness).toHaveLength(1);
  });

  it("discards a history that claims more rounds than the progress it accompanies", () => {
    const storage = new MemoryStorage();
    storage.setItem(LOCAL_PROGRESS_HISTORY_KEY, storedHistory(9));
    const result = loadLocalProgressHistory(storage, freshProgress(2), environment);

    expect(result.recoveredFromInvalidState).toBe(true);
    expect(result.history.lastCompletedRound).toBe(0);
    expect(result.history.keys).toEqual({});
  });

  it("discards an unreadable payload instead of surfacing it", () => {
    const storage = new MemoryStorage();
    storage.setItem(LOCAL_PROGRESS_HISTORY_KEY, "{ not json");
    const result = loadLocalProgressHistory(storage, freshProgress(2), environment);

    expect(result.recoveredFromInvalidState).toBe(true);
    expect(result.history.keys).toEqual({});
  });
});
