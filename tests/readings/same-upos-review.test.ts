import { describe, expect, it } from "vitest";
import type { PolyphonicContextHit } from "../../src/readings/polyphonic-audit.js";
import { buildSameUposReviewQueue } from "../../src/readings/same-upos-review.js";
import type { Upos } from "../../src/syntax/types.js";

function hit(
  text: string,
  upos: Upos,
  reading: string,
  seedIndex: number,
): PolyphonicContextHit {
  return {
    seedIndex,
    sentence: "這句包含" + text,
    punctuation: null,
    syntaxRootRuleId: "sentence.example",
    entryIndex: 2,
    text,
    selectedEntryId: "word:" + text + ":" + reading,
    selectedProfileId: "profile:" + seedIndex,
    selectedUpos: upos,
    selectedFunctions: ["subject"],
    alternativeEntryIds: [],
    previousEntryText: "包含",
    nextEntryText: null,
  };
}

describe("same-UPOS context review queue", () => {
  it("separates legitimate reviewed variants from unreviewed senses", () => {
    const hits = [
      hit("哪", "PRON", "ㄋㄚ3", 3),
      hit("哪", "PRON", "ㄋㄟ3", 2),
      hit("那", "PRON", "ㄋㄚ4", 8),
      hit("那", "PRON", "ㄋㄨㄛ2", 5),
      hit("那", "PRON", "ㄋㄨㄛ2", 6),
      hit("好", "ADJ", "ㄏㄠ3", 10),
      hit("好", "ADJ", "ㄏㄠ4", 11),
      hit("那", "DET", "ㄋㄚ4", 12),
      hit("種", "NOUN", "ㄓㄨㄥ3", 13),
    ];
    const review = buildSameUposReviewQueue(hits, 1);
    expect(review.ambiguousGroupsInSample).toBe(3);
    expect(review.occurrencesInAmbiguousGroups).toBe(7);
    expect(review.unreviewedGroups).toBe(2);
    expect(review.unreviewedOccurrences).toBe(5);

    const na = review.groups.find(g => g.text === "那");
    expect(na?.upos).toBe("PRON");
    expect(na?.kind).toBe("unreviewed-role-variation");
    expect(na?.examplesByReadingId["word:那:ㄋㄨㄛ2"]?.[0]?.seedIndex).toBe(5);
    expect(na?.examplesByReadingId["word:那:ㄋㄨㄛ2"]).toHaveLength(1);

    const question = review.groups.find(g => g.text === "哪");
    expect(question?.kind).toBe("reviewed-role-variation");
    expect(review.groups.some(g => g.text === "那" && g.upos === "DET")).toBe(false);
  });

  it("rejects unjoined evidence and invalid example limits", () => {
    expect(() => buildSameUposReviewQueue([], 0)).toThrow("positive integer");
    const unknown = { ...hit("種", "NOUN", "ㄓㄨㄥ3", 1), selectedUpos: null };
    expect(() => buildSameUposReviewQueue([unknown])).toThrow("profile-joined");
  });

  it("ignores single observed readings instead of mislabeling unobserved contexts", () => {
    const x = buildSameUposReviewQueue([
      hit("東西", "NOUN", "ㄉㄨㄥ1-ㄒㄧ1", 1),
      hit("東西", "NOUN", "ㄉㄨㄥ1-ㄒㄧ1", 2),
    ]);
    expect(x.sampledPolyphonicOccurrences).toBe(2);
    expect(x.groups).toEqual([]);
  });
});