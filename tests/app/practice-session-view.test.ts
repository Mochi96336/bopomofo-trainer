import { describe, expect, it } from "vitest";
import type { Exercise } from "../../src/core/model.js";
import {
  applyInteractionInputV2,
  createInteractionSessionV2,
} from "../../src/practice/interaction-session-v2.js";
import {
  currentPracticeView,
  inspectionNextToken,
  syllableState,
  tokenState,
} from "../../src/app/practice-session-view.js";

const exercise: Exercise = {
  id: "view",
  mode: "guided",
  layoutId: "zhuyin-standard",
  entries: [{
    id: "學",
    prompt: { text: "學", locale: "zh-TW" },
    syllables: [{ tokens: ["zhuyin:ㄒ", "zhuyin:ㄩ", "zhuyin:ㄝ", "tone:2"] }],
    tags: [],
    provenanceIds: [],
  }],
};

function press(state: ReturnType<typeof createInteractionSessionV2>, token: string, time: number) {
  return applyInteractionInputV2(state, {
    timestampMs: time,
    physicalCode: "Test",
    actualToken: token,
    repeat: false,
    composing: false,
    modifierOnly: false,
  });
}

describe("practice session view", () => {
  it("shows every unfinished body component as acceptable regardless of canonical order", () => {
    let state = createInteractionSessionV2(exercise, 0);
    expect(currentPracticeView(state).acceptableTokens).toEqual([
      "zhuyin:ㄒ",
      "zhuyin:ㄩ",
      "zhuyin:ㄝ",
    ]);

    state = press(state, "zhuyin:ㄝ", 10);
    expect(tokenState(state, 0, 2)).toBe("done");
    expect(tokenState(state, 0, 0)).toBe("pending");
    expect(tokenState(state, 0, 1)).toBe("pending");
    expect(tokenState(state, 0, 3)).toBe("commit-locked");
    expect(currentPracticeView(state).acceptableTokens).toEqual([
      "zhuyin:ㄒ",
      "zhuyin:ㄩ",
    ]);
  });

  it("exposes only the tone after the body is complete", () => {
    let state = createInteractionSessionV2(exercise, 0);
    state = press(state, "zhuyin:ㄩ", 10);
    state = press(state, "zhuyin:ㄝ", 20);
    state = press(state, "zhuyin:ㄒ", 30);

    expect(currentPracticeView(state).bodyComplete).toBe(true);
    expect(currentPracticeView(state).acceptableTokens).toEqual(["tone:2"]);
    expect(tokenState(state, 0, 3)).toBe("commit-ready");
    expect(inspectionNextToken(state)).toBe("tone:2");
  });

  it("advances syllable presentation only after tone commit", () => {
    let state = createInteractionSessionV2(exercise, 0);
    for (const [index, token] of ["zhuyin:ㄩ", "zhuyin:ㄒ", "zhuyin:ㄝ", "tone:2"].entries()) {
      state = press(state, token, (index + 1) * 10);
    }
    expect(state.completed).toBe(true);
    expect(syllableState(state, 0)).toBe("done");
    expect(inspectionNextToken(state)).toBeNull();
  });
});
