import { describe, expect, it } from "vitest";
import { FORMAL_SYNTAX_V2_EVIDENCE_BLOCKED_FRONTIERS } from "../../src/syntax/formal-syntax-v2-frontiers.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";

describe("Formal Syntax V2 evidence-blocked frontier registry", () => {
  it("contains only the two intentionally deferred phase-one frontiers", () => {
    expect(Object.keys(FORMAL_SYNTAX_V2_EVIDENCE_BLOCKED_FRONTIERS).sort()).toEqual([
      "clause.topic-comment",
      "sentence.constituent-subject-question",
    ]);
  });

  it("maps every registered frontier to its exact live legacy VerbPhrase consumer", () => {
    for (const [ruleId, frontier] of Object.entries(
      FORMAL_SYNTAX_V2_EVIDENCE_BLOCKED_FRONTIERS,
    )) {
      const rule = FORMAL_SYNTAX_RULES.find((item) => item.id === ruleId);
      expect(rule, ruleId).toBeDefined();
      expect(rule?.output, ruleId).toBe(frontier.grammarCategory);
      expect(
        rule?.constituents.find(
          (item) => item.key === frontier.legacyVerbPhraseConstituentKey,
        )?.category,
        ruleId,
      ).toBe("VerbPhrase");
    }
  });

  it("leaves no unregistered Sentence/Clause VerbPhrase consumers", () => {
    const registered = new Set(
      Object.entries(FORMAL_SYNTAX_V2_EVIDENCE_BLOCKED_FRONTIERS)
        .map(([ruleId, frontier]) =>
          `${ruleId}:${frontier.legacyVerbPhraseConstituentKey}`),
    );
    const actual = FORMAL_SYNTAX_RULES.flatMap((rule) => {
      if (rule.output !== "Clause" && rule.output !== "Sentence") return [];
      return rule.constituents
        .filter((item) => item.category === "VerbPhrase")
        .map((item) => `${rule.id}:${item.key}`);
    });
    expect([...actual].sort()).toEqual([...registered].sort());
  });
});
