import { describe, expect, it } from "vitest";
import type { Exercise } from "../../src/core/model.js";
import type { InteractionTraceV2 } from "../../src/practice/interaction-session-v2.js";
import { PROGRESS_HISTORY_POLICY } from "../../src/progress-history/policy.js";
import {
  appendRoundToProgressHistory,
  bucketRepresentativeTimingMs,
  createEmptyProgressHistory,
} from "../../src/progress-history/update.js";
import type { ProgressHistory } from "../../src/progress-history/types.js";

const TOKEN = "zhuyin:A";

const exercise: Exercise = {
  id: "round-1",
  mode: "guided",
  layoutId: "zhuyin-standard",
  entries: [
    {
      id: "entry:a",
      prompt: { text: "甲", locale: "zh-TW" },
      syllables: [{ tokens: ["zhuyin:A", "zhuyin:B", "tone:1"] }],
      tags: ["test"],
      provenanceIds: ["test"],
    },
  ],
};

function traceFactory(): (overrides?: Partial<InteractionTraceV2>) => InteractionTraceV2 {
  let sequence = 0;
  return (overrides = {}) => {
    sequence += 1;
    return {
      sequence,
      timestampMs: sequence * 1000,
      elapsedSincePreviousAcceptedMs: 100,
      exerciseId: exercise.id,
      entryId: "entry:a",
      entryIndex: 0,
      syllableIndex: 0,
      syllableOrdinal: 0,
      physicalCode: "KeyA",
      actualToken: TOKEN,
      matchedSlotId: "0:0:0",
      matchedToken: TOKEN,
      canonicalTokenIndex: 0,
      attributedExpectedToken: null,
      acceptedOrdinalInSyllable: 0,
      context: "within-syllable",
      outcome: "accepted-component",
      accepted: true,
      recovery: false,
      repeat: false,
      composing: false,
      modifierOnly: false,
      ...overrides,
    };
  };
}

function mappedError(
  trace: ReturnType<typeof traceFactory>,
  overrides: Partial<InteractionTraceV2> = {},
): InteractionTraceV2 {
  return trace({
    actualToken: "zhuyin:B",
    matchedSlotId: null,
    matchedToken: null,
    canonicalTokenIndex: null,
    attributedExpectedToken: TOKEN,
    acceptedOrdinalInSyllable: null,
    outcome: "unexpected-component",
    accepted: false,
    ...overrides,
  });
}

function noise(
  trace: ReturnType<typeof traceFactory>,
  outcome: "unmapped" | "ignored-modifier" | "ignored-repeat" | "composition",
  overrides: Partial<InteractionTraceV2> = {},
): InteractionTraceV2 {
  return trace({
    actualToken: null,
    matchedSlotId: null,
    matchedToken: null,
    canonicalTokenIndex: null,
    attributedExpectedToken: null,
    acceptedOrdinalInSyllable: null,
    outcome,
    accepted: false,
    ...overrides,
  });
}

function append(
  history: ProgressHistory,
  traces: readonly InteractionTraceV2[],
  completedRound: number,
): ProgressHistory {
  return appendRoundToProgressHistory({ history, exercise, traces, completedRound });
}

function emptyHistory(): ProgressHistory {
  return createEmptyProgressHistory("guided", "zhuyin-standard");
}

describe("progress history correctness bucketing", () => {
  it("keeps observations below the bucket size in the open partial bucket", () => {
    const trace = traceFactory();
    const traces = [
      ...Array.from({ length: 5 }, () => trace()),
      mappedError(trace),
    ];
    const entry = append(emptyHistory(), traces, 1).keys[TOKEN]!;

    expect(entry.correctness).toEqual([]);
    expect(entry.partialCorrectness).toEqual({ attempts: 6, errors: 1 });
    expect(entry.totalObservations).toBe(6);
  });

  it("closes exactly one point at the bucket size and carries the remainder forward", () => {
    const trace = traceFactory();
    const traces = [
      mappedError(trace),
      mappedError(trace),
      ...Array.from({ length: 7 }, () => trace()),
    ];
    const entry = append(emptyHistory(), traces, 3).keys[TOKEN]!;

    expect(entry.correctness).toEqual([
      {
        endingObservation: PROGRESS_HISTORY_POLICY.correctnessBucketSize,
        completedRound: 3,
        attempts: 8,
        errors: 2,
        errorRatio: 0.25,
      },
    ]);
    expect(entry.partialCorrectness).toEqual({ attempts: 1, errors: 0 });
    expect(entry.totalObservations).toBe(9);
  });

  it("counts a mapped recovery input as correctness but not timing", () => {
    const trace = traceFactory();
    const traces = [
      mappedError(trace),
      trace({ recovery: true }),
    ];
    const entry = append(emptyHistory(), traces, 1).keys[TOKEN]!;

    expect(entry.partialCorrectness).toEqual({ attempts: 2, errors: 1 });
    expect(entry.partialTiming.samples).toEqual([]);
  });

  it("ignores unmapped, modifier, repeat, and composition input", () => {
    const trace = traceFactory();
    const traces = [
      noise(trace, "unmapped"),
      noise(trace, "ignored-modifier", { modifierOnly: true }),
      noise(trace, "ignored-repeat", { repeat: true }),
      noise(trace, "composition", { composing: true }),
    ];
    const history = append(emptyHistory(), traces, 1);
    expect(history.keys[TOKEN]).toBeUndefined();
  });

  it("drops only the oldest completed point when the history limit is exceeded", () => {
    const limit = PROGRESS_HISTORY_POLICY.completedPointLimit;
    let history = emptyHistory();
    for (let round = 1; round <= limit + 2; round += 1) {
      const trace = traceFactory();
      history = append(
        history,
        Array.from({ length: PROGRESS_HISTORY_POLICY.correctnessBucketSize }, () => trace()),
        round,
      );
    }
    const entry = history.keys[TOKEN]!;

    expect(entry.correctness).toHaveLength(limit);
    expect(entry.correctness[0]!.completedRound).toBe(3);
    expect(entry.correctness.at(-1)!.completedRound).toBe(limit + 2);
    expect(entry.partialCorrectness).toEqual({ attempts: 0, errors: 0 });
    expect(entry.totalObservations).toBe(
      (limit + 2) * PROGRESS_HISTORY_POLICY.correctnessBucketSize,
    );
  });
});

