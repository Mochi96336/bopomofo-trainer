import { describe, expect, it } from "vitest";
import {
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../../src/app/generated/catalog.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import {
  VERBAL_COMPARATIVE_BI_STANDARD_SAME_OCCURRENCE_CAPABILITY,
  validRuntimeOccurrenceCapabilities,
} from "../../src/syntax/runtime-occurrence-capabilities.js";

describe("comparative runtime sidecar integration", () => {
  it("keeps the reviewed verbal comparative capability in the runtime registry", () => {
    expect(validRuntimeOccurrenceCapabilities([
      VERBAL_COMPARATIVE_BI_STANDARD_SAME_OCCURRENCE_CAPABILITY,
    ])).toBe(true);
  });

  it("packages exactly the seven identity-safe reviewed verbal comparative profiles", () => {
    const textByEntryId = new Map(PRACTICE_CATALOG.map((entry) => [entry.id, entry.prompt.text]));
    const occurrenceBacked = SYNTAX_PROFILES.filter((profile) =>
      profile.occurrenceCapabilities?.includes(
        VERBAL_COMPARATIVE_BI_STANDARD_SAME_OCCURRENCE_CAPABILITY,
      ) ?? false,
    );

    expect(occurrenceBacked).toHaveLength(7);
    expect(occurrenceBacked.every((profile) => profile.upos === "VERB")).toBe(true);
    expect(occurrenceBacked.map((profile) => profile.entryId).sort()).toEqual([
      "word:來:ㄌㄞ2",
      "word:接近:ㄐㄧㄝ1-ㄐㄧㄣ4",
      "word:符合:ㄈㄨ2-ㄏㄜ2",
      "word:陷入:ㄒㄧㄢ4-ㄖㄨ4",
      "word:增長:ㄗㄥ1-ㄓㄤ3",
      "word:靠近:ㄎㄠ4-ㄐㄧㄣ4",
      "word:高出:ㄍㄠ1-ㄔㄨ1",
    ].sort());
    expect(occurrenceBacked.map((profile) => textByEntryId.get(profile.entryId)).sort())
      .toEqual(["來", "接近", "符合", "陷入", "增長", "靠近", "高出"].sort());
  });

  it("does not change executable comparative grammar before the reviewed rewrite", () => {
    const consumers = FORMAL_SYNTAX_RULES.flatMap((rule) =>
      rule.constituents.filter((constituent) =>
        constituent.requiredOccurrenceCapabilities?.includes(
          VERBAL_COMPARATIVE_BI_STANDARD_SAME_OCCURRENCE_CAPABILITY,
        ) ?? false,
      ).map((constituent) => `${rule.id}:${constituent.key}`),
    );
    expect(consumers).toEqual([]);
  });
});
