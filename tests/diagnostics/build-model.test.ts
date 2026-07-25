import { describe, expect, it } from "vitest";
import type { InputLayout } from "../../src/core/model.js";
import { FREQUENCY_FIRST_UTTERANCE_POLICY } from "../../src/curriculum/frequency-first-utterance.js";
import type { CatalogSupportIndex, CurriculumProfile } from "../../src/curriculum/types.js";
import { buildDiagnosticModel } from "../../src/diagnostics/build-model.js";
import {
  bindingScopeKey,
  confusionScopeKey,
  transitionScopeKey,
} from "../../src/measurement/aggregate.js";
import type {
  BindingAggregate,
  ConfusionAggregate,
  MeasurementSummary,
  TransitionAggregate,
} from "../../src/measurement/types.js";
import type { ProgressHistory } from "../../src/progress-history/types.js";
import { createEmptyProgressHistory } from "../../src/progress-history/update.js";

const layout: InputLayout = {
  id: "test-layout",
  name: "Test",
  bindings: {
    KeyA: "zhuyin:A",
    KeyB: "zhuyin:B",
    KeyC: "zhuyin:C",
  },
};

const timedAggregate: BindingAggregate = {
  scope: { mode: "guided", layoutId: layout.id, tokenId: "zhuyin:A" },
  attempts: 10,
  errors: 2,
  timingSamples: 6,
  currentTimeToTypeMs: 480,
  bestTimeToTypeMs: 320,
  timingExclusions: {
    syllableStart: 2,
    incorrect: 2,
    recovery: 1,
    interactionNoise: 1,
  },
};

const correctnessOnlyAggregate: BindingAggregate = {
  scope: { mode: "guided", layoutId: layout.id, tokenId: "zhuyin:B" },
  attempts: 8,
  errors: 1,
  timingSamples: 0,
  currentTimeToTypeMs: null,
  bestTimeToTypeMs: null,
  timingExclusions: {
    syllableStart: 7,
    incorrect: 1,
    recovery: 0,
    interactionNoise: 0,
  },
};

const transition: TransitionAggregate = {
  scope: {
    mode: "guided",
    layoutId: layout.id,
    fromToken: "zhuyin:A",
    toToken: "zhuyin:B",
  },
  timingSamples: 5,
  currentTimeToTypeMs: 500,
  bestTimeToTypeMs: 350,
};

const confusionAB: ConfusionAggregate = {
  scope: {
    mode: "guided",
    layoutId: layout.id,
    expectedToken: "zhuyin:A",
    actualToken: "zhuyin:B",
  },
  occurrences: 4,
};

const confusionAC: ConfusionAggregate = {
  scope: {
    mode: "guided",
    layoutId: layout.id,
    expectedToken: "zhuyin:A",
    actualToken: "zhuyin:C",
  },
  occurrences: 2,
};

const measurements: MeasurementSummary = {
  policyVersion: "phase-3-v2",
  traceCount: 20,
  bindingObservationCount: 18,
  confusionObservationCount: 6,
  transitionObservationCount: 5,
  bindings: {
    [bindingScopeKey(timedAggregate.scope)]: timedAggregate,
    [bindingScopeKey(correctnessOnlyAggregate.scope)]: correctnessOnlyAggregate,
  },
  confusions: {
    [confusionScopeKey(confusionAB.scope)]: confusionAB,
    [confusionScopeKey(confusionAC.scope)]: confusionAC,
  },
  transitions: {
    [transitionScopeKey(transition.scope)]: transition,
  },
};

const support: CatalogSupportIndex = {
  byToken: {
    "zhuyin:A": {
      tokenId: "zhuyin:A",
      entryIds: ["a", "b", "c"],
      entryCount: 3,
      bindingEntryIds: ["a", "b", "c"],
      bindingEntryCount: 3,
      motorEntryIds: ["a", "b", "c"],
      motorEntryCount: 3,
      commonEntryCount: 3,
      commonBindingEntryCount: 3,
      commonMotorEntryCount: 3,
      commonnessTierCounts: { 1: 3, 2: 0, 3: 0, 4: 0 },
    },
    "zhuyin:B": {
      tokenId: "zhuyin:B",
      entryIds: ["a", "b", "c"],
      entryCount: 3,
      bindingEntryIds: ["a", "b", "c"],
      bindingEntryCount: 3,
      motorEntryIds: [],
      motorEntryCount: 0,
      commonEntryCount: 3,
      commonBindingEntryCount: 3,
      commonMotorEntryCount: 0,
      commonnessTierCounts: { 1: 3, 2: 0, 3: 0, 4: 0 },
    },
    "zhuyin:C": {
      tokenId: "zhuyin:C",
      entryIds: ["a", "b", "c"],
      entryCount: 3,
      bindingEntryIds: ["a", "b", "c"],
      bindingEntryCount: 3,
      motorEntryIds: ["a", "b", "c"],
      motorEntryCount: 3,
      commonEntryCount: 3,
      commonBindingEntryCount: 3,
      commonMotorEntryCount: 3,
      commonnessTierCounts: { 1: 3, 2: 0, 3: 0, 4: 0 },
    },
  },
  entriesById: {},
};

const curriculum: CurriculumProfile = {
  mode: "guided",
  layoutId: layout.id,
  round: 8,
  bindings: {
    "zhuyin:A": { scope: timedAggregate.scope, aggregate: timedAggregate, lastFocusedRound: null },
    "zhuyin:B": {
      scope: correctnessOnlyAggregate.scope,
      aggregate: correctnessOnlyAggregate,
      lastFocusedRound: 7,
    },
    "zhuyin:C": {
      scope: { mode: "guided", layoutId: layout.id, tokenId: "zhuyin:C" },
      aggregate: null,
      lastFocusedRound: null,
    },
  },
  recentEntryIds: [],
  recentTokenIds: [],
};

