import { describe, expect, it } from "vitest";
import {
  buildAnalysisV2Model,
} from "../../src/app/analysis-v2-model.js";
import type { DiagnosticModel } from "../../src/diagnostics/types.js";
import {
  aggregateMeasurementObservationsV2,
  immediateHandAggregateKey,
} from "../../src/measurement-v2/aggregate.js";
import { createEmptyProgressHistory } from "../../src/progress-history/update.js";

const semantic: DiagnosticModel = {
  summary: { keysWithData: 99, repeatedConfusions: 99, slowerTransitions: 99 },
  keys: [{
    tokenId: "zhuyin:ㄅ",
    symbol: "ㄅ",
    physicalCode: "Digit1",
    physicalKey: "1",
    attempts: 10,
    errors: 2,
    displayedErrorRatio: 0.2,
    errorMetricLabel: "錯誤觀察比例",
    errorDataState: "sufficient",
    timingAvailability: "available",
    timingMs: 100,
    timingSamples: 8,
    bestTimingMs: 80,
    timingDataState: "sufficient",
    excludedSamples: null,
    overallDataState: "sufficient",
    reinforcement: {
      state: "neutral",
      label: "穩定",
      reason: "test",
      expectedTokenBoost: 1,
    },
  }],
  transitions: [{
    id: "legacy-transition",
    fromTokenId: "zhuyin:ㄅ",
    toTokenId: "zhuyin:ㄆ",
    fromSymbol: "ㄅ",
    toSymbol: "ㄆ",
    fromPhysicalKey: "1",
    toPhysicalKey: "q",
    timingMs: 900,
    bestTimingMs: 600,
    timingSamples: 10,
    dataState: "sufficient",
    includesTone: false,
  }],
  confusions: [{
    id: "confusion",
    expectedTokenId: "zhuyin:ㄅ",
    actualTokenId: "zhuyin:ㄆ",
    expectedSymbol: "ㄅ",
    actualSymbol: "ㄆ",
    expectedPhysicalKey: "1",
    actualPhysicalKey: "q",
    occurrences: 3,
    expectedConfusionTotal: 3,
    expectedErrorShare: 1,
    dataState: "sufficient",
  }],
  keyProgress: {},
};

describe("Analysis V2 model", () => {
  it("keeps semantic, coordination, and strategy as separate evidence channels", () => {
    const measurements = aggregateMeasurementObservationsV2({
      bindings: [],
      confusions: [],
      inputOrderPositions: [
        { syllableOrdinal: 0, bodySize: 3, canonicalBodyIndex: 2, acceptedBodyIndex: 0 },
        { syllableOrdinal: 0, bodySize: 3, canonicalBodyIndex: 1, acceptedBodyIndex: 1 },
      ],
      coordination: [],
      immediateHands: Array.from({ length: 5 }, (_, index) => ({
        traceSequence: index,
        fromHand: "left" as const,
        toHand: "right" as const,
        boundary: "within-syllable" as const,
        timingMs: 40 + index,
        clean: true,
      })),
      sameHandRevisits: [],
      toneCommits: [],
      ambiguousErrorCount: 0,
      duplicateComponentCount: 0,
      prematureToneCount: 0,
    });
    const key = immediateHandAggregateKey({ fromHand: "left", toHand: "right" });
    const emptyHistory = createEmptyProgressHistory("guided", "zhuyin-standard");
    const history = {
      ...emptyHistory,
      motor: {
        ...emptyHistory.motor,
        immediateHands: {
          [key]: {
            scope: { fromHand: "left" as const, toHand: "right" as const },
            timing: [{
              endingSample: 5,
              completedRound: 5,
              samples: 5,
              representativeTimingMs: 42,
            }],
            partialTiming: { samples: [] },
            totalTimingSamples: 5,
          },
        },
      },
    };

    const model = buildAnalysisV2Model(semantic, measurements, history);

    expect(model.semantic.keysWithData).toBe(1);
    expect(model.semantic.repeatedConfusions).toBe(1);
    expect(model.coordination.readyScopes).toBe(1);
    expect(model.coordination.immediateHands[0]?.history[0]?.representativeTimingMs).toBe(42);
    expect(model.strategy.totalObservations).toBe(2);
    expect(model.strategy.bodySizeBucketsWithData).toBe(1);
  });

  it("does not expose legacy transition rows as an Analysis V2 domain", () => {
    const measurements = aggregateMeasurementObservationsV2({
      bindings: [],
      confusions: [],
      inputOrderPositions: [],
      coordination: [],
      immediateHands: [],
      sameHandRevisits: [],
      toneCommits: [],
      ambiguousErrorCount: 0,
      duplicateComponentCount: 0,
      prematureToneCount: 0,
    });
    const model = buildAnalysisV2Model(semantic, measurements, null);
    expect(Object.keys(model)).toEqual(["semantic", "coordination", "strategy"]);
    expect(model.coordination.observedScopes).toBe(0);
  });
});
