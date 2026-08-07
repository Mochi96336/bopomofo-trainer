import { describe, expect, it } from "vitest";
import type { Exercise } from "../../src/core/model.js";
import { deriveMeasurementObservationsV2 } from "../../src/measurement-v2/derive-observations.js";
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
  it("projects actual order into independent semantic and motor channels", () => {
    let state = createInteractionSessionV2(exercise, 90);
    state = apply(state, 100, "KeyM", "zhuyin:ㄩ"); // right
    state = apply(state, 132, "KeyV", "zhuyin:ㄒ"); // left
    state = apply(state, 170, "Comma", "zhuyin:ㄝ"); // right
    state = apply(state, 205, "Digit6", "tone:2"); // right

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

    expect(result.coordination).toEqual([
      {
        syllableOrdinal: 0,
        bodySize: 3,
        handShape: "mixed",
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
      { hand: "right", timing: 35, opposite: 0 },
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

  it("marks motor timing dirty without losing the underlying observation", () => {
    let state = createInteractionSessionV2(exercise, 90);
    state = apply(state, 100, "KeyM", "zhuyin:ㄩ");
    state = apply(state, 115, "ArrowDown", null);
    state = apply(state, 140, "KeyV", "zhuyin:ㄒ");
    state = apply(state, 170, "Comma", "zhuyin:ㄝ");
    state = apply(state, 185, "ArrowDown", null);
    state = apply(state, 210, "Digit6", "tone:2");

    const result = deriveMeasurementObservationsV2(exercise, state.traces);

    expect(result.coordination).toEqual([
      expect.objectContaining({ timingMs: 70, clean: false }),
    ]);
    expect(result.immediateHands[0]).toEqual(expect.objectContaining({ clean: false }));
    expect(result.toneCommits).toEqual([
      expect.objectContaining({ timingMs: 40, clean: false }),
    ]);
    expect(result.bindings.find((observation) => observation.traceSequence === 3)?.timingMs).toBeNull();
  });

  it("keeps same-hand predecessors across syllable and entry boundaries", () => {
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
    state = apply(state, 100, "KeyJ", "zhuyin:ㄨ"); // R
    state = apply(state, 120, "Digit6", "tone:2"); // R
    state = apply(state, 160, "KeyP", "zhuyin:ㄣ"); // R, next entry

    const result = deriveMeasurementObservationsV2(multi, state.traces);
    const revisit = result.sameHandRevisits.at(-1);

    expect(revisit).toEqual(expect.objectContaining({
      hand: "right",
      boundary: "entry-boundary",
      timingMs: 40,
      oppositeHandEventsBetween: 0,
    }));
  });

  it("treats ambiguous-hand accepted keys as a predecessor barrier", () => {
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
    state = apply(state, 100, "KeyJ", "zhuyin:ㄨ"); // R
    state = apply(state, 120, "Space", "tone:1"); // ambiguous, barrier
    state = apply(state, 160, "KeyP", "zhuyin:ㄣ"); // R

    const result = deriveMeasurementObservationsV2(multi, state.traces);

    expect(result.sameHandRevisits).toEqual([]);
    expect(result.immediateHands).toEqual([]);
  });
});
