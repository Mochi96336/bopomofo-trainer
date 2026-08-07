import { describe, expect, it } from "vitest";
import type { Exercise } from "../../src/core/model.js";
import type { PracticeInput } from "../../src/practice/interaction-input.js";
import {
  applyInteractionInputV2,
  createInteractionSessionV2,
} from "../../src/practice/interaction-session-v2.js";

const body = ["zhuyin:ㄒ", "zhuyin:ㄩ", "zhuyin:ㄝ"] as const;
const tone = "tone:2";

function exerciseWith(tokens: readonly string[]): Exercise {
  return {
    id: "interaction-v2-test",
    mode: "guided",
    layoutId: "zhuyin-standard",
    entries: [
      {
        id: "word:學",
        prompt: { text: "學", locale: "zh-TW" },
        syllables: [{ tokens }],
        tags: ["test"],
        provenanceIds: ["test"],
      },
    ],
  };
}

function input(
  timestampMs: number,
  actualToken: string | null,
  overrides: Partial<Pick<PracticeInput, "repeat" | "composing" | "modifierOnly">> = {},
): PracticeInput {
  return {
    timestampMs,
    physicalCode: actualToken ?? "ArrowDown",
    actualToken,
    repeat: overrides.repeat ?? false,
    composing: overrides.composing ?? false,
    modifierOnly: overrides.modifierOnly ?? false,
  };
}

function run(tokens: readonly string[]) {
  let state = createInteractionSessionV2(exerciseWith([...body, tone]), 100);
  tokens.forEach((token, index) => {
    state = applyInteractionInputV2(state, input(110 + index * 10, token));
  });
  return state;
}

const permutations = [
  [body[0], body[1], body[2]],
  [body[0], body[2], body[1]],
  [body[1], body[0], body[2]],
  [body[1], body[2], body[0]],
  [body[2], body[0], body[1]],
  [body[2], body[1], body[0]],
] as const;

describe("interaction session v2", () => {
  it.each(permutations)("accepts body permutation %j before tone commit", (...orderedBody) => {
    const state = run([...orderedBody, tone]);

    expect(state.completed).toBe(true);
    expect(state.completedCount).toBe(4);
    expect(state.traces.map((trace) => trace.outcome)).toEqual([
      "accepted-component",
      "accepted-component",
      "accepted-component",
      "accepted-tone",
    ]);
    expect(state.traces.map((trace) => trace.matchedToken)).toEqual([...orderedBody, tone]);
    expect(state.traces.map((trace) => trace.acceptedOrdinalInSyllable)).toEqual([0, 1, 2, 3]);
    expect(state.traces.every((trace) => trace.attributedExpectedToken === null)).toBe(true);
  });

  it("retains canonical slot identity without using canonical order as the cursor", () => {
    const state = run([body[2], body[0], body[1], tone]);

    expect(state.traces.map((trace) => trace.canonicalTokenIndex)).toEqual([2, 0, 1, 3]);
    expect(state.traces.map((trace) => trace.context)).toEqual([
      "exercise-start",
      "within-syllable",
      "within-syllable",
      "tone",
    ]);
  });

  it("does not invent a confusion target while multiple body slots remain", () => {
    let state = createInteractionSessionV2(exerciseWith([...body, tone]), 100);
    state = applyInteractionInputV2(state, input(120, "zhuyin:ㄐ"));

    expect(state.completedCount).toBe(0);
    expect(state.traces[0]).toMatchObject({
      outcome: "unexpected-component",
      accepted: false,
      attributedExpectedToken: null,
    });
  });

  it("attributes an unexpected component only when one body slot remains", () => {
    let state = createInteractionSessionV2(exerciseWith([...body, tone]), 100);
    state = applyInteractionInputV2(state, input(110, body[1]));
    state = applyInteractionInputV2(state, input(120, body[2]));
    state = applyInteractionInputV2(state, input(130, "zhuyin:ㄐ"));

    expect(state.traces[2]).toMatchObject({
      outcome: "unexpected-component",
      attributedExpectedToken: body[0],
      accepted: false,
    });
  });

  it("distinguishes duplicate body input from an unknown intended target", () => {
    let state = createInteractionSessionV2(exerciseWith([...body, tone]), 100);
    state = applyInteractionInputV2(state, input(110, body[1]));
    state = applyInteractionInputV2(state, input(120, body[1]));

    expect(state.completedBodySlotIds).toHaveLength(1);
    expect(state.traces[1]).toMatchObject({
      outcome: "duplicate-component",
      attributedExpectedToken: null,
      accepted: false,
    });
  });

  it("requires body completion before tone and attributes a wrong ready tone", () => {
    let state = createInteractionSessionV2(exerciseWith([...body, tone]), 100);
    state = applyInteractionInputV2(state, input(110, tone));
    expect(state.traces[0]).toMatchObject({
      outcome: "premature-tone",
      attributedExpectedToken: null,
    });

    state = applyInteractionInputV2(state, input(120, body[0]));
    state = applyInteractionInputV2(state, input(130, body[1]));
    state = applyInteractionInputV2(state, input(140, body[2]));
    state = applyInteractionInputV2(state, input(150, "tone:3"));
    expect(state.traces[4]).toMatchObject({
      outcome: "unexpected-tone",
      attributedExpectedToken: tone,
      accepted: false,
    });

    state = applyInteractionInputV2(state, input(160, tone));
    expect(state.completed).toBe(true);
    expect(state.traces[5]).toMatchObject({
      outcome: "accepted-tone",
      recovery: true,
    });
  });

  it("keeps interaction noise separate from motor errors and recovery", () => {
    let state = createInteractionSessionV2(exerciseWith([body[0], tone]), 100);
    state = applyInteractionInputV2(state, input(105, body[0], { repeat: true }));
    state = applyInteractionInputV2(state, input(110, null, { modifierOnly: true }));
    state = applyInteractionInputV2(state, input(115, null, { composing: true }));
    state = applyInteractionInputV2(state, input(120, null));
    state = applyInteractionInputV2(state, input(130, body[0]));

    expect(state.traces.slice(0, 4).map((trace) => trace.outcome)).toEqual([
      "ignored-repeat",
      "ignored-modifier",
      "composition",
      "unmapped",
    ]);
    expect(state.traces[4]?.recovery).toBe(false);
  });

  it("advances to the next syllable only on accepted tone commit", () => {
    const exercise: Exercise = {
      ...exerciseWith([body[0], tone]),
      entries: [
        {
          id: "word:中文",
          prompt: { text: "中文", locale: "zh-TW" },
          syllables: [
            { tokens: ["zhuyin:ㄓ", "tone:1"] },
            { tokens: ["zhuyin:ㄨ", "zhuyin:ㄣ", "tone:2"] },
          ],
          tags: ["test"],
          provenanceIds: ["test"],
        },
      ],
    };
    let state = createInteractionSessionV2(exercise, 100);
    state = applyInteractionInputV2(state, input(110, "zhuyin:ㄓ"));
    state = applyInteractionInputV2(state, input(120, "tone:1"));

    expect(state.currentSyllableOrdinal).toBe(1);
    expect(state.completedBodySlotIds).toEqual([]);
    expect(state.completed).toBe(false);

    state = applyInteractionInputV2(state, input(130, "zhuyin:ㄣ"));
    expect(state.traces[2]).toMatchObject({
      syllableOrdinal: 1,
      outcome: "accepted-component",
      context: "syllable-start",
    });
  });
});
