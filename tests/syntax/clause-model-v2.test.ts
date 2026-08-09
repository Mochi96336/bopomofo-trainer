import { describe, expect, it } from "vitest";
import {
  CLAUSE_MODEL_V2_AXES,
  CURRENT_CLAUSE_RULE_V2_MIGRATION,
} from "../../src/syntax/clause-model-v2.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";

function currentClauseRuleIds(): readonly string[] {
  return FORMAL_SYNTAX_RULES
    .filter((rule) => rule.output === "Clause")
    .map((rule) => rule.id)
    .sort();
}

describe("Clause model v2 migration inventory", () => {
  it("accounts for every current Clause production exactly once", () => {
    expect(Object.keys(CURRENT_CLAUSE_RULE_V2_MIGRATION).sort())
      .toEqual(currentClauseRuleIds());
  });

  it("keeps migration targets on explicit orthogonal axes", () => {
    const axes = new Set<string>(CLAUSE_MODEL_V2_AXES);
    expect(Object.values(CURRENT_CLAUSE_RULE_V2_MIGRATION)
      .every((item) => axes.has(item.targetAxis)))
      .toBe(true);
  });

  it("moves marking, omission, and topic structure out of predicate-frame identity", () => {
    expect(CURRENT_CLAUSE_RULE_V2_MIGRATION["clause.modal"]).toMatchObject({
      targetAxis: "predicate-marking",
      target: "modality",
    });
    expect(CURRENT_CLAUSE_RULE_V2_MIGRATION["clause.negative"]).toMatchObject({
      targetAxis: "predicate-marking",
      target: "polarity",
    });
    expect(CURRENT_CLAUSE_RULE_V2_MIGRATION["clause.aspect"]).toMatchObject({
      targetAxis: "predicate-marking",
      target: "aspect",
    });
    expect(CURRENT_CLAUSE_RULE_V2_MIGRATION["clause.subject-omission"].targetAxis)
      .toBe("argument-realization");
    expect(CURRENT_CLAUSE_RULE_V2_MIGRATION["clause.object-omission"].targetAxis)
      .toBe("argument-realization");
    expect(CURRENT_CLAUSE_RULE_V2_MIGRATION["clause.topic-comment"].targetAxis)
      .toBe("information-structure");
  });

  it("pins the first migration partition before runtime legality changes", () => {
    const counts = Object.values(CURRENT_CLAUSE_RULE_V2_MIGRATION)
      .reduce<Record<string, number>>((result, item) => {
        result[item.group] = (result[item.group] ?? 0) + 1;
        return result;
      }, {});

    expect(counts).toEqual({
      "preserve-core": 7,
      "move-to-axis": 6,
      "rebuild-construction": 3,
      "rebuild-embedding-control": 5,
      "hold-for-corpus-rebuild": 3,
    });
  });

  it("does not silently preserve the known high-risk constructions", () => {
    for (const ruleId of ["clause.locative", "clause.causative", "clause.serial-verb"] as const) {
      expect(CURRENT_CLAUSE_RULE_V2_MIGRATION[ruleId].group)
        .toBe("hold-for-corpus-rebuild");
    }
    expect(CURRENT_CLAUSE_RULE_V2_MIGRATION["clause.bei"]).toMatchObject({
      group: "rebuild-construction",
      target: "passive.short|passive.long",
    });
    expect(CURRENT_CLAUSE_RULE_V2_MIGRATION["clause.complement-content"]).toMatchObject({
      targetAxis: "embedding",
      target: "xcomp",
    });
  });
});
