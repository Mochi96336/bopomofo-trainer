import { describe, expect, it } from "vitest";
import type { Exercise } from "../../src/core/model.js";
import {
  STRATEGY_TRAJECTORY_LIMIT,
  aggregateMeasurementObservationsV2,
  createEmptyMeasurementSummaryV2,
  inputOrderPermutationAggregateKey,
} from "../../src/measurement-v2/aggregate.js";
import {
  deriveMeasurementObservationsV2,
  threePartInputOrderPermutation,
  twoPartInputOrderPermutation,
} from "../../src/measurement-v2/derive-observations.js";
import { parseMeasurementSummaryV2 } from "../../src/measurement-v2/serialize.js";
import type { PracticeInput } from "../../src/practice/interaction-input.js";
import {
  applyInteractionInputV2,
  createInteractionSessionV2,
  type InteractionSessionStateV2,
} from "../../src/practice/interaction-session-v2.js";

const exercise: Exercise = {
  id: "strategy-permutation-test",
  mode: "guided",
  layoutId: "zhuyin-standard",
  entries: [{
    id: "word:學",
    prompt: { text: "學", locale: "zh-TW" },
    syllables: [{ tokens: ["zhuyin:ㄒ", "zhuyin:ㄩ", "zhuyin:ㄝ", "tone:2"] }],
    tags: ["test"],
    provenanceIds: ["test"],
  }],
};

const twoPartExercise: Exercise = {
  id: "strategy-two-part-test",
  mode: "guided",
  layoutId: "zhuyin-standard",
  entries: [{
    id: "word:八",
    prompt: { text: "八", locale: "zh-TW" },
    syllables: [{ tokens: ["zhuyin:ㄅ", "zhuyin:ㄚ", "tone:1"] }],
    tags: ["test"],
    provenanceIds: ["test"],
  }],
};

function input(timestampMs: number, physicalCode: string, actualToken: string | null): PracticeInput {
  return {
    timestampMs,
    physicalCode,
    actualToken,
    repeat: false,
    composing: false,
    modifierOnly: false,
  };
}

function apply(
  state: InteractionSessionStateV2,
  timestampMs: number,
  physicalCode: string,
  actualToken: string | null,
): InteractionSessionStateV2 {
  return applyInteractionInputV2(state, input(timestampMs, physicalCode, actualToken));
}

