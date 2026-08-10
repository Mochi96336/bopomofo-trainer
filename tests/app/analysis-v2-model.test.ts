import { describe, expect, it } from "vitest";
import {
  buildAnalysisV2Model,
  type AnalysisV2SemanticModel,
} from "../../src/app/analysis-v2-model.js";
import {
  aggregateMeasurementObservationsV2,
  immediateHandAggregateKey,
} from "../../src/measurement-v2/aggregate.js";
import { createEmptyProgressHistory } from "../../src/progress-history/update.js";

const semantic: AnalysisV2SemanticModel = {
  keys: [{
    tokenId: "zhuyin:ㄅ",
    symbol: "ㄅ",
    physicalCode: "Digit1",
    physicalKey: "1",
    attempts: 10,
    errors: 2,
    displayedErrorRatio: 0.2,
    errorDataState: "sufficient",
    timingAvailability: "available",
    timingMs: 100,
    timingSamples: 8,
    timingDataState: "sufficient",
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
  keysWithData: 1,
  repeatedConfusions: 1,
};

describe("Analysis V2 model", () => {
  it("keeps semantic, exact transition, coordination, and strategy evidence separate", () => {
    const measurements = aggregateMeasurementObservationsV2({
      bindings: [],
      confusions: [],
      inputOrderPositions: [
        { syllableOrdinal: 0, bodySize: 3, canonicalBodyIndex: 2, acceptedBodyIndex: 0 },
        { syllableOrdinal: 0, bodySize: 3, canonicalBodyIndex: 1, acceptedBodyIndex: 1 },
      ],
      coordination: [],
      immediateTokens: Array.from({ length: 5 }, (_, index) => ({
        traceSequence: index,
        fromToken: "zhuyin:ㄆ",
        toToken: "zhuyin:ㄅ",
        boundary: "within-syllable" as const,
        timingMs: 70 + index,
        clean: true,
      })),
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

    expect(model.semantic).toBe(semantic);
    expect(model.semantic.keysWithData).toBe(1);
    expect(model.semantic.repeatedConfusions).toBe(1);
    expect(model.coordination.readyTokenTransitions).toBe(1);
    expect(model.coordination.immediateTokens[0]?.scope).toEqual({
      fromToken: "zhuyin:ㄆ",
      toToken: "zhuyin:ㄅ",
    });
    expect(model.coordination.immediateTokens[0]?.history).toEqual([]);
    expect(model.coordination.readyScopes).toBe(1);
    expect(model.coordination.immediateHands[0]?.history[0]?.representativeTimingMs).toBe(42);
    expect(model.strategy.totalObservations).toBe(2);
    expect(model.strategy.bodySizeBucketsWithData).toBe(1);
  });

  it("omits adjacent same-hand duplicates while keeping true return scopes", () => {
    let sequence = 0;
    const measurements = aggregateMeasurementObservationsV2({
      bindings: [],
      confusions: [],
      inputOrderPositions: [],
      coordination: [],
      immediateTokens: [],
      immediateHands: [],
      sameHandRevisits: [
        ...Array.from({ length: 5 }, () => ({
          traceSequence: sequence++,
          hand: "left" as const,
          boundary: "within-syllable" as const,
          timingMs: 90,
          oppositeHandEventsBetween: 0,
          clean: true,
        })),
        ...Array.from({ length: 5 }, () => ({
          traceSequence: sequence++,
          hand: "left" as const,
          boundary: "within-syllable" as const,
          timingMs: 240,
          oppositeHandEventsBetween: 1,
          clean: true,
        })),
      ],
      toneCommits: [],
      ambiguousErrorCount: 0,
      duplicateComponentCount: 0,
      prematureToneCount: 0,
    });

    const model = buildAnalysisV2Model(semantic, measurements, null);

    expect(model.coordination.sameHandRevisits).toHaveLength(1);
    expect(model.coordination.sameHandRevisits[0]?.scope).toEqual({
      hand: "left",
      oppositeHandIntervened: true,
    });
    expect(model.coordination.observedScopes).toBe(1);
    expect(model.coordination.readyScopes).toBe(1);
    expect(model.coordination.cleanTimingSamples).toBe(5);
  });

  it("has no legacy transition domain to expose", () => {
    const measurements = aggregateMeasurementObservationsV2({
      bindings: [],
      confusions: [],
      inputOrderPositions: [],
      coordination: [],
      immediateTokens: [],
      immediateHands: [],
      sameHandRevisits: [],
      toneCommits: [],
      ambiguousErrorCount: 0,
      duplicateComponentCount: 0,
      prematureToneCount: 0,
    });
    const model = buildAnalysisV2Model(semantic, measurements, null);
    expect(Object.keys(model)).toEqual(["semantic", "coordination", "strategy"]);
    expect(model.coordination.observedTokenTransitions).toBe(0);
    expect(model.coordination.observedScopes).toBe(0);
  });
});
