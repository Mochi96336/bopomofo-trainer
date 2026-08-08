import { describe, expect, it } from "vitest";
import {
  CLAUSE_PRODUCTION_RULES,
  FORMAL_SYNTAX_FIXTURES,
  FORMAL_SYNTAX_RULES,
} from "../../src/syntax/rules.js";
import { validateGrammarBundle } from "../../src/syntax/validate.js";

const REQUIRED_CONSTRUCTIONS = [
  "clause.nominal-predicate",
  "clause.adjective-predicate",
  "clause.intransitive",
  "clause.transitive",
  "clause.ditransitive",
  "clause.copular",
  "clause.existential",
  "clause.locative",
  "clause.modal",
  "clause.negative",
  "clause.aspect",
  "clause.ba",
  "clause.bei",
  "clause.causative",
  "clause.pivotal",
  "clause.serial-verb",
  "clause.comparative",
  "clause.topic-comment",
  "clause.subject-omission",
  "clause.object-omission",
  "sentence.request",
  "sentence.exclamative",
  "sentence.polar-question",
  "sentence.a-not-a-question",
  "sentence.alternative-question",
  "sentence.constituent-question",
] as const;

describe("formal clause and question production inventory", () => {
  it("validates with the phrase grammar as one versioned bundle", () => {
    expect(validateGrammarBundle(FORMAL_SYNTAX_RULES, FORMAL_SYNTAX_FIXTURES).errors)
      .toEqual([]);
  });

  it("contains every required executable basic, special, omitted, and question construction", () => {
    const ids = new Set(CLAUSE_PRODUCTION_RULES.map((rule) => rule.id));
    expect(REQUIRED_CONSTRUCTIONS.filter((id) => !ids.has(id))).toEqual([]);
  });

  it("does not keep sentence labels that have no executable structural distinction", () => {
    const rules = new Map(CLAUSE_PRODUCTION_RULES.map((rule) => [rule.id, rule]));
    expect(rules.has("sentence.imperative")).toBe(false);
    const exclamative = rules.get("sentence.exclamative");
    const interjection = exclamative?.constituents.find((item) => item.key === "interjection");
    expect(interjection?.minimum).toBe(1);
    expect(interjection?.maximum).toBe(1);
  });

  it("uses formal markers and valency rather than lexical text", () => {
    const serialized = JSON.stringify(CLAUSE_PRODUCTION_RULES);
    expect(serialized).not.toContain('"text"');
    expect(serialized).not.toContain('"meaning"');
    expect(serialized).toContain('"requiredValencyFrames"');
    expect(serialized).toContain('"questionType"');
  });

  it("keeps optional subject, object, particle, and punctuation cardinalities finite", () => {
    const optional = CLAUSE_PRODUCTION_RULES.flatMap((rule) =>
      rule.constituents.filter((item) => item.minimum === 0));
    expect(optional.length).toBeGreaterThan(0);
    expect(optional.every((item) => Number.isInteger(item.maximum) && item.maximum > 0))
      .toBe(true);
  });
});
