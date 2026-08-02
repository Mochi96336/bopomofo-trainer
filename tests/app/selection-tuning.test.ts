import { describe, expect, it } from "vitest";
import type { StorageLike } from "../../src/app/local-progress.js";
import {
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

// This module used to keep a module-level copy of the last loaded or saved
// tuning for the diagnostics layer to read. Diagnostics is handed the running
// shell's own value now, so all that is left here is the storage round trip.
describe("selection tuning storage", () => {
  it("returns the default when nothing is stored, and reads back what was saved", () => {
    const storage = new MemoryStorage();
    expect(loadSelectionTuning(storage)).toEqual(DEFAULT_SELECTION_TUNING);

    const tuning = {
      errorInfluence: 1.5,
      timingInfluence: 0.5,
      rarityTiers: [1, 2],
    } as const;
    saveSelectionTuning(storage, tuning);
    expect(storage.getItem(LOCAL_SELECTION_TUNING_KEY)).toBe(JSON.stringify(tuning));
    expect(loadSelectionTuning(storage)).toEqual(tuning);
  });

  it("reports a blocked write rather than swallowing it", () => {
    const blockedStorage: StorageLike = {
      getItem: () => null,
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => undefined,
    };
    expect(() => saveSelectionTuning(blockedStorage, DEFAULT_SELECTION_TUNING))
      .toThrow(/blocked/);
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
