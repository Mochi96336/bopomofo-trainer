import { describe, expect, it } from "vitest";
import type { InputLayout, TokenId } from "../../src/core/model.js";
import type {
  CatalogSupportIndex,
  CatalogTokenSupport,
  CurriculumProfile,
} from "../../src/curriculum/types.js";
import { buildAnalysisV2SemanticModel } from "../../src/app/analysis-v2-semantic-model.js";
import { aggregateMeasurementObservationsV2 } from "../../src/measurement-v2/aggregate.js";
import {
  createEmptyKeyProgressHistory,
  createEmptyProgressHistory,
} from "../../src/progress-history/update.js";

const LAYOUT: InputLayout = {
  id: "test-layout",
  name: "Test",
  bindings: {
    Digit1: "zhuyin:ㄅ",
    KeyQ: "zhuyin:ㄆ",
    KeyA: "zhuyin:ㄇ",
  },
};

const CURRICULUM: CurriculumProfile = {
  mode: "guided",
  layoutId: LAYOUT.id,
  round: 0,
  bindings: {},
  recentEntryIds: [],
  recentTokenIds: [],
};

function tokenSupport(tokenId: TokenId, motorEntryCount: number): CatalogTokenSupport {
  return {
    tokenId,
    entryIds: ["entry"],
    entryCount: 1,
    bindingEntryIds: ["entry"],
    bindingEntryCount: 1,
    motorEntryIds: motorEntryCount > 0 ? ["entry"] : [],
    motorEntryCount,
    commonEntryCount: 1,
    commonBindingEntryCount: 1,
    commonMotorEntryCount: motorEntryCount,
    commonnessTierCounts: {
      1: 1,
      2: 0,
      3: 0,
      4: 0,
    },
  };
}

const SUPPORT: CatalogSupportIndex = {
  byToken: {
    "zhuyin:ㄅ": tokenSupport("zhuyin:ㄅ", 1),
    "zhuyin:ㄆ": tokenSupport("zhuyin:ㄆ", 0),
    "zhuyin:ㄇ": tokenSupport("zhuyin:ㄇ", 1),
  },
  entriesById: {},
};

function emptyObservationFamilies() {
  return {
    inputOrderPositions: [],
    coordination: [],
    immediateTokens: [],
    immediateHands: [],
    sameHandRevisits: [],
    toneCommits: [],
    ambiguousErrorCount: 0,
    duplicateComponentCount: 0,
    prematureToneCount: 0,
  } as const;
}

