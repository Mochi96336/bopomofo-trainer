import { describe, expect, it } from "vitest";
import {
  CLAUSE_MODEL_V2_AXES,
  CURRENT_CLAUSE_RULE_V2_MIGRATION,
  RETIRED_CLAUSE_RULE_V2_DECISIONS,
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
    expect(Object.values(RETIRED_CLAUSE_RULE_V2_DECISIONS)
      .every((item) => item.targetAxes.every((axis) => axes.has(axis))))
      .toBe(true);
  });

  it("moves marking, omission, and topic structure out of predicate-frame identity", () => {
    expect(CURRENT_CLAUSE_RULE_V2_MIGRATION["clause.modal"]).toMatchObject({
      targetAxis: "predicate-marking",
      target: "modality",
    });
    expect(RETIRED_CLAUSE_RULE_V2_DECISIONS["clause.negative"]).toMatchObject({
      targetAxes: ["predicate-marking"],
      evidenceContract: "predicate.verb.expanded:negation",
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

  it("keeps the migration partition explicit as runtime legality changes", () => {
    const counts = Object.values(CURRENT_CLAUSE_RULE_V2_MIGRATION)
      .reduce<Record<string, number>>((result, item) => {
        result[item.group] = (result[item.group] ?? 0) + 1;
        return result;
      }, {});

    expect(counts).toEqual({
      "preserve-core": 7,
      "move-to-axis": 5,
      "rebuild-construction": 3,
      "rebuild-embedding-control": 5,
      "hold-for-corpus-rebuild": 2,
    });
  });

  it("keeps unresolved live rules separate from deliberately retired rules", () => {
    for (const ruleId of ["clause.locative", "clause.serial-verb"] as const) {
      expect(CURRENT_CLAUSE_RULE_V2_MIGRATION[ruleId].group)
        .toBe("hold-for-corpus-rebuild");
    }
    expect(RETIRED_CLAUSE_RULE_V2_DECISIONS["clause.causative"]).toMatchObject({
      targetAxes: ["predicate-marking", "embedding"],
      evidenceContract: "causative-evidence-audit-v1",
    });
    expect(FORMAL_SYNTAX_RULES.some((rule) => rule.id === "clause.causative")).toBe(false);
    expect(FORMAL_SYNTAX_RULES.some((rule) => rule.id === "clause.negative")).toBe(false);

    expect(CURRENT_CLAUSE_RULE_V2_MIGRATION["clause.bei"]).toMatchObject({
      group: "rebuild-construction",
      target: "passive.short|passive.long",
    });
    expect(CURRENT_CLAUSE_RULE_V2_MIGRATION["clause.xcomp-subject-control"]).toMatchObject({
      targetAxis: "embedding",
      target: "xcomp.subject-control",
    });
    expect(CURRENT_CLAUSE_RULE_V2_MIGRATION["clause.xcomp-object-control"]).toMatchObject({
      targetAxis: "embedding",
      target: "xcomp.object-control",
    });
  });
});
