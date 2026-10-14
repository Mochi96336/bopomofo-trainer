import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "../../src/core/model.js";
import type { GrammarUtteranceCandidate } from "../../src/grammar/types.js";
import {
  auditPolyphonicCandidate,
  buildPolyphonicReadingIndex,
} from "../../src/readings/polyphonic-audit.js";

function entry(text: string, id: string): CatalogEntry {
  return {
    id,
    prompt: { text, locale: "zh-TW" },
    syllables: [{ tokens: ["zhuyin:ㄓ", "tone:1"] }],
    tags: [],
    provenanceIds: [],
  };
}

function utterance(entries: readonly CatalogEntry[]): GrammarUtteranceCandidate {
  return {
    id: "test:sentence",
    kind: "formal-syntax",
    templateId: null,
    assignments: [],
    entries,
    text: entries.map((item) => item.prompt.text).join(""),
    punctuation: "。",
    syntaxRootRuleId: "sentence.test",
  };
}

describe("polyphonic reading exposure audit", () => {
  const catalog = [
    entry("我", "word:我:ㄨㄛ3"),
    entry("想", "word:想:ㄒㄧㄤ3"),
    entry("種", "word:種:ㄓㄨㄥ3"),
    entry("種", "word:種:ㄓㄨㄥ4"),
    entry("花", "word:花:ㄏㄨㄚ1"),
    entry("東西", "word:東西:ㄉㄨㄥ1-ㄒㄧ1"),
    entry("東西", "word:東西:ㄉㄨㄥ1-ㄒㄧ5"),
  ] as const;

  it("groups only identical written forms with distinct catalog identities", () => {
    const index = buildPolyphonicReadingIndex(catalog);
    expect([...index.keys()]).toEqual(["東西", "種"]);
    expect(index.get("我")).toBeUndefined();
    expect(index.get("種")).toEqual(["word:種:ㄓㄨㄥ3", "word:種:ㄓㄨㄥ4"]);
    expect(index.get("東西")).toHaveLength(2);
  });

  it("reports the selected identity and lexical neighbors without judging correctness", () => {
    const index = buildPolyphonicReadingIndex(catalog);
    const actual = auditPolyphonicCandidate(
      12,
      utterance([catalog[0]!, catalog[1]!, catalog[3]!, catalog[4]!]),
      index,
    );
    expect(actual).toEqual([{
      seedIndex: 12,
      sentence: "我想種花",
      punctuation: "。",
      syntaxRootRuleId: "sentence.test",
      entryIndex: 2,
      text: "種",
      selectedEntryId: "word:種:ㄓㄨㄥ4",
      alternativeEntryIds: ["word:種:ㄓㄨㄥ3"],
      previousEntryText: "想",
      nextEntryText: "花",
    }]);
  });

  it("keeps multi-character words atomic instead of matching individual characters", () => {
    const index = buildPolyphonicReadingIndex(catalog);
    const actual = auditPolyphonicCandidate(0, utterance([catalog[5]!]), index);
    expect(actual).toHaveLength(1);
    expect(actual[0]?.text).toBe("東西");
    expect(actual[0]?.previousEntryText).toBeNull();
    expect(actual[0]?.nextEntryText).toBeNull();
  });

  it("ignores single-reading entries and rejects inconsistent catalog identities", () => {
    const index = buildPolyphonicReadingIndex(catalog);
    expect(auditPolyphonicCandidate(0, utterance([catalog[0]!]), index)).toEqual([]);
    expect(() => auditPolyphonicCandidate(
      0,
      utterance([entry("種", "word:種:not-in-the-active-catalog")]),
      index,
    )).toThrow("candidate reading is absent from audit catalog");
  });
});