describe("progress history timing bucketing", () => {
  function timedTraces(values: readonly number[]): readonly InteractionTraceV2[] {
    const trace = traceFactory();
    return values.map((elapsedSincePreviousAcceptedMs) => trace({ elapsedSincePreviousAcceptedMs }));
  }

  it("closes a timing point from accepted samples using the bucket median", () => {
    const history = append(emptyHistory(), timedTraces([400, 320, 500, 360, 380]), 2);
    const entry = history.keys[TOKEN]!;

    expect(entry.timing).toEqual([
      {
        endingSample: PROGRESS_HISTORY_POLICY.timingBucketSize,
        completedRound: 2,
        samples: 5,
        representativeTimingMs: 380,
      },
    ]);
    expect(entry.partialTiming.samples).toEqual([]);
  });

  it("summarizes a bucket deterministically regardless of arrival order", () => {
    expect(bucketRepresentativeTimingMs([400, 320, 500, 360, 380])).toBe(380);
    expect(bucketRepresentativeTimingMs([500, 380, 360, 400, 320])).toBe(380);
    expect(bucketRepresentativeTimingMs([100, 200])).toBe(150);
  });

  it("excludes start, incorrect, recovery, and interaction-noise timing", () => {
    const trace = traceFactory();
    const traces = [
      trace({ context: "syllable-start", elapsedSincePreviousAcceptedMs: 900 }),
      mappedError(trace, { elapsedSincePreviousAcceptedMs: 800 }),
      trace({ recovery: true, elapsedSincePreviousAcceptedMs: 700 }),
      noise(trace, "unmapped"),
      trace({ elapsedSincePreviousAcceptedMs: 600 }),
      trace({ elapsedSincePreviousAcceptedMs: 250 }),
    ];
    const entry = append(emptyHistory(), traces, 1).keys[TOKEN]!;

    expect(entry.partialTiming.samples).toEqual([250]);
    expect(entry.totalTimingSamples).toBe(1);
    expect(entry.partialCorrectness.attempts).toBe(5);
  });

  it("never admits a non-finite or negative interval", () => {
    const trace = traceFactory();
    const traces = [
      trace({ elapsedSincePreviousAcceptedMs: Number.NaN }),
      trace({ elapsedSincePreviousAcceptedMs: Number.POSITIVE_INFINITY }),
      trace({ elapsedSincePreviousAcceptedMs: -5 }),
      trace({ elapsedSincePreviousAcceptedMs: 310 }),
    ];
    const entry = append(emptyHistory(), traces, 1).keys[TOKEN]!;

    expect(entry.partialTiming.samples).toEqual([310]);
    expect(entry.totalTimingSamples).toBe(1);
  });

  it("bounds the retained partial samples below the bucket size", () => {
    const size = PROGRESS_HISTORY_POLICY.timingBucketSize;
    const values = Array.from({ length: size * 3 - 1 }, (_, index) => 300 + index);
    const entry = append(emptyHistory(), timedTraces(values), 1).keys[TOKEN]!;

    expect(entry.timing).toHaveLength(2);
    expect(entry.partialTiming.samples.length).toBeLessThan(size);
    expect(entry.totalTimingSamples).toBe(values.length);
  });
});

describe("progress history round application", () => {
  it("ignores a round that has already been folded in", () => {
    const trace = traceFactory();
    const traces = Array.from({ length: 4 }, () => trace());
    const first = append(emptyHistory(), traces, 1);
    const again = append(first, traces, 1);

    expect(again).toBe(first);
    expect(again.keys[TOKEN]!.totalObservations).toBe(4);
  });

  it("continues an open bucket across rounds", () => {
    const roundOne = traceFactory();
    const roundTwo = traceFactory();
    let history = append(emptyHistory(), Array.from({ length: 5 }, () => roundOne()), 1);
    history = append(history, Array.from({ length: 5 }, () => roundTwo()), 2);
    const entry = history.keys[TOKEN]!;

    expect(entry.correctness).toHaveLength(1);
    expect(entry.correctness[0]!.completedRound).toBe(2);
    expect(entry.partialCorrectness).toEqual({ attempts: 2, errors: 0 });
    expect(history.lastCompletedRound).toBe(2);
  });

  it("rejects a non-positive round number and a mismatched skill identity", () => {
    const trace = traceFactory();
    expect(() => append(emptyHistory(), [trace()], 0)).toThrow(RangeError);
    expect(() => appendRoundToProgressHistory({
      history: createEmptyProgressHistory("recall", "zhuyin-standard"),
      exercise,
      traces: [trace()],
      completedRound: 1,
    })).toThrow(/cannot append/u);
  });
});