describe("Analysis V2 native semantic model", () => {
  it("projects only rendered binding evidence directly from Measurement V2", () => {
    const measurements = aggregateMeasurementObservationsV2({
      bindings: [
        { traceSequence: 0, scope: { mode: "guided", layoutId: LAYOUT.id, tokenId: "zhuyin:ㄅ" }, physicalCode: "Digit1", correct: true, timingMs: 120 },
        { traceSequence: 1, scope: { mode: "guided", layoutId: LAYOUT.id, tokenId: "zhuyin:ㄅ" }, physicalCode: "Digit1", correct: false, timingMs: null },
        { traceSequence: 2, scope: { mode: "guided", layoutId: LAYOUT.id, tokenId: "zhuyin:ㄅ" }, physicalCode: "Digit1", correct: true, timingMs: 110 },
        { traceSequence: 3, scope: { mode: "guided", layoutId: LAYOUT.id, tokenId: "zhuyin:ㄅ" }, physicalCode: "Digit1", correct: true, timingMs: 100 },
      ],
      confusions: [],
      ...emptyObservationFamilies(),
    });

    const model = buildAnalysisV2SemanticModel({
      measurements,
      curriculum: CURRICULUM,
      support: SUPPORT,
      layout: LAYOUT,
    });
    const key = model.keys.find((row) => row.tokenId === "zhuyin:ㄅ");
    const noMotorKey = model.keys.find((row) => row.tokenId === "zhuyin:ㄆ");

    expect(key).toMatchObject({
      physicalCode: "Digit1",
      physicalKey: "1",
      attempts: 4,
      errors: 1,
      displayedErrorRatio: 0.25,
      errorDataState: "preliminary",
      timingSamples: 3,
      timingDataState: "preliminary",
      timingAvailability: "available",
    });
    expect(Object.keys(key ?? {})).not.toContain("reinforcement");
    expect(Object.keys(key ?? {})).not.toContain("bestTimingMs");
    expect(noMotorKey?.timingAvailability).toBe("not-applicable");
    expect(noMotorKey?.timingDataState).toBeNull();
    expect(model.keysWithData).toBe(1);
  });

  it("keeps directional confusion totals inside the active mode and layout", () => {
    const confusion = (
      traceSequence: number,
      actualToken: TokenId,
      mode: "guided" | "recall" = "guided",
    ) => ({
      traceSequence,
      mode,
      layoutId: LAYOUT.id,
      expectedToken: "zhuyin:ㄅ",
      actualToken,
      physicalCode: actualToken === "zhuyin:ㄆ" ? "KeyQ" : "KeyA",
    });
    const measurements = aggregateMeasurementObservationsV2({
      bindings: [],
      confusions: [
        confusion(0, "zhuyin:ㄆ"),
        confusion(1, "zhuyin:ㄆ"),
        confusion(2, "zhuyin:ㄆ"),
        confusion(3, "zhuyin:ㄇ"),
        confusion(4, "zhuyin:ㄇ", "recall"),
        confusion(5, "zhuyin:ㄇ", "recall"),
      ],
      ...emptyObservationFamilies(),
    });

    const model = buildAnalysisV2SemanticModel({
      measurements,
      curriculum: CURRICULUM,
      support: SUPPORT,
      layout: LAYOUT,
    });
    const toPo = model.confusions.find((row) => row.actualTokenId === "zhuyin:ㄆ");
    const toMo = model.confusions.find((row) => row.actualTokenId === "zhuyin:ㄇ");

    expect(model.confusions).toHaveLength(2);
    expect(toPo).toMatchObject({
      occurrences: 3,
      expectedConfusionTotal: 4,
      expectedErrorShare: 0.75,
      expectedPhysicalKey: "1",
      actualPhysicalKey: "Q",
      dataState: "preliminary",
    });
    expect(toMo).toMatchObject({
      occurrences: 1,
      expectedConfusionTotal: 4,
      expectedErrorShare: 0.25,
      dataState: "insufficient",
    });
    expect(model.repeatedConfusions).toBe(1);
  });

  it("projects bounded key history without reconstructing it from cumulative aggregates", () => {
    const measurements = aggregateMeasurementObservationsV2({
      bindings: [],
      confusions: [],
      ...emptyObservationFamilies(),
    });
    const empty = createEmptyProgressHistory("guided", LAYOUT.id);
    const key = createEmptyKeyProgressHistory("zhuyin:ㄅ");
    const history = {
      ...empty,
      keys: {
        "zhuyin:ㄅ": {
          ...key,
          correctness: [{
            endingObservation: 8,
            completedRound: 4,
            attempts: 8,
            errors: 2,
            errorRatio: 0.25,
          }],
          timing: [{
            endingSample: 5,
            completedRound: 4,
            samples: 5,
            representativeTimingMs: 115,
          }],
          totalObservations: 8,
          totalTimingSamples: 5,
        },
      },
    };

    const model = buildAnalysisV2SemanticModel({
      measurements,
      curriculum: CURRICULUM,
      support: SUPPORT,
      layout: LAYOUT,
      progressHistory: history,
    });

    expect(model.keyProgress["zhuyin:ㄅ"]?.correctness.points).toEqual([{
      index: 0,
      value: 0.25,
      sampleCount: 8,
      completedRound: 4,
    }]);
    expect(model.keyProgress["zhuyin:ㄅ"]?.timing.points).toEqual([{
      index: 0,
      value: 115,
      sampleCount: 5,
      completedRound: 4,
    }]);
    expect(model.keyProgress["zhuyin:ㄆ"]?.timing.state).toBe("not-applicable");
  });
});