describe("input-order strategy trajectories", () => {
  it("recognizes both complete two-part orders and exactly six three-part permutations", () => {
    expect(twoPartInputOrderPermutation([0, 1])).toBe("first-last");
    expect(twoPartInputOrderPermutation([1, 0])).toBe("last-first");
    expect(twoPartInputOrderPermutation([0])).toBeNull();
    expect(twoPartInputOrderPermutation([0, 0])).toBeNull();
    expect(twoPartInputOrderPermutation([0, 2])).toBeNull();

    expect(threePartInputOrderPermutation([0, 1, 2])).toBe("first-middle-last");
    expect(threePartInputOrderPermutation([1, 0, 2])).toBe("middle-first-last");
    expect(threePartInputOrderPermutation([0, 2, 1])).toBe("first-last-middle");
    expect(threePartInputOrderPermutation([1, 2, 0])).toBe("middle-last-first");
    expect(threePartInputOrderPermutation([2, 0, 1])).toBe("last-first-middle");
    expect(threePartInputOrderPermutation([2, 1, 0])).toBe("last-middle-first");
    expect(threePartInputOrderPermutation([0, 1])).toBeNull();
    expect(threePartInputOrderPermutation([0, 0, 2])).toBeNull();
    expect(threePartInputOrderPermutation([0, 1, 3])).toBeNull();
  });

  it("records a real two-part relative-millisecond trajectory in reverse accepted order", () => {
    let state = createInteractionSessionV2(twoPartExercise, 90);
    state = apply(state, 100, "Digit8", "zhuyin:ㄚ");
    state = apply(state, 148, "Digit1", "zhuyin:ㄅ");
    state = apply(state, 190, "Space", "tone:1");

    const result = deriveMeasurementObservationsV2(twoPartExercise, state.traces);
    expect(result.inputOrderPermutations).toEqual([]);
    expect(result.inputOrderTrajectories).toEqual([{
      syllableOrdinal: 0,
      bodySize: 2,
      permutation: "last-first",
      elapsedMs: [0, 48],
    }]);
    expect(result.inputOrderPositions).toHaveLength(2);
  });

  it("records one three-part complete order and one real relative-millisecond trajectory", () => {
    let state = createInteractionSessionV2(exercise, 90);
    state = apply(state, 100, "KeyM", "zhuyin:ㄩ");
    state = apply(state, 132, "KeyV", "zhuyin:ㄒ");
    state = apply(state, 170, "Comma", "zhuyin:ㄝ");
    state = apply(state, 205, "Digit6", "tone:2");

    const result = deriveMeasurementObservationsV2(exercise, state.traces);
    expect(result.inputOrderPermutations).toEqual([{
      syllableOrdinal: 0,
      permutation: "middle-first-last",
    }]);
    expect(result.inputOrderTrajectories).toEqual([{
      syllableOrdinal: 0,
      bodySize: 3,
      permutation: "middle-first-last",
      elapsedMs: [0, 32, 70],
    }]);
    expect(result.inputOrderPositions).toHaveLength(3);
  });

  it("keeps the complete three-part order count but omits a dirty trajectory", () => {
    let state = createInteractionSessionV2(exercise, 90);
    state = apply(state, 100, "KeyM", "zhuyin:ㄩ");
    state = apply(state, 115, "ArrowDown", null);
    state = apply(state, 132, "KeyV", "zhuyin:ㄒ");
    state = apply(state, 170, "Comma", "zhuyin:ㄝ");
    state = apply(state, 205, "Digit6", "tone:2");

    const result = deriveMeasurementObservationsV2(exercise, state.traces);
    expect(result.inputOrderPermutations).toEqual([{
      syllableOrdinal: 0,
      permutation: "middle-first-last",
    }]);
    expect(result.inputOrderTrajectories).toEqual([]);
  });

  it("retains the newest 80 clean trajectories independently for two- and three-part words", () => {
    const twoPartTrajectories = Array.from(
      { length: STRATEGY_TRAJECTORY_LIMIT + 5 },
      (_, index) => ({
        syllableOrdinal: index,
        bodySize: 2 as const,
        permutation: index % 2 === 0 ? "first-last" as const : "last-first" as const,
        elapsedMs: [0, 70 + index] as const,
      }),
    );
    const threePartTrajectories = Array.from(
      { length: STRATEGY_TRAJECTORY_LIMIT + 5 },
      (_, index) => ({
        syllableOrdinal: 1000 + index,
        bodySize: 3 as const,
        permutation: index % 2 === 0
          ? "first-middle-last" as const
          : "middle-first-last" as const,
        elapsedMs: [0, 100 + index, 200 + index] as const,
      }),
    );
    const summary = aggregateMeasurementObservationsV2({
      bindings: [],
      confusions: [],
      inputOrderPositions: [],
      inputOrderPermutations: [
        { syllableOrdinal: 0, permutation: "middle-first-last" },
        { syllableOrdinal: 1, permutation: "middle-first-last" },
        { syllableOrdinal: 2, permutation: "first-middle-last" },
      ],
      inputOrderTrajectories: [...twoPartTrajectories, ...threePartTrajectories],
      coordination: [],
      immediateTokens: [],
      immediateHands: [],
      sameHandRevisits: [],
      toneCommits: [],
      ambiguousErrorCount: 0,
      duplicateComponentCount: 0,
      prematureToneCount: 0,
    });
    const reorderedScope = {
      bodySize: "3" as const,
      permutation: "middle-first-last" as const,
    };
    expect(summary.strategy.inputOrderPermutations?.[
      inputOrderPermutationAggregateKey(reorderedScope)
    ]).toEqual({
      scope: reorderedScope,
      observations: 2,
    });
    expect(Object.keys(summary.strategy.inputOrderPermutations ?? {})).toHaveLength(2);

    const retained = summary.strategy.recentInputOrderTrajectories ?? [];
    const retainedTwo = retained.filter((sample) => sample.bodySize === "2");
    const retainedThree = retained.filter((sample) => sample.bodySize === "3");
    expect(retained).toHaveLength(STRATEGY_TRAJECTORY_LIMIT * 2);
    expect(retainedTwo).toHaveLength(STRATEGY_TRAJECTORY_LIMIT);
    expect(retainedThree).toHaveLength(STRATEGY_TRAJECTORY_LIMIT);
    expect(retainedTwo[0]?.elapsedMs).toEqual([0, 75]);
    expect(retainedTwo.at(-1)?.elapsedMs).toEqual([0, 154]);
    expect(retainedThree[0]?.elapsedMs).toEqual([0, 105, 205]);
    expect(retainedThree.at(-1)?.elapsedMs).toEqual([0, 184, 284]);

    const tokens = new Set(["zhuyin:ㄒ", "zhuyin:ㄩ", "zhuyin:ㄝ", "tone:2"]);
    expect(parseMeasurementSummaryV2(summary, "guided", "zhuyin-standard", tokens))
      .toEqual(summary);
  });

  it("loads an older current-policy record without joint-order or trajectory channels as empty", () => {
    const summary = createEmptyMeasurementSummaryV2();
    const oldShape = structuredClone(summary) as unknown as Record<string, unknown>;
    const strategy = oldShape.strategy as Record<string, unknown>;
    delete strategy.inputOrderPermutations;
    delete strategy.recentInputOrderTrajectories;
    const tokens = new Set(["zhuyin:ㄒ", "zhuyin:ㄩ", "zhuyin:ㄝ", "tone:2"]);

    expect(parseMeasurementSummaryV2(oldShape, "guided", "zhuyin-standard", tokens)).toEqual(summary);
  });

  it("migrates the first trajectory format without bodySize as three-part evidence", () => {
    const oldShape = structuredClone(createEmptyMeasurementSummaryV2()) as unknown as Record<string, unknown>;
    const strategy = oldShape.strategy as Record<string, unknown>;
    strategy.recentInputOrderTrajectories = [{
      permutation: "middle-first-last",
      elapsedMs: [0, 82, 219],
    }];
    const tokens = new Set(["zhuyin:ㄒ", "zhuyin:ㄩ", "zhuyin:ㄝ", "tone:2"]);

    const parsed = parseMeasurementSummaryV2(oldShape, "guided", "zhuyin-standard", tokens);
    expect(parsed?.strategy.recentInputOrderTrajectories).toEqual([{
      bodySize: "3",
      permutation: "middle-first-last",
      elapsedMs: [0, 82, 219],
    }]);
  });

  it("rejects malformed or per-family over-limit persisted trajectory buffers", () => {
    const tokens = new Set(["zhuyin:ㄒ", "zhuyin:ㄩ", "zhuyin:ㄝ", "tone:2"]);
    const malformed = structuredClone(createEmptyMeasurementSummaryV2()) as unknown as Record<string, unknown>;
    const malformedStrategy = malformed.strategy as Record<string, unknown>;
    malformedStrategy.recentInputOrderTrajectories = [{
      bodySize: "3",
      permutation: "first-middle-last",
      elapsedMs: [0, 220, 180],
    }];
    expect(parseMeasurementSummaryV2(malformed, "guided", "zhuyin-standard", tokens)).toBeNull();

    const tooMany = structuredClone(createEmptyMeasurementSummaryV2()) as unknown as Record<string, unknown>;
    const tooManyStrategy = tooMany.strategy as Record<string, unknown>;
    tooManyStrategy.recentInputOrderTrajectories = Array.from(
      { length: STRATEGY_TRAJECTORY_LIMIT + 1 },
      () => ({ bodySize: "2", permutation: "first-last", elapsedMs: [0, 100] }),
    );
    expect(parseMeasurementSummaryV2(tooMany, "guided", "zhuyin-standard", tokens)).toBeNull();
  });
});
