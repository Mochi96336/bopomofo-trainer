import { describe, expect, it } from "vitest";
import type { Exercise } from "../../src/core/model.js";
import {
  aggregateMeasurementObservationsV2,
  createEmptyMeasurementSummaryV2,
  inputOrderPermutationAggregateKey,
} from "../../src/measurement-v2/aggregate.js";
import {
  deriveMeasurementObservationsV2,
  threePartInputOrderPermutation,
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

function input(timestampMs: number, physicalCode: string, actualToken: string): PracticeInput {
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
  actualToken: string,
): InteractionSessionStateV2 {
  return applyInteractionInputV2(state, input(timestampMs, physicalCode, actualToken));
}

describe("three-part input-order strategy", () => {
  it("recognizes exactly the six complete permutations", () => {
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

  it("records one complete word order instead of trying to infer it from marginals", () => {
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
    expect(result.inputOrderPositions).toHaveLength(3);
  });

  it("aggregates and persists complete orders as a bounded additive strategy channel", () => {
    const summary = aggregateMeasurementObservationsV2({
      bindings: [],
      confusions: [],
      inputOrderPositions: [],
      inputOrderPermutations: [
        { syllableOrdinal: 0, permutation: "middle-first-last" },
        { syllableOrdinal: 1, permutation: "middle-first-last" },
        { syllableOrdinal: 2, permutation: "first-middle-last" },
      ],
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

    const tokens = new Set(["zhuyin:ㄒ", "zhuyin:ㄩ", "zhuyin:ㄝ", "tone:2"]);
    expect(parseMeasurementSummaryV2(summary, "guided", "zhuyin-standard", tokens))
      .toEqual(summary);
  });

  it("loads an older current-policy record without the joint-order channel as empty", () => {
    const summary = createEmptyMeasurementSummaryV2();
    const oldShape = structuredClone(summary) as unknown as Record<string, unknown>;
    const strategy = oldShape.strategy as Record<string, unknown>;
    delete strategy.inputOrderPermutations;
    const tokens = new Set(["zhuyin:ㄒ", "zhuyin:ㄩ", "zhuyin:ㄝ", "tone:2"]);

    expect(parseMeasurementSummaryV2(oldShape, "guided", "zhuyin-standard", tokens)).toEqual(summary);
  });
});
