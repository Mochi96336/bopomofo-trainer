import { describe, expect, it } from "vitest";
import {
  aggregateMeasurementObservationsV2,
  bindingAggregateKey,
  createEmptyMeasurementSummaryV2,
  immediateHandAggregateKey,
  immediateTokenAggregateKey,
  sameHandRevisitAggregateKey,
} from "../../src/measurement-v2/aggregate.js";
import type {
  ExplicitHand,
  MeasurementObservationsV2,
} from "../../src/measurement-v2/types.js";

function emptyObservations(): MeasurementObservationsV2 {
  return {
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
  };
}

describe("measurement v2 aggregation", () => {
  it("aggregates binding evidence without mixing ambiguous error counters into token skill", () => {
    const scope = { mode: "guided" as const, layoutId: "zhuyin-standard", tokenId: "zhuyin:ㄒ" };
    const observations: MeasurementObservationsV2 = {
      ...emptyObservations(),
      bindings: [
        { traceSequence: 1, scope, physicalCode: "KeyV", correct: true, timingMs: 100 },
        { traceSequence: 2, scope, physicalCode: "KeyR", correct: false, timingMs: null },
      ],
      ambiguousErrorCount: 3,
    };

    const summary = aggregateMeasurementObservationsV2(observations);
    expect(summary.semantic.bindings[bindingAggregateKey(scope)]).toEqual({
      scope,
      attempts: 2,
      errors: 1,
      timingSamples: 1,
      currentTimeToTypeMs: 100,
      bestTimeToTypeMs: 100,
    });
    expect(summary.semantic.ambiguousErrors).toBe(3);
  });

  it("keeps exact accepted-token identity while rejecting dirty and boundary timing", () => {
    const observations: MeasurementObservationsV2 = {
      ...emptyObservations(),
      immediateTokens: [
        {
          traceSequence: 2,
          fromToken: "zhuyin:ㄩ",
          toToken: "zhuyin:ㄒ",
          boundary: "within-syllable",
          timingMs: 40,
          clean: true,
        },
        {
          traceSequence: 3,
          fromToken: "zhuyin:ㄩ",
          toToken: "zhuyin:ㄒ",
          boundary: "within-syllable",
          timingMs: 80,
          clean: false,
        },
        {
          traceSequence: 4,
          fromToken: "zhuyin:ㄩ",
          toToken: "zhuyin:ㄒ",
          boundary: "syllable-boundary",
          timingMs: 100,
          clean: true,
        },
      ],
    };
    const summary = aggregateMeasurementObservationsV2(observations);
    const key = immediateTokenAggregateKey({ fromToken: "zhuyin:ㄩ", toToken: "zhuyin:ㄒ" });
    expect(summary.motor.immediateTokens[key]).toEqual({
      scope: { fromToken: "zhuyin:ㄩ", toToken: "zhuyin:ㄒ" },
      observations: 3,
      timingSamples: 1,
      currentTimeToTypeMs: 40,
      bestTimeToTypeMs: 40,
    });
  });

  it("retains dirty and boundary motor observations without admitting them as timing samples", () => {
    const observations: MeasurementObservationsV2 = {
      ...emptyObservations(),
      immediateHands: [
        {
          traceSequence: 2,
          fromHand: "left",
          toHand: "right",
          boundary: "within-syllable",
          timingMs: 40,
          clean: true,
        },
        {
          traceSequence: 3,
          fromHand: "left",
          toHand: "right",
          boundary: "within-syllable",
          timingMs: 80,
          clean: false,
        },
        {
          traceSequence: 4,
          fromHand: "left",
          toHand: "right",
          boundary: "syllable-boundary",
          timingMs: 100,
          clean: true,
        },
        {
          traceSequence: 5,
          fromHand: "left",
          toHand: "right",
          boundary: "entry-boundary",
          timingMs: 120,
          clean: true,
        },
      ],
    };

    const summary = aggregateMeasurementObservationsV2(observations);
    const key = immediateHandAggregateKey({ fromHand: "left", toHand: "right" });
    expect(summary.motor.immediateHands[key]).toEqual({
      scope: { fromHand: "left", toHand: "right" },
      observations: 4,
      timingSamples: 1,
      currentTimeToTypeMs: 40,
      bestTimeToTypeMs: 40,
    });
  });

  it("keeps low-dimensional motor aggregate cardinality bounded instead of multiplying observation features", () => {
    const hands: readonly ExplicitHand[] = ["left", "right"];
    const immediateHands: MeasurementObservationsV2["immediateHands"][number][] = [];
    const sameHandRevisits: MeasurementObservationsV2["sameHandRevisits"][number][] = [];
    const coordination: MeasurementObservationsV2["coordination"][number][] = [];

    let sequence = 1;
    for (let repetition = 0; repetition < 50; repetition += 1) {
      for (const fromHand of hands) {
        for (const toHand of hands) {
          immediateHands.push({
            traceSequence: sequence++,
            fromHand,
            toHand,
            boundary: repetition % 3 === 0 ? "entry-boundary" : "within-syllable",
            timingMs: 10 + repetition,
            clean: repetition % 5 !== 0,
          });
        }
        sameHandRevisits.push({
          traceSequence: sequence++,
          hand: fromHand,
          boundary: repetition % 4 === 0 ? "syllable-boundary" : "within-syllable",
          timingMs: 20 + repetition,
          oppositeHandEventsBetween: repetition % 7,
          clean: true,
        });
      }
    }

    for (const bodySize of [2, 3, 4, 5, 8]) {
      for (const handShape of ["left-only", "right-only", "mixed", "unknown"] as const) {
        coordination.push({
          syllableOrdinal: sequence++,
          bodySize,
          handShape,
          timingMs: bodySize * 10,
          clean: true,
        });
      }
    }

    const summary = aggregateMeasurementObservationsV2({
      ...emptyObservations(),
      immediateHands,
      sameHandRevisits,
      coordination,
    });

    expect(Object.keys(summary.motor.immediateHands)).toHaveLength(4);
    expect(Object.keys(summary.motor.sameHandRevisits)).toHaveLength(4);
    expect(Object.keys(summary.motor.coordination).length).toBeLessThanOrEqual(12);
  });

  it("distinguishes same-hand revisit only by hand and opposite-hand presence", () => {
    const observations: MeasurementObservationsV2 = {
      ...emptyObservations(),
      sameHandRevisits: [
        {
          traceSequence: 1,
          hand: "left",
          boundary: "within-syllable",
          timingMs: 50,
          oppositeHandEventsBetween: 1,
          clean: true,
        },
        {
          traceSequence: 2,
          hand: "left",
          boundary: "syllable-boundary",
          timingMs: 70,
          oppositeHandEventsBetween: 5,
          clean: true,
        },
      ],
    };

    const summary = aggregateMeasurementObservationsV2(observations);
    const key = sameHandRevisitAggregateKey({ hand: "left", oppositeHandIntervened: true });
    expect(summary.motor.sameHandRevisits[key]).toEqual({
      scope: { hand: "left", oppositeHandIntervened: true },
      observations: 2,
      timingSamples: 1,
      currentTimeToTypeMs: 50,
      bestTimeToTypeMs: 50,
    });
    expect(Object.keys(summary.motor.sameHandRevisits)).toHaveLength(1);
  });

  it("updates cumulative timing with the same bounded identity without admitting boundary pauses", () => {
    const first = aggregateMeasurementObservationsV2({
      ...emptyObservations(),
      immediateHands: [
        {
          traceSequence: 1,
          fromHand: "right",
          toHand: "left",
          boundary: "within-syllable",
          timingMs: 100,
          clean: true,
        },
      ],
    });
    const second = aggregateMeasurementObservationsV2({
      ...emptyObservations(),
      immediateHands: [
        {
          traceSequence: 2,
          fromHand: "right",
          toHand: "left",
          boundary: "syllable-boundary",
          timingMs: 60,
          clean: true,
        },
      ],
    }, first);

    const key = immediateHandAggregateKey({ fromHand: "right", toHand: "left" });
    expect(second.motor.immediateHands[key]).toEqual({
      scope: { fromHand: "right", toHand: "left" },
      observations: 2,
      timingSamples: 1,
      currentTimeToTypeMs: 100,
      bestTimeToTypeMs: 100,
    });
    expect(createEmptyMeasurementSummaryV2().motor.immediateTokens).toEqual({});
    expect(createEmptyMeasurementSummaryV2().motor.immediateHands).toEqual({});
  });
});
