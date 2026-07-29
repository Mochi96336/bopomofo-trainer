import { describe, expect, it } from "vitest";
import {
  confusionEmptyMessage,
  transitionEmptyMessage,
} from "../../src/app/diagnostic-panel.js";
import { DIAGNOSTIC_POLICY } from "../../src/diagnostics/policy.js";
import type { TransitionDiagnostic } from "../../src/diagnostics/types.js";

function transition(timingSamples: number): TransitionDiagnostic {
  return {
    id: "transition:zhuyin:ㄓ->zhuyin:ㄨ",
    fromTokenId: "zhuyin:ㄓ",
    toTokenId: "zhuyin:ㄨ",
    fromSymbol: "ㄓ",
    toSymbol: "ㄨ",
    fromPhysicalKey: "5",
    toPhysicalKey: "J",
    timingMs: 400,
    bestTimingMs: 300,
    timingSamples,
    dataState: "insufficient",
    includesTone: false,
  };
}

describe("diagnostic empty-state copy", () => {
  it("does not blame a scope the interface no longer offers", () => {
    // Direction, sample-count, and list-length controls were removed, so a
    // learner has no "範圍" to have chosen.
    const messages = [
      transitionEmptyMessage({ transitions: [] }, null),
      transitionEmptyMessage({ transitions: [transition(1)] }, null),
      transitionEmptyMessage({ transitions: [] }, "zhuyin:ㄌ"),
      confusionEmptyMessage(null),
      confusionEmptyMessage("zhuyin:ㄌ"),
    ];
    for (const message of messages) {
      expect(message).not.toContain("此範圍");
      expect(message).not.toContain("範圍");
    }
  });

  it("separates having no transitions from having none above the sample gate", () => {
    expect(transitionEmptyMessage({ transitions: [] }, null)).toBe("尚無轉換資料。");

    const gated = transitionEmptyMessage({ transitions: [transition(1)] }, null);
    expect(gated).toBe(
      `同一組轉換累積 ${DIAGNOSTIC_POLICY.relationshipSamples.preliminary} 次有效輸入後才會顯示；目前資料仍不足。`,
    );
  });

  it("names the selected key when a selection is what emptied the list", () => {
    expect(transitionEmptyMessage({ transitions: [transition(9)] }, "zhuyin:ㄌ"))
      .toBe("ㄌ 相關的轉換尚無足夠資料。");
    expect(confusionEmptyMessage("zhuyin:ㄌ")).toBe("ㄌ 目前沒有誤按紀錄。");
    expect(confusionEmptyMessage("tone:4")).toBe("ˋ 目前沒有誤按紀錄。");
  });

  it("keeps the confusion list free of a sample gate it does not apply", () => {
    // Unlike transitions, confusions are listed from the first occurrence, so
    // the copy must not promise a threshold that does not exist.
    expect(confusionEmptyMessage(null)).toBe("尚無誤按資料。");
    expect(confusionEmptyMessage(null)).not.toContain("樣本");
  });
});
