import { describe, expect, it } from "vitest";
import type { Exercise } from "../../src/core/model.js";
import { compileExerciseInputPlan } from "../../src/practice/input-plan.js";

function exerciseWith(tokens: readonly string[]): Exercise {
  return {
    id: "input-plan-test",
    mode: "guided",
    layoutId: "zhuyin-standard",
    entries: [
      {
        id: "word:test",
        prompt: { text: "學", locale: "zh-TW" },
        syllables: [{ tokens }],
        tags: ["test"],
        provenanceIds: ["test"],
      },
    ],
  };
}

describe("exercise input plan", () => {
  it("keeps canonical indices while separating body completion from tone commit", () => {
    const plan = compileExerciseInputPlan(
      exerciseWith(["zhuyin:ㄒ", "zhuyin:ㄩ", "zhuyin:ㄝ", "tone:2"]),
    );

    expect(plan.totalSlots).toBe(4);
    expect(plan.syllables).toHaveLength(1);
    expect(plan.syllables[0]).toMatchObject({
      id: "0:0",
      ordinal: 0,
      entryId: "word:test",
      entryIndex: 0,
      syllableIndex: 0,
    });
    expect(plan.syllables[0]?.bodySlots).toEqual([
      {
        id: "0:0:0",
        tokenId: "zhuyin:ㄒ",
        canonicalTokenIndex: 0,
        kind: "body",
      },
      {
        id: "0:0:1",
        tokenId: "zhuyin:ㄩ",
        canonicalTokenIndex: 1,
        kind: "body",
      },
      {
        id: "0:0:2",
        tokenId: "zhuyin:ㄝ",
        canonicalTokenIndex: 2,
        kind: "body",
      },
    ]);
    expect(plan.syllables[0]?.toneSlot).toEqual({
      id: "0:0:3",
      tokenId: "tone:2",
      canonicalTokenIndex: 3,
      kind: "tone",
    });
  });

  it("uses exercise position for slot identity even when the same entry appears twice", () => {
    const base = exerciseWith(["zhuyin:ㄓ", "tone:1"]);
    const repeated: Exercise = {
      ...base,
      entries: [base.entries[0]!, base.entries[0]!],
    };
    const plan = compileExerciseInputPlan(repeated);

    expect(plan.syllables.map((syllable) => syllable.id)).toEqual(["0:0", "1:0"]);
    expect(plan.syllables.map((syllable) => syllable.bodySlots[0]?.id)).toEqual([
      "0:0:0",
      "1:0:0",
    ]);
  });

  it("rejects malformed syllables instead of teaching interaction code to guess", () => {
    expect(() => compileExerciseInputPlan(exerciseWith(["zhuyin:ㄒ"]))).toThrow(
      /must contain body and tone tokens/,
    );
    expect(() => compileExerciseInputPlan(exerciseWith(["tone:2", "zhuyin:ㄒ"]))).toThrow(
      /must end with a tone token/,
    );
    expect(() => compileExerciseInputPlan(exerciseWith(["zhuyin:ㄒ", "tone:2", "tone:3"]))).toThrow(
      /contains a non-final tone token/,
    );
  });
});
