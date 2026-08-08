import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "../../src/core/model.js";
import {
  indexStructuralAdjacencies,
  structuralAdjacencyKey,
} from "../../src/relations/structural-adjacency.js";

const entry: CatalogEntry = {
  id: "word:學",
  prompt: { text: "學", locale: "zh-TW" },
  syllables: [{ tokens: ["zhuyin:ㄒ", "zhuyin:ㄩ", "zhuyin:ㄝ", "tone:2"] }],
  tags: ["test"],
  provenanceIds: ["test"],
};

describe("structural adjacency", () => {
  it("indexes canonical syllable neighbors under an explicitly structural identity", () => {
    const index = indexStructuralAdjacencies([entry], { [entry.id]: "training" });
    expect(Object.keys(index.occurrences)).toEqual([
      structuralAdjacencyKey("zhuyin:ㄒ", "zhuyin:ㄩ"),
      structuralAdjacencyKey("zhuyin:ㄩ", "zhuyin:ㄝ"),
      structuralAdjacencyKey("zhuyin:ㄝ", "tone:2"),
    ].sort());
    expect(index.occurrences[structuralAdjacencyKey("zhuyin:ㄒ", "zhuyin:ㄩ")]?.[0]).toMatchObject({
      kind: "structural-adjacency",
      fromCanonicalTokenIndex: 0,
      fromToken: "zhuyin:ㄒ",
      toToken: "zhuyin:ㄩ",
    });
  });

  it("contains no physical-code, hand, timing, or observed-order fields", () => {
    const occurrence = indexStructuralAdjacencies([entry], { [entry.id]: "training" })
      .occurrences[structuralAdjacencyKey("zhuyin:ㄒ", "zhuyin:ㄩ")]?.[0];
    expect(occurrence).toBeDefined();
    expect(Object.keys(occurrence!)).not.toEqual(expect.arrayContaining([
      "physicalCode",
      "hand",
      "timingMs",
      "observedOrdinal",
    ]));
  });
});
