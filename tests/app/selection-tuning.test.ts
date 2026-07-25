import { afterEach, describe, expect, it } from "vitest";
import type { StorageLike } from "../../src/app/local-progress.js";
import {
  currentSelectionTuning,
  DEFAULT_SELECTION_TUNING,
  loadSelectionTuning,
  LOCAL_SELECTION_TUNING_KEY,
  parseSelectionTuning,
  saveSelectionTuning,
} from "../../src/app/selection-tuning.js";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

afterEach(() => {
  saveSelectionTuning(new MemoryStorage(), DEFAULT_SELECTION_TUNING);
});

describe("selection tuning live source", () => {
  it("tracks loaded and saved tuning in memory", () => {
    const storage = new MemoryStorage();
    expect(loadSelectionTuning(storage)).toEqual(DEFAULT_SELECTION_TUNING);
    expect(currentSelectionTuning()).toBe(DEFAULT_SELECTION_TUNING);

    const tuning = {
      errorInfluence: 1.5,
      timingInfluence: 0.5,
      rarityTiers: [1, 2],
    } as const;
    saveSelectionTuning(storage, tuning);
    expect(currentSelectionTuning()).toBe(tuning);
    expect(storage.getItem(LOCAL_SELECTION_TUNING_KEY)).toBe(JSON.stringify(tuning));
    expect(loadSelectionTuning(storage)).toEqual(tuning);
  });

  it("updates the live value even when persistence is blocked", () => {
    const tuning = {
      errorInfluence: 2,
      timingInfluence: 0.75,
      rarityTiers: [1, 3, 4],
    } as const;
    const blockedStorage: StorageLike = {
      getItem: () => null,
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => undefined,
    };
    expect(() => saveSelectionTuning(blockedStorage, tuning)).toThrow(/blocked/);
    expect(currentSelectionTuning()).toBe(tuning);
  });
});

describe("rarity level preference", () => {
  it("rejects a blob with no level list", () => {
    expect(parseSelectionTuning('{"errorInfluence":1,"timingInfluence":1}')).toBeNull();
  });

  it("keeps stored levels in the display order regardless of how they were written", () => {
    expect(parseSelectionTuning(
      '{"errorInfluence":1,"timingInfluence":1,"rarityTiers":[4,1]}',
    )?.rarityTiers).toEqual([1, 4]);
  });

  it("rejects an empty, duplicated or out-of-range level list", () => {
    for (const tiers of ["[]", "[1,1]", "[0]", "[5]", "[2,\"3\"]", "3"]) {
      expect(parseSelectionTuning(
        `{"errorInfluence":1,"timingInfluence":1,"rarityTiers":${tiers}}`,
      )).toBeNull();
    }
  });
});
