import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "../../src/core/model.js";
import {
  createCatalogSupportIndex,
  entryTokenContexts,
} from "../../src/curriculum/support.js";

const ENTRY: CatalogEntry = {
  id: "support-v2",
  prompt: { text: "吧嗎", locale: "zh-TW" },
  syllables: [
    { tokens: ["zhuyin:ㄅ", "zhuyin:ㄚ", "tone:1"] },
    { tokens: ["zhuyin:ㄇ", "tone:2"] },
  ],
  tags: ["test"],
  provenanceIds: ["test"],
};

describe("unordered catalog support", () => {
  it("treats every token as correctness-supporting regardless of canonical position", () => {
    const contexts = entryTokenContexts(ENTRY);
    expect([...contexts.binding]).toEqual([
      "zhuyin:ㄅ",
      "zhuyin:ㄚ",
      "tone:1",
      "zhuyin:ㄇ",
      "tone:2",
    ]);
  });

  it("marks every multi-body component as timeable, not only later canonical tokens", () => {
    const contexts = entryTokenContexts(ENTRY);
    expect(contexts.motor.has("zhuyin:ㄅ")).toBe(true);
    expect(contexts.motor.has("zhuyin:ㄚ")).toBe(true);
    expect(contexts.motor.has("zhuyin:ㄇ")).toBe(false);
    expect(contexts.motor.has("tone:1")).toBe(true);
    expect(contexts.motor.has("tone:2")).toBe(true);

    const support = createCatalogSupportIndex([ENTRY]);
    expect(support.byToken["zhuyin:ㄅ"]?.motorEntryCount).toBe(1);
    expect(support.byToken["zhuyin:ㄇ"]?.motorEntryCount).toBe(0);
    expect(support.byToken["zhuyin:ㄅ"]?.bindingEntryCount).toBe(1);
  });
});
