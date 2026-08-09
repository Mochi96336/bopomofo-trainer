import { describe, expect, it } from "vitest";
import type { Exercise } from "../../src/core/model.js";
import {
  coordinationBodyShape,
  deriveMeasurementObservationsV2,
} from "../../src/measurement-v2/derive-observations.js";
import type { PracticeInput } from "../../src/practice/interaction-input.js";
import {
  applyInteractionInputV2,
  createInteractionSessionV2,
  type InteractionSessionStateV2,
} from "../../src/practice/interaction-session-v2.js";

const exercise: Exercise = {
  id: "measurement-v2-test",
  mode: "guided",
  layoutId: "zhuyin-standard",
  entries: [
    {
      id: "word:學",
      prompt: { text: "學", locale: "zh-TW" },
      syllables: [{ tokens: ["zhuyin:ㄒ", "zhuyin:ㄩ", "zhuyin:ㄝ", "tone:2"] }],
      tags: ["test"],
      provenanceIds: ["test"],
    },
  ],
};

function input(
  timestampMs: number,
  physicalCode: string,
  actualToken: string | null,
  overrides: Partial<Pick<PracticeInput, "repeat" | "composing" | "modifierOnly">> = {},
): PracticeInput {
  return {
    timestampMs,
    physicalCode,
    actualToken,
    repeat: overrides.repeat ?? false,
    composing: overrides.composing ?? false,
    modifierOnly: overrides.modifierOnly ?? false,
  };
}

function apply(
  state: InteractionSessionStateV2,
  timestampMs: number,
  physicalCode: string,
  actualToken: string | null,
  overrides: Partial<Pick<PracticeInput, "repeat" | "composing" | "modifierOnly">> = {},
) {
  return applyInteractionInputV2(
    state,
    input(timestampMs, physicalCode, actualToken, overrides),
  );
}

