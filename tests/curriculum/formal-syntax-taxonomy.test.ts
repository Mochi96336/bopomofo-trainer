import { describe, expect, it } from "vitest";
import {
  assertFormalSyntaxSamplingTaxonomyCoverage,
  auditEqualRuleTicketDistribution,
  clauseConstructionClassification,
  sentenceConstructionClassification,
} from "../../src/curriculum/formal-syntax-taxonomy.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";

describe("formal syntax sampling taxonomy", () => {
  it("covers every current Sentence and Clause production through the external registry", () => {
    expect(() => assertFormalSyntaxSamplingTaxonomyCoverage(FORMAL_SYNTAX_RULES)).not.toThrow();
  });

  it("groups structural variants without giving each variant a separate product family", () => {
    expect(sentenceConstructionClassification("sentence.a-not-a-question")).toEqual({
      kind: "question",
      family: "question.a-not-a",
    });
    expect(sentenceConstructionClassification("sentence.a-not-a-transitive-question")).toEqual({
      kind: "question",
      family: "question.a-not-a",
    });
    expect(sentenceConstructionClassification("sentence.constituent-question")?.family)
      .toBe("question.constituent");
    expect(sentenceConstructionClassification("sentence.constituent-subject-question")?.family)
      .toBe("question.constituent");

    expect(clauseConstructionClassification("clause.ba")).toEqual({
      kind: "marked",
      family: "marked.ba",
    });
    expect(clauseConstructionClassification("clause.transitive")).toEqual({
      kind: "core-predication",
      family: "core.transitive",
    });
  });

  it("makes the current equal-rule ticket bias explicit instead of treating it as policy", () => {
    const audit = auditEqualRuleTicketDistribution(FORMAL_SYNTAX_RULES);

    expect(audit.sentenceKinds).toEqual([
      {
        family: "exclamative",
        productionRuleIds: ["sentence.exclamative"],
        ticketCount: 1,
        rawShare: 0.1,
      },
      {
        family: "question",
        productionRuleIds: [
          "sentence.a-not-a-question",
          "sentence.a-not-a-transitive-question",
          "sentence.alternative-question",
          "sentence.constituent-question",
          "sentence.constituent-subject-question",
          "sentence.polar-question",
        ],
        ticketCount: 6,
        rawShare: 0.6,
      },
      {
        family: "request",
        productionRuleIds: ["sentence.request"],
        ticketCount: 1,
        rawShare: 0.1,
      },
      {
        family: "statement",
        productionRuleIds: ["sentence.complex", "sentence.declarative"],
        ticketCount: 2,
        rawShare: 0.2,
      },
    ]);

    expect(audit.sentenceFamilies.find((row) => row.family === "question.a-not-a"))
      .toMatchObject({ ticketCount: 2, rawShare: 0.2 });
    expect(audit.sentenceFamilies.find((row) => row.family === "question.constituent"))
      .toMatchObject({ ticketCount: 2, rawShare: 0.2 });

    expect(audit.clauseKinds).toEqual([
      expect.objectContaining({ family: "complex-predicate", ticketCount: 3, rawShare: 0.15 }),
      expect.objectContaining({ family: "core-predication", ticketCount: 8, rawShare: 0.4 }),
      expect.objectContaining({ family: "information-structure", ticketCount: 3, rawShare: 0.15 }),
      expect.objectContaining({ family: "marked", ticketCount: 6, rawShare: 0.3 }),
    ]);
    expect(audit.clauseFamilies).toHaveLength(20);
    expect(audit.clauseFamilies.every((row) => row.ticketCount === 1)).toBe(true);
  });

  it("fails closed when a new controlled production is added without taxonomy", () => {
    const declarative = FORMAL_SYNTAX_RULES.find((rule) => rule.id === "sentence.declarative");
    if (declarative === undefined) throw new Error("fixture requires sentence.declarative");
    const withUnclassifiedRule = [
      ...FORMAL_SYNTAX_RULES,
      { ...declarative, id: "sentence.future-unclassified" },
    ];
    expect(() => assertFormalSyntaxSamplingTaxonomyCoverage(withUnclassifiedRule))
      .toThrow(/unclassified Sentence rules: sentence\.future-unclassified/u);
  });
});
