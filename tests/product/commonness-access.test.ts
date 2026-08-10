import { describe, expect, it } from "vitest";
import { COMMONNESS_TIERS, type CommonnessTier } from "../../src/commonness/tiers.js";
import type { CatalogCommonnessBase } from "../../src/core/model.js";
import {
  MEASUREMENT_V2_POLICY_VERSION,
  type BindingAggregateV2,
  type MeasurementSummaryV2,
} from "../../src/measurement-v2/aggregate.js";
import {
  catalogsForCommonnessTiers,
  COMMONNESS_UNLOCK_POLICY,
  effectiveCommonnessTiers,
  nextCommonnessUnlock,
  practisedKeyCount,
  requiredPractisedKeys,
  unlockedCommonnessTiers,
} from "../../src/product/commonness-access.js";
import { PRODUCT_CATALOGS } from "./fixtures.js";

function binding(tokenId: string, attempts: number, errors: number): BindingAggregateV2 {
  return {
    scope: { mode: "guided", layoutId: "standard", tokenId },
    attempts,
    errors,
    timingSamples: 0,
    currentTimeToTypeMs: null,
    bestTimeToTypeMs: null,
  };
}

function commonnessBase(selectionWeight: number): CatalogCommonnessBase {
  return {
    modelVersion: "test",
    sourceId: "test",
    sourceVersion: "test",
    sourceRowId: "test",
    spokenPerMillion: null,
    writtenPerMillion: null,
    spokenStrength: null,
    writtenStrength: null,
    score: selectionWeight,
    selectionWeight,
    confidence: "reviewed",
    reasons: [],
  };
}

function measurements(practised: number, cleanInputs = 8): MeasurementSummaryV2 {
  const bindings: Record<string, BindingAggregateV2> = {
    short: binding("zhuyin:ㄦ", COMMONNESS_UNLOCK_POLICY.cleanInputsPerKey - 1, 0),
  };
  for (let index = 0; index < practised; index += 1) {
    bindings[`key-${index}`] = binding(`zhuyin:${index}`, cleanInputs + 3, 3);
  }
  return {
    policyVersion: MEASUREMENT_V2_POLICY_VERSION,
    semantic: {
      bindings,
      confusions: {},
      ambiguousErrors: 0,
      duplicateComponents: 0,
      prematureTones: 0,
    },
    strategy: {
      inputOrderPositions: {},
    },
    motor: {
      coordination: {},
      immediateTokens: {},
      immediateHands: {},
      sameHandRevisits: {},
      toneCommits: {},
    },
  };
}

describe("commonness unlock policy", () => {
  it("asks for more practised keys at every rarer level", () => {
    const required = COMMONNESS_TIERS.map((tier) => requiredPractisedKeys(tier));
    expect(required[0]).toBe(0);
    for (let index = 1; index < required.length; index += 1) {
      expect(required[index]!).toBeGreaterThan(required[index - 1]!);
    }
  });

  it("counts a key as practised only once its clean inputs reach the bar", () => {
    const bar = COMMONNESS_UNLOCK_POLICY.cleanInputsPerKey;
    expect(practisedKeyCount(measurements(3, bar - 1))).toBe(0);
    expect(practisedKeyCount(measurements(3, bar))).toBe(3);
  });

  it("does not count errors towards a key, so accuracy shortens the road", () => {
    const clean = COMMONNESS_UNLOCK_POLICY.cleanInputsPerKey;
    const sloppy: MeasurementSummaryV2 = {
      ...measurements(0),
      semantic: {
        ...measurements(0).semantic,
        bindings: { one: binding("zhuyin:ㄅ", clean, clean) },
      },
    };
    expect(practisedKeyCount(sloppy)).toBe(0);
  });

  it("opens the most common level from the first round and nothing else", () => {
    expect(unlockedCommonnessTiers(measurements(0))).toEqual([1]);
    expect(nextCommonnessUnlock(measurements(0))).toEqual({
      tier: 2,
      practisedKeys: 0,
      requiredKeys: requiredPractisedKeys(2),
    });
  });

  it("opens each level as its bar is met and never closes one again", () => {
    let previous: readonly CommonnessTier[] = [];
    for (let practised = 0; practised <= requiredPractisedKeys(4) + 2; practised += 1) {
      const unlocked = unlockedCommonnessTiers(measurements(practised));
      expect(unlocked.length).toBeGreaterThanOrEqual(previous.length);
      expect(previous.every((tier) => unlocked.includes(tier))).toBe(true);
      previous = unlocked;
    }
    expect(previous).toEqual([...COMMONNESS_TIERS]);
    expect(nextCommonnessUnlock(measurements(requiredPractisedKeys(4)))).toBeNull();
  });
});

describe("practised commonness levels", () => {
  it("draws a level the learner never switched off as soon as it unlocks", () => {
    expect(effectiveCommonnessTiers(COMMONNESS_TIERS, [1, 2])).toEqual([1, 2]);
  });

  it("leaves a switched-off level off when a rarer one unlocks", () => {
    expect(effectiveCommonnessTiers([1, 3], [1, 2, 3])).toEqual([1, 3]);
  });

  it("keeps the most common unlocked level when the wish selects nothing", () => {
    expect(effectiveCommonnessTiers([3, 4], [1, 2])).toEqual([1]);
  });
});

describe("catalogs for commonness levels", () => {
  const thresholds = [0.8, 0.6, 0.4] as const;

  it("returns the catalogs untouched when every level is practised", () => {
    expect(catalogsForCommonnessTiers(PRODUCT_CATALOGS, thresholds, COMMONNESS_TIERS))
      .toBe(PRODUCT_CATALOGS);
  });

  it("keeps entries without frequency evidence at every setting", () => {
    const narrowed = catalogsForCommonnessTiers(PRODUCT_CATALOGS, thresholds, [1]);
    expect(narrowed.practice).toEqual(PRODUCT_CATALOGS.practice);
  });

  it("drops syntax profiles along with the entries they describe", () => {
    const kept = PRODUCT_CATALOGS.practice.slice(0, 2);
    const catalogs = {
      ...PRODUCT_CATALOGS,
      practice: PRODUCT_CATALOGS.practice.map((entry, index) => ({
        ...entry,
        commonnessBase: commonnessBase(index < 2 ? 0.9 : 0.1),
      })),
    };
    const narrowed = catalogsForCommonnessTiers(catalogs, thresholds, [1]);
    expect(narrowed.practice.map((entry) => entry.id)).toEqual(kept.map((entry) => entry.id));
    const entryIds = new Set([
      ...narrowed.practice.map((entry) => entry.id),
      ...narrowed.evaluation.map((entry) => entry.id),
    ]);
    expect(narrowed.syntaxProfiles.every((profile) => entryIds.has(profile.entryId))).toBe(true);
    expect(narrowed.syntaxProfiles.length).toBeLessThan(catalogs.syntaxProfiles.length);
  });

  it("leaves the evaluation yardstick whole", () => {
    const narrowed = catalogsForCommonnessTiers(PRODUCT_CATALOGS, thresholds, [1]);
    expect(narrowed.evaluation).toBe(PRODUCT_CATALOGS.evaluation);
  });
});