describe("measurement v2 observation projection", () => {
  it("classifies the four real multi-part Bopomofo word-body structures", () => {
    expect(coordinationBodyShape(["zhuyin:ㄅ", "zhuyin:ㄧ"])).toBe("initial-medial");
    expect(coordinationBodyShape(["zhuyin:ㄅ", "zhuyin:ㄢ"])).toBe("initial-final");
    expect(coordinationBodyShape(["zhuyin:ㄧ", "zhuyin:ㄢ"])).toBe("medial-final");
    expect(coordinationBodyShape(["zhuyin:ㄐ", "zhuyin:ㄧ", "zhuyin:ㄚ"]))
      .toBe("initial-medial-final");
    expect(coordinationBodyShape(["zhuyin:A", "zhuyin:B"])).toBeNull();
  });

  it("projects actual order into independent semantic and motor channels", () => {
    let state = createInteractionSessionV2(exercise, 90);
    state = apply(state, 100, "KeyM", "zhuyin:ㄩ"); // right
    state = apply(state, 132, "KeyV", "zhuyin:ㄒ"); // left
    state = apply(state, 170, "Comma", "zhuyin:ㄝ"); // right
    state = apply(state, 205, "Digit6", "tone:2"); // right tone, not a revisit input

    const result = deriveMeasurementObservationsV2(exercise, state.traces);

    expect(result.bindings.map((observation) => ({
      token: observation.scope.tokenId,
      correct: observation.correct,
      timing: observation.timingMs,
    }))).toEqual([
      { token: "zhuyin:ㄩ", correct: true, timing: null },
      { token: "zhuyin:ㄒ", correct: true, timing: 32 },
      { token: "zhuyin:ㄝ", correct: true, timing: 38 },
      { token: "tone:2", correct: true, timing: 35 },
    ]);

    expect(result.immediateTokens.map((observation) => ({
      from: observation.fromToken,
      to: observation.toToken,
      timing: observation.timingMs,
      boundary: observation.boundary,
    }))).toEqual([
      { from: "zhuyin:ㄩ", to: "zhuyin:ㄒ", timing: 32, boundary: "within-syllable" },
      { from: "zhuyin:ㄒ", to: "zhuyin:ㄝ", timing: 38, boundary: "within-syllable" },
      { from: "zhuyin:ㄝ", to: "tone:2", timing: 35, boundary: "within-syllable" },
    ]);

    expect(result.coordination).toEqual([
      {
        syllableOrdinal: 0,
        bodyShape: "initial-medial-final",
        timingMs: 70,
        clean: true,
      },
    ]);
    expect(result.immediateHands.map((observation) => ({
      from: observation.fromHand,
      to: observation.toHand,
      timing: observation.timingMs,
      boundary: observation.boundary,
    }))).toEqual([
      { from: "right", to: "left", timing: 32, boundary: "within-syllable" },
      { from: "left", to: "right", timing: 38, boundary: "within-syllable" },
      { from: "right", to: "right", timing: 35, boundary: "within-syllable" },
    ]);
    expect(result.sameHandRevisits.map((observation) => ({
      hand: observation.hand,
      timing: observation.timingMs,
      opposite: observation.oppositeHandEventsBetween,
    }))).toEqual([
      { hand: "right", timing: 70, opposite: 1 },
    ]);
    expect(result.toneCommits).toEqual([
      {
        traceSequence: 4,
        toneToken: "tone:2",
        timingMs: 35,
        clean: true,
      },
    ]);
  });

  it("does not turn a left-right-left tone ending into a same-hand revisit", () => {
    const hao: Exercise = {
      id: "tone-revisit-test",
      mode: "guided",
      layoutId: "zhuyin-standard",
      entries: [{
        id: "word:好",
        prompt: { text: "好", locale: "zh-TW" },
        syllables: [{ tokens: ["zhuyin:ㄏ", "zhuyin:ㄠ", "tone:3"] }],
        tags: ["test"],
        provenanceIds: ["test"],
      }],
    };
    let state = createInteractionSessionV2(hao, 90);
    state = apply(state, 100, "KeyC", "zhuyin:ㄏ"); // left
    state = apply(state, 140, "KeyL", "zhuyin:ㄠ"); // right
    state = apply(state, 180, "Digit3", "tone:3"); // left tone

    const result = deriveMeasurementObservationsV2(hao, state.traces);
    expect(result.sameHandRevisits).toEqual([]);
    expect(result.toneCommits).toEqual([
      expect.objectContaining({ toneToken: "tone:3", timingMs: 40 }),
    ]);
  });

  it("does not manufacture binding or confusion evidence for ambiguous errors", () => {
    let state = createInteractionSessionV2(exercise, 90);
    state = apply(state, 100, "KeyR", "zhuyin:ㄐ");
    state = apply(state, 110, "KeyM", "zhuyin:ㄩ");
    state = apply(state, 120, "Comma", "zhuyin:ㄝ");
    state = apply(state, 130, "KeyR", "zhuyin:ㄐ");

    const result = deriveMeasurementObservationsV2(exercise, state.traces);

    expect(result.ambiguousErrorCount).toBe(1);
    expect(result.bindings.filter((observation) => !observation.correct)).toEqual([
      expect.objectContaining({
        traceSequence: 4,
        scope: expect.objectContaining({ tokenId: "zhuyin:ㄒ" }),
        correct: false,
      }),
    ]);
    expect(result.confusions).toEqual([
      expect.objectContaining({
        traceSequence: 4,
        expectedToken: "zhuyin:ㄒ",
        actualToken: "zhuyin:ㄐ",
      }),
    ]);
  });

  it("counts duplicate and premature-tone outcomes without turning them into confusions", () => {
    let state = createInteractionSessionV2(exercise, 90);
    state = apply(state, 100, "KeyM", "zhuyin:ㄩ");
    state = apply(state, 110, "KeyM", "zhuyin:ㄩ");
    state = apply(state, 120, "Digit6", "tone:2");

    const result = deriveMeasurementObservationsV2(exercise, state.traces);

    expect(result.duplicateComponentCount).toBe(1);
    expect(result.prematureToneCount).toBe(1);
    expect(result.confusions).toEqual([]);
  });

  it("marks exact and low-dimensional motor timing dirty without losing observations", () => {
    let state = createInteractionSessionV2(exercise, 90);
    state = apply(state, 100, "KeyM", "zhuyin:ㄩ");
    state = apply(state, 115, "ArrowDown", null);
    state = apply(state, 140, "KeyV", "zhuyin:ㄒ");
    state = apply(state, 170, "Comma", "zhuyin:ㄝ");
    state = apply(state, 185, "ArrowDown", null);
    state = apply(state, 210, "Digit6", "tone:2");

    const result = deriveMeasurementObservationsV2(exercise, state.traces);

    expect(result.coordination).toEqual([
      expect.objectContaining({
        bodyShape: "initial-medial-final",
        timingMs: 70,
        clean: false,
      }),
    ]);
    expect(result.immediateTokens[0]).toEqual(expect.objectContaining({
      fromToken: "zhuyin:ㄩ",
      toToken: "zhuyin:ㄒ",
      clean: false,
    }));
    expect(result.immediateHands[0]).toEqual(expect.objectContaining({ clean: false }));
    expect(result.sameHandRevisits).toEqual([
      expect.objectContaining({ hand: "right", timingMs: 70, clean: false }),
    ]);
    expect(result.toneCommits).toEqual([
      expect.objectContaining({ timingMs: 40, clean: false }),
    ]);
    expect(result.bindings.find((observation) => observation.traceSequence === 3)?.timingMs).toBeNull();
  });

  it("keeps exact predecessors across entry boundaries but resets body revisits", () => {
    const multi: Exercise = {
      id: "boundary-test",
      mode: "guided",
      layoutId: "zhuyin-standard",
      entries: [
        {
          id: "word:a",
          prompt: { text: "甲", locale: "zh-TW" },
          syllables: [{ tokens: ["zhuyin:ㄨ", "tone:2"] }],
          tags: ["test"],
          provenanceIds: ["test"],
        },
        {
          id: "word:b",
          prompt: { text: "乙", locale: "zh-TW" },
          syllables: [{ tokens: ["zhuyin:ㄣ", "tone:2"] }],
          tags: ["test"],
          provenanceIds: ["test"],
        },
      ],
    };
    let state = createInteractionSessionV2(multi, 90);
    state = apply(state, 100, "KeyJ", "zhuyin:ㄨ");
    state = apply(state, 120, "Digit6", "tone:2");
    state = apply(state, 160, "KeyP", "zhuyin:ㄣ");

    const result = deriveMeasurementObservationsV2(multi, state.traces);
    expect(result.immediateTokens.at(-1)).toEqual(expect.objectContaining({
      fromToken: "tone:2",
      toToken: "zhuyin:ㄣ",
      boundary: "entry-boundary",
      timingMs: 40,
    }));
    expect(result.sameHandRevisits).toEqual([]);
  });

  it("treats ambiguous-hand accepted keys as a predecessor barrier only for hand evidence", () => {
    const multi: Exercise = {
      id: "space-barrier",
      mode: "guided",
      layoutId: "zhuyin-standard",
      entries: [
        {
          id: "word:test",
          prompt: { text: "之", locale: "zh-TW" },
          syllables: [
            { tokens: ["zhuyin:ㄨ", "tone:1"] },
            { tokens: ["zhuyin:ㄣ", "tone:2"] },
          ],
          tags: ["test"],
          provenanceIds: ["test"],
        },
      ],
    };
    let state = createInteractionSessionV2(multi, 90);
    state = apply(state, 100, "KeyJ", "zhuyin:ㄨ");
    state = apply(state, 120, "Space", "tone:1");
    state = apply(state, 160, "KeyP", "zhuyin:ㄣ");

    const result = deriveMeasurementObservationsV2(multi, state.traces);

    expect(result.sameHandRevisits).toEqual([]);
    expect(result.immediateHands).toEqual([]);
    expect(result.immediateTokens).toHaveLength(2);
    expect(result.immediateTokens[0]).toEqual(expect.objectContaining({
      fromToken: "zhuyin:ㄨ",
      toToken: "tone:1",
      boundary: "within-syllable",
    }));
    expect(result.immediateTokens[1]).toEqual(expect.objectContaining({
      fromToken: "tone:1",
      toToken: "zhuyin:ㄣ",
      boundary: "syllable-boundary",
    }));
  });
});