function build(
  selectionPolicy = FREQUENCY_FIRST_UTTERANCE_POLICY,
  progressHistory: ProgressHistory | null = null,
) {
  return buildDiagnosticModel({
    measurements,
    curriculum,
    support,
    layout,
    selectionPolicy,
    progressHistory,
  });
}

const progressHistory: ProgressHistory = {
  ...createEmptyProgressHistory("guided", layout.id),
  lastCompletedRound: 4,
  keys: {
    "zhuyin:A": {
      tokenId: "zhuyin:A",
      correctness: [0.25, 0.25, 0.125, 0].map((errorRatio, index) => ({
        endingObservation: (index + 1) * 8,
        completedRound: index + 1,
        attempts: 8,
        errors: errorRatio * 8,
        errorRatio,
      })),
      timing: [480, 470, 340, 330].map((representativeTimingMs, index) => ({
        endingSample: (index + 1) * 5,
        completedRound: index + 1,
        samples: 5,
        representativeTimingMs,
      })),
      partialCorrectness: { attempts: 0, errors: 0 },
      partialTiming: { samples: [] },
      totalObservations: 32,
      totalTimingSamples: 20,
    },
  },
};

describe("diagnostic model", () => {
  it("keeps error, timing, transition, and confusion semantics separate", () => {
    const model = build();

    const keyA = model.keys.find((row) => row.tokenId === "zhuyin:A");
    expect(keyA).toMatchObject({
      physicalKey: "A",
      attempts: 10,
      errors: 2,
      displayedErrorRatio: 0.2,
      errorDataState: "sufficient",
      timingAvailability: "available",
      timingDataState: "sufficient",
      overallDataState: "sufficient",
      reinforcement: {
        state: "reinforced",
        label: "選題加權中",
        reason: "錯誤觀察與有效鍵間時間",
        expectedTokenBoost: 1.45,
      },
    });
    expect(keyA?.excludedSamples).toEqual(timedAggregate.timingExclusions);

    const keyB = model.keys.find((row) => row.tokenId === "zhuyin:B");
    expect(keyB).toMatchObject({
      timingAvailability: "not-applicable",
      timingDataState: null,
      overallDataState: "sufficient",
      reinforcement: {
        state: "reinforced",
        label: "選題加權中",
        reason: "錯誤觀察較多",
        expectedTokenBoost: 1.1875,
      },
    });

    const keyC = model.keys.find((row) => row.tokenId === "zhuyin:C");
    expect(keyC?.reinforcement).toMatchObject({
      state: "sampling",
      label: "尚未達選題門檻",
      reason: "錯誤與時間樣本仍不足",
      expectedTokenBoost: 1,
    });

    expect(model.transitions).toEqual([
      expect.objectContaining({
        id: "transition:zhuyin:A->zhuyin:B",
        timingSamples: 5,
        timingMs: 500,
        dataState: "sufficient",
      }),
    ]);
    expect(model.confusions.find((row) => row.actualTokenId === "zhuyin:B")).toMatchObject({
      occurrences: 4,
      expectedConfusionTotal: 6,
      expectedErrorShare: 4 / 6,
    });
    expect(model.summary).toEqual({
      keysWithData: 2,
      repeatedConfusions: 2,
      slowerTransitions: 1,
    });
  });

  it("reports observed weakness neutrally when selection influence is disabled", () => {
    const model = build({
      ...FREQUENCY_FIRST_UTTERANCE_POLICY,
      errorBoostScale: 0,
      timingBoostScale: 0,
    });
    expect(model.keys.find((row) => row.tokenId === "zhuyin:A")?.reinforcement).toEqual({
      state: "neutral",
      label: "目前無額外加權",
      reason: "已有弱點觀察，但相關選題權重目前為 0%",
      expectedTokenBoost: 1,
    });
  });

  it("reports the starting state for every key when no history exists", () => {
    const model = build();

    // Cumulative aggregates are never reshaped into fabricated history points:
    // an existing learner keeps their aggregate and starts accumulating here.
    for (const key of model.keys) {
      expect(model.keyProgress[key.tokenId]?.correctness.state).toBe("no-history");
      expect(model.keyProgress[key.tokenId]?.correctness.points).toEqual([]);
    }
  });

  it("projects stored history into separate correctness and timing series", () => {
    const model = build(FREQUENCY_FIRST_UTTERANCE_POLICY, progressHistory);
    const projected = model.keyProgress["zhuyin:A"]!;

    expect(projected.correctness.points.map((point) => point.value))
      .toEqual([0.25, 0.25, 0.125, 0]);
    expect(projected.timing.points.map((point) => point.value))
      .toEqual([480, 470, 340, 330]);
    expect(projected.correctness.trend.state).toBe("improving");
    expect(projected.timing.trend.state).toBe("improving");
  });

  it("suppresses the timing series for a key that can never be timed", () => {
    const model = build(FREQUENCY_FIRST_UTTERANCE_POLICY, progressHistory);

    // zhuyin:B has no motor catalog position, so timing stays 不適用 here for
    // exactly the same reason it does in the cumulative detail.
    expect(model.keys.find((row) => row.tokenId === "zhuyin:B")?.timingAvailability)
      .toBe("not-applicable");
    expect(model.keyProgress["zhuyin:B"]?.timing.state).toBe("not-applicable");
  });
});
